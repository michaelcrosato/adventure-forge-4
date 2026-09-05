/**
 * tinyforge validator — the only door between authored content and the runtime.
 *
 * Static: every reference resolves, every DSL op is whitelisted, menus stay
 * within the cap. Dynamic: the authored walkthrough must replay to a WIN with
 * score === maxScore — the ending witness and the score-economy proof in one.
 */
import { readFileSync } from "node:fs";
import {
  actionByLabel,
  condOk,
  legalActions,
  newState,
  step,
} from "./engine.ts";
import { expandWorld } from "./worldgen.ts";
import { ATTRS, MENU_CAP } from "./types.ts";
import type { Cond, Fx, State, WalkStep, World } from "./types.ts";

export { MENU_CAP };

const COND_OPS = new Set([
  "has", "!has", "flag", "!flag", "npcDead", "!npcDead", "var", "class", "!class", "perk", "!perk", "inParty", "!inParty",
]);
const FX_OPS = new Set([
  "say", "set", "clear", "score", "hp", "move", "goto", "npcgo", "setvar", "addvar", "check", "xp", "perk", "chance", "party", "end",
]);

export function loadWorld(path: string): World {
  return expandWorld(JSON.parse(readFileSync(path, "utf8")) as World);
}

export function validateWorld(world: World): string[] {
  const errs: string[] = [];
  const err = (m: string) => errs.push(m);
  const roomOk = (id: string) => !!world.rooms[id];
  const itemOk = (id: string) => !!world.items[id];
  const npcOk = (id: string) => !!world.npcs[id];
  const classOk = (id: string) => !!world.classes?.[id];
  const perkOk = (id: string) => !!world.perks?.[id];
  const locOk = (l: string) => l === "inv" || l === "nowhere" || roomOk(l);
  const attrSet = new Set<string>(ATTRS);
  // a check name is valid if it is a world skill or one of the four attributes
  const checkNameOk = (n: string) => n in (world.skills ?? {}) || attrSet.has(n);

  const checkConds = (where: string, cs?: Cond[]) => {
    for (const c of cs ?? []) {
      if (!COND_OPS.has(c[0])) err(`${where}: unknown cond op ${String(c[0])}`);
      else if ((c[0] === "has" || c[0] === "!has") && !itemOk(c[1])) err(`${where}: unknown item ${c[1]}`);
      else if ((c[0] === "npcDead" || c[0] === "!npcDead" || c[0] === "inParty" || c[0] === "!inParty") && !npcOk(c[1])) err(`${where}: unknown npc ${c[1]}`);
      else if (c[0] === "var" && !["<", ">", "=", ">="].includes(c[2])) err(`${where}: bad var comparator ${String(c[2])}`);
      else if ((c[0] === "class" || c[0] === "!class") && !classOk(c[1])) err(`${where}: unknown class ${c[1]}`);
      else if ((c[0] === "perk" || c[0] === "!perk") && !perkOk(c[1])) err(`${where}: unknown perk ${c[1]}`);
    }
  };
  const endIds = new Set<string>(); // every ending the content can reach
  const checkFx = (where: string, fxs?: Fx[]) => {
    for (const fx of fxs ?? []) {
      const op = fx[0];
      if (!FX_OPS.has(op)) { err(`${where}: unknown fx op ${String(op)}`); continue; }
      if (op === "move" && !itemOk(fx[1])) err(`${where}: unknown item ${fx[1]}`);
      if (op === "move" && !locOk(fx[2])) err(`${where}: bad location ${fx[2]}`);
      if (op === "goto" && !roomOk(fx[1])) err(`${where}: unknown room ${fx[1]}`);
      if (op === "npcgo" && !npcOk(fx[1])) err(`${where}: unknown npc ${fx[1]}`);
      if (op === "npcgo" && fx[2] !== null && !roomOk(fx[2])) err(`${where}: unknown room ${fx[2]}`);
      if (op === "perk" && !perkOk(fx[1])) err(`${where}: unknown perk ${fx[1]}`);
      if (op === "end") endIds.add(fx[2]);
      if (op === "check") {
        if (!checkNameOk(fx[1])) err(`${where}: unknown skill ${fx[1]}`);
        checkFx(`${where}.check.ok`, fx[3]);
        checkFx(`${where}.check.fail`, fx[4]);
      }
      if (op === "chance") {
        if (typeof fx[1] !== "number" || fx[1] < 0 || fx[1] > 100) err(`${where}: chance must be 0..100, got ${String(fx[1])}`);
        checkFx(`${where}.chance.ok`, fx[2]);
        checkFx(`${where}.chance.fail`, fx[3]);
      }
      if (op === "party") {
        if (!npcOk(fx[1])) err(`${where}: unknown npc ${fx[1]}`);
        else if (!world.npcs[fx[1]]?.companion) err(`${where}: npc ${fx[1]} has no companion block — it cannot join a party`);
        if (fx[2] !== "join" && fx[2] !== "leave") err(`${where}: party wants "join" or "leave", got ${String(fx[2])}`);
      }
    }
  };

  // ---------- shape ----------
  // Every authored record must carry the fields the engine prints or
  // dispatches on. JSON is not type-checked: a topic written without `say`
  // played as `elder: "undefined"` before this check existed.
  const need = (where: string, o: object, fields: [name: string, type: "string" | "number" | "array"][]) => {
    const r = o as Record<string, unknown>;
    for (const [f, t] of fields) {
      const ok = t === "array" ? Array.isArray(r[f]) : typeof r[f] === t;
      if (!ok) err(`${where}: missing or non-${t} "${f}"`);
    }
  };
  need("world", world, [["id", "string"], ["title", "string"], ["intro", "string"], ["start", "string"], ["hp", "number"], ["maxScore", "number"]]);
  for (const [rid, room] of Object.entries(world.rooms)) {
    need(`room ${rid}`, room, [["name", "string"], ["desc", "string"]]);
    for (const a of room.actions ?? [])
      need(`room ${rid} action ${a.id ?? "?"}`, a, [["id", "string"], ["label", "string"], ["fx", "array"]]);
  }
  for (const [iid, item] of Object.entries(world.items)) need(`item ${iid}`, item, [["name", "string"], ["loc", "string"]]);
  for (const [nid, npc] of Object.entries(world.npcs)) {
    need(`npc ${nid}`, npc, [["name", "string"]]);
    if (npc.room !== null && typeof npc.room !== "string") err(`npc ${nid}: "room" must be a room id or null`);
    for (const t of npc.topics ?? [])
      need(`npc ${nid} topic ${t.id ?? "?"}`, t, [["id", "string"], ["label", "string"], ["say", "string"]]);
    for (const r of npc.companion?.remarks ?? [])
      need(`npc ${nid} remark ${r.id ?? "?"}`, r, [["id", "string"], ["say", "string"]]);
    // an aggressive npc that cannot hurt or be fought is a menu with no teeth
    if (npc.aggressive && (npc.hp === undefined || !npc.atk)) err(`npc ${nid}: aggressive needs both hp and atk`);
    if (npc.dialogue && !npc.topics?.length) err(`npc ${nid}: dialogue set but no topics — "talk to" would never appear`);
  }
  for (const [cid, cls] of Object.entries(world.classes ?? {})) need(`class ${cid}`, cls, [["name", "string"], ["desc", "string"]]);
  for (const [pid, perk] of Object.entries(world.perks ?? {})) need(`perk ${pid}`, perk, [["name", "string"], ["desc", "string"]]);

  // ---------- characters ----------
  for (const [cid, cls] of Object.entries(world.classes ?? {})) {
    for (const a of Object.keys(cls.attrs ?? {}))
      if (!attrSet.has(a)) err(`class ${cid}: unknown attribute ${a}`);
    for (const id of cls.items ?? []) if (!itemOk(id)) err(`class ${cid}: unknown item ${id}`);
    for (const id of cls.perks ?? []) if (!perkOk(id)) err(`class ${cid}: unknown perk ${id}`);
  }
  for (const [pid, perk] of Object.entries(world.perks ?? {})) {
    for (const id of perk.require?.class ?? []) if (!classOk(id)) err(`perk ${pid}: unknown class ${id}`);
    if (perk.require?.attr && !attrSet.has(perk.require.attr[0]))
      err(`perk ${pid}: unknown attribute ${perk.require.attr[0]}`);
    for (const n of Object.keys(perk.bonus?.check ?? {}))
      if (!checkNameOk(n)) err(`perk ${pid}: unknown check name ${n}`);
  }

  for (const p of world.statusPaths ?? []) {
    for (const st of p.states) checkConds(`statusPaths ${p.label}`, st.if);
  }

  // ---------- journal, epilogue, hud ----------
  for (const [qid, q] of Object.entries(world.quests ?? {})) {
    need(`quest ${qid}`, q, [["name", "string"], ["stages", "array"]]);
    if (Array.isArray(q.stages) && !q.stages.length) err(`quest ${qid}: needs at least one stage`);
    checkConds(`quest ${qid} start`, q.start);
    checkConds(`quest ${qid} done`, q.done);
    checkConds(`quest ${qid} failed`, q.failed);
    for (const [i, st] of (Array.isArray(q.stages) ? q.stages : []).entries()) {
      need(`quest ${qid} stage ${i}`, st, [["if", "array"], ["text", "string"]]);
      checkConds(`quest ${qid} stage ${i}`, st.if);
    }
  }
  for (const [i, ep] of (world.epilogue ?? []).entries()) {
    need(`epilogue ${i}`, ep, [["if", "array"], ["text", "string"]]);
    checkConds(`epilogue ${i}`, ep.if);
  }
  for (const [i, h] of (world.hud ?? []).entries()) need(`hud ${i}`, h, [["var", "string"], ["label", "string"]]);

  // ---------- regions and fast travel ----------
  const regionOk = (id: string) => !!world.regions?.[id];
  const landmarks = Object.entries(world.rooms).filter(([, r]) => r.landmark);
  const perRegion = new Map<string, number>();
  for (const [rid, room] of landmarks) {
    const r = room.region ?? "";
    perRegion.set(r, (perRegion.get(r) ?? 0) + 1);
    if (world.regions && !room.region) err(`room ${rid}: a landmark needs a region when the world defines regions`);
  }
  for (const [rid, room] of Object.entries(world.rooms))
    if (room.region !== undefined && !regionOk(room.region)) err(`room ${rid}: unknown region ${room.region}`);
  // the travel menu must always fit: flat list when small, else regions then one region's list
  if (landmarks.length > MENU_CAP - 1) {
    if (!world.regions) err(`fast travel: ${landmarks.length} landmarks exceed the flat menu (${MENU_CAP - 1}) — define regions to group them`);
    if (perRegion.size > MENU_CAP - 1) err(`fast travel: ${perRegion.size} regions with landmarks exceed the menu (${MENU_CAP - 1})`);
    for (const [r, n] of perRegion) if (n > MENU_CAP - 1) err(`fast travel: region ${r || "(none)"} has ${n} landmarks, more than the menu holds (${MENU_CAP - 1})`);
  }
  for (const [rid, region] of Object.entries(world.regions ?? {})) need(`region ${rid}`, region, [["name", "string"]]);

  if (!roomOk(world.start)) err(`start: unknown room ${world.start}`);
  for (const [rid, room] of Object.entries(world.rooms)) {
    for (const [dir, ex] of Object.entries(room.exits ?? {})) {
      if (!roomOk(ex.to)) err(`room ${rid} exit ${dir}: unknown room ${ex.to}`);
      checkConds(`room ${rid} exit ${dir}`, ex.if);
    }
    checkFx(`room ${rid} onEnter`, room.onEnter);
    checkFx(`room ${rid} onEnterOnce`, room.onEnterOnce);
    for (const a of room.actions ?? []) {
      checkConds(`room ${rid} action ${a.id}`, a.if);
      checkFx(`room ${rid} action ${a.id}`, a.fx);
    }
    for (const [i, v] of (room.variants ?? []).entries()) {
      need(`room ${rid} variant ${i}`, v, [["if", "array"]]);
      if (v.desc === undefined && v.brief === undefined && v.name === undefined) err(`room ${rid} variant ${i}: changes nothing (needs desc, brief, or name)`);
      checkConds(`room ${rid} variant ${i}`, v.if);
    }
  }
  for (const [iid, item] of Object.entries(world.items)) {
    if (!locOk(item.loc)) err(`item ${iid}: bad loc ${item.loc}`);
    for (const u of item.use ?? []) {
      if (u.target && !itemOk(u.target) && !npcOk(u.target)) err(`item ${iid} use: unknown target ${u.target}`);
      checkConds(`item ${iid} use`, u.if);
      checkFx(`item ${iid} use`, u.fx);
    }
  }
  for (const [nid, npc] of Object.entries(world.npcs)) {
    if (npc.room !== null && !roomOk(npc.room)) err(`npc ${nid}: unknown room ${npc.room}`);
    checkFx(`npc ${nid} onDeath`, npc.onDeath);
    for (const t of npc.topics ?? []) {
      checkConds(`npc ${nid} topic ${t.id}`, t.if);
      checkFx(`npc ${nid} topic ${t.id}`, t.fx);
    }
    for (const r of npc.companion?.remarks ?? []) checkConds(`npc ${nid} remark ${r.id}`, r.if);
  }

  // Dynamic proof: replay the walkthrough at seed 1.
  let primaryEnd: string | null = null;
  if (!world.walkthrough?.length) {
    err("walkthrough: missing — every world must carry its ending witness");
  } else {
    const result = replayWalkthrough(world, 1);
    if (result.error) err(`walkthrough: ${result.error}`);
    else {
      const s = result.state!;
      if (!s.ended || s.ended.kind !== "win") err(`walkthrough: did not end in a win (${s.ended?.id ?? "still open"})`);
      else if (s.score !== world.maxScore) err(`walkthrough: score ${s.score} !== maxScore ${world.maxScore} — score economy unsound`);
      else primaryEnd = s.ended.id;
      // Menu cap along the proven path
      if (result.maxMenu > MENU_CAP) err(`walkthrough: menu hit ${result.maxMenu} > cap ${MENU_CAP}`);
    }
  }

  // Ending proofs: every ending the content can reach must be replay-proven.
  // (The primary walkthrough covers its own ending; "dead" is the engine's.)
  for (const id of endIds) {
    if (id === primaryEnd || id === "dead") continue;
    if (!world.proofs?.[id]) err(`ending ${id}: no proof — add proofs.${id} or it is a claim, not a fact`);
  }
  for (const [id, steps] of Object.entries(world.proofs ?? {})) {
    if (!endIds.has(id)) { err(`proofs.${id}: no ["end", ..] in content uses this id`); continue; }
    const r = replayWalkthrough(world, 1, steps);
    if (r.error) err(`proofs.${id}: ${r.error}`);
    else if (r.state?.ended?.id !== id)
      err(`proofs.${id}: ended as ${r.state?.ended?.id ?? "still open"}, not ${id}`);
  }
  return errs;
}

export function replayWalkthrough(
  world: World,
  seed: number,
  steps: WalkStep[] = world.walkthrough,
): { state?: State; error?: string; maxMenu: number; turns: number } {
  let { state } = newState(world, seed);
  let maxMenu = 0;
  const doLabel = (label: string): string | null => {
    maxMenu = Math.max(maxMenu, legalActions(world, state).length);
    const a = actionByLabel(world, state, label);
    if (!a) return `no legal action labeled "${label}" at ${state.room} (turn ${state.turn})`;
    state = step(world, state, a).state;
    return null;
  };
  for (const w of steps) {
    if (typeof w === "string") {
      const e = doLabel(w);
      if (e) return { error: e, maxMenu, turns: state.turn };
    } else {
      let n = 0;
      while (!condOk(world, state, w.until)) {
        if (n++ >= w.max) return { error: `repeat "${w.repeat}" exceeded max ${w.max}`, maxMenu, turns: state.turn };
        if (state.ended) return { error: `died inside repeat "${w.repeat}"`, maxMenu, turns: state.turn };
        const e = doLabel(w.repeat);
        if (e) return { error: e, maxMenu, turns: state.turn };
      }
    }
    if (state.ended) break;
  }
  return { state, maxMenu, turns: state.turn };
}

// ---------- CLI ----------
if (process.argv[1]?.endsWith("validate.ts")) {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    console.error("usage: tsx src/validate.ts world/<file>.json ...");
    process.exit(2);
  }
  let bad = 0;
  for (const p of paths) {
    const world = loadWorld(p);
    const errs = validateWorld(world);
    if (errs.length) {
      bad++;
      console.error(`✗ ${p}`);
      for (const e of errs) console.error(`  - ${e}`);
    } else {
      const r = replayWalkthrough(world, 1);
      console.log(`✓ ${p} — win proven in ${r.turns} turns, max menu ${r.maxMenu}/${MENU_CAP}`);
    }
  }
  process.exit(bad ? 1 : 0);
}
