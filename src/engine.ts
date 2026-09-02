/**
 * tinyforge engine — one pure reducer.
 *
 * step(world, state, action) -> { state, events }. No I/O, no clock, no ambient
 * randomness: all rolls come from a PRNG cursor stored IN the state, so the same
 * seed and action list is byte-identical every run, and a trace replays exactly.
 */
import { createHash } from "node:crypto";
import type {
  Action,
  Cond,
  CustomAction,
  Fx,
  PerkDef,
  State,
  StepOut,
  TopicDef,
  UseDef,
  World,
} from "./types.ts";

// ---------- rng (mulberry32 over a cursor kept in state) ----------
function mix(seed: number): number {
  let a = (seed ^ 0x9e3779b9) | 0;
  a = Math.imul(a ^ (a >>> 16), 0x45d9f3b) | 0;
  a = Math.imul(a ^ (a >>> 16), 0x45d9f3b) | 0;
  return (a ^ (a >>> 16)) | 0;
}

function nextRng(a: number): { a: number; r: number } {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { a, r: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

/** d20, advancing the state's PRNG cursor. */
function d20(s: State): number {
  const { a, r } = nextRng(s.rngA);
  s.rngA = a;
  return 1 + Math.floor(r * 20);
}

// ---------- canonical hash ----------
function canon(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(",")}}`;
}

export function hashState(s: State): string {
  return createHash("sha256").update(canon(s)).digest("hex").slice(0, 8);
}

export function receipt(world: World, s: State): string {
  const end = s.ended ? s.ended.id : "open";
  return `${world.id}.${s.seed}.${s.turn}.${s.score}.${end}.${hashState(s)}`;
}

// ---------- helpers ----------
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const article = (name: string) => (/^[aeiou]/i.test(name) ? "an" : "a");

export function hasLight(world: World, s: State): boolean {
  return s.inv.some((id) => world.items[id]?.light && s.flags[`${id}_lit`]);
}

export function roomIsDark(world: World, s: State): boolean {
  return !!world.rooms[s.room]?.dark && !hasLight(world, s);
}

function npcDead(world: World, s: State, id: string): boolean {
  const def = world.npcs[id];
  if (!def) return false;
  return (s.npcHp[id] ?? def.hp ?? 1) <= 0;
}

export function condOk(world: World, s: State, c: Cond): boolean {
  switch (c[0]) {
    case "has":
      return s.inv.includes(c[1]);
    case "!has":
      return !s.inv.includes(c[1]);
    case "flag":
      return !!s.flags[c[1]];
    case "!flag":
      return !s.flags[c[1]];
    case "npcDead":
      return npcDead(world, s, c[1]);
    case "!npcDead":
      return !npcDead(world, s, c[1]);
    case "var": {
      const v = s.vars[c[1]] ?? 0;
      return c[2] === "<" ? v < c[3] : c[2] === ">" ? v > c[3] : c[2] === ">=" ? v >= c[3] : v === c[3];
    }
    case "class":
      return s.classId === c[1];
    case "!class":
      return s.classId !== c[1];
    case "perk":
      return s.perks.includes(c[1]);
    case "!perk":
      return !s.perks.includes(c[1]);
  }
}

const condsOk = (world: World, s: State, cs?: Cond[]) =>
  !cs || cs.every((c) => condOk(world, s, c));

// ---------- characters ----------
/** Cumulative xp needed to reach a level: 10 for 2, 30 for 3, 60 for 4, 100 for 5... */
export const xpForLevel = (level: number): number => 5 * level * (level - 1);

/** Sum a numeric perk bonus ("hit" | "dmg" | "armor" | "maxhp") over owned perks. */
function perkBonus(world: World, s: State, key: "hit" | "dmg" | "armor" | "maxhp"): number {
  let n = 0;
  for (const id of s.perks) n += world.perks?.[id]?.bonus?.[key] ?? 0;
  return n;
}

/** Modifier for a named check: world skill + attribute + perk check bonuses. */
export function checkMod(world: World, s: State, name: string): number {
  let n = (world.skills?.[name] ?? 0) + (s.attrs[name] ?? 0);
  for (const id of s.perks) n += world.perks?.[id]?.bonus?.check?.[name] ?? 0;
  return n;
}

/** Damage reduction: best carried armor item + perk armor. */
export function armorOf(world: World, s: State): number {
  let best = 0;
  for (const id of s.inv) best = Math.max(best, world.items[id]?.armor ?? 0);
  return best + perkBonus(world, s, "armor");
}

export function perkEligible(world: World, s: State, id: string, def: PerkDef): boolean {
  if (s.perks.includes(id)) return false;
  const r = def.require;
  if (!r) return true;
  if (r.level !== undefined && s.level < r.level) return false;
  if (r.class && (!s.classId || !r.class.includes(s.classId))) return false;
  if (r.attr && (s.attrs[r.attr[0]] ?? 0) < r.attr[1]) return false;
  return true;
}

function eligiblePerks(world: World, s: State): string[] {
  return Object.keys(world.perks ?? {}).filter((id) => perkEligible(world, s, id, world.perks![id]!));
}

/** Grant a perk: record it and apply its maxhp bonus (with the matching heal). */
function grantPerk(world: World, s: State, id: string, events: string[]): void {
  if (s.perks.includes(id)) return;
  const def = world.perks?.[id];
  if (!def) return;
  s.perks.push(id);
  const extraHp = def.bonus?.maxhp ?? 0;
  if (extraHp) {
    s.maxHp += extraHp;
    s.hp = Math.min(s.hp + extraHp, s.maxHp);
  }
  events.push(`Perk gained: ${def.name} (${def.desc}).`);
}

/** Add xp and apply any level-ups: +2 max hp, heal 2, one perk pick each. */
function grantXp(world: World, s: State, n: number, events: string[]): void {
  s.xp += n;
  if (n > 0) events.push(`(+${n}xp)`);
  while (s.xp >= xpForLevel(s.level + 1)) {
    s.level += 1;
    s.maxHp += 2;
    s.hp = Math.min(s.hp + 2, s.maxHp);
    events.push(`Level ${s.level}!`);
    // only queue a pick if something is actually pickable; eligibility never shrinks
    if (eligiblePerks(world, s).length) s.perkPicks += 1;
  }
}

export const inClassPhase = (world: World, s: State): boolean =>
  s.classId === null && !!world.classes && Object.keys(world.classes).length > 0;

// ---------- effects ----------
function applyFx(world: World, s: State, fxs: Fx[], events: string[]): void {
  for (const fx of fxs) {
    if (s.ended) return;
    switch (fx[0]) {
      case "say":
        events.push(fx[1]);
        break;
      case "set":
        s.flags[fx[1]] = true;
        break;
      case "clear":
        delete s.flags[fx[1]];
        break;
      case "score": {
        const before = s.score;
        s.score = clamp(s.score + fx[1], 0, world.maxScore);
        if (s.score > before) events.push(`(+${s.score - before})`);
        break;
      }
      case "hp": {
        const beforeHp = s.hp;
        s.hp = clamp(s.hp + fx[1], 0, s.maxHp);
        const delta = s.hp - beforeHp;
        if (delta !== 0) events.push(`(hp${delta > 0 ? "+" : ""}${delta})`);
        if (s.hp <= 0) {
          s.ended = { kind: "lose", id: "dead", text: "You have died." };
          events.push("You have died.");
        }
        break;
      }
      case "move": {
        const [, item, loc] = fx;
        if (loc === "inv") {
          if (!s.inv.includes(item)) {
            s.inv.push(item);
            events.push(`${world.items[item]?.name ?? item}: obtained.`);
          }
          s.itemLoc[item] = "inv";
        } else {
          s.inv = s.inv.filter((i) => i !== item);
          s.itemLoc[item] = loc;
        }
        break;
      }
      case "goto":
        enterRoom(world, s, fx[1], events);
        break;
      case "npcgo":
        s.npcRoom[fx[1]] = fx[2];
        break;
      case "setvar":
        s.vars[fx[1]] = fx[2];
        break;
      case "addvar":
        s.vars[fx[1]] = (s.vars[fx[1]] ?? 0) + fx[2];
        break;
      case "check": {
        const [, skill, dc, okFx, failFx] = fx;
        const mod = checkMod(world, s, skill);
        const roll = d20(s);
        const total = roll + mod;
        const ok = total >= dc;
        // States the total vs DC directly (the exact comparison `ok` runs) so
        // there is no derived "needed N+" number to mistranslate back into a
        // total — see oddsHint's comment for the report this replaced. The
        // idiom "(ties win)" got read as being about the raw die roll (e.g.
        // "roll 7 vs DC 10 lost, so ties can't really win"), not the total —
        // spelling the rule out as "(DC+ succeeds)", reusing the DC number
        // already in the line, states the same >= rule without a second,
        // mistranslatable frame.
        events.push(`${skill.toUpperCase()} d20:${roll}+${mod}=${total} vs DC ${dc} (${dc}+ succeeds) — ${ok ? "success" : "fail"}.`);
        applyFx(world, s, ok ? okFx : failFx, events);
        break;
      }
      case "xp":
        grantXp(world, s, fx[1], events);
        break;
      case "perk":
        grantPerk(world, s, fx[1], events);
        break;
      case "end":
        s.ended = { kind: fx[1], id: fx[2], text: fx[3] };
        break;
    }
  }
}

function enterRoom(world: World, s: State, roomId: string, events: string[]): void {
  s.room = roomId;
  const room = world.rooms[roomId];
  if (!room) return;
  const first = !s.visited.includes(roomId);
  if (first) s.visited.push(roomId);
  if (first && room.onEnterOnce) applyFx(world, s, room.onEnterOnce, events);
  if (room.onEnter) applyFx(world, s, room.onEnter, events);
}

// ---------- initial state ----------
export function newState(world: World, seed: number): StepOut {
  const s: State = {
    seed,
    rngA: mix(seed),
    turn: 0,
    room: world.start,
    hp: world.hp,
    maxHp: world.hp,
    score: 0,
    classId: null,
    attrs: {},
    perks: [],
    xp: 0,
    level: 1,
    perkPicks: 0,
    inv: [],
    flags: {},
    vars: {},
    itemLoc: Object.fromEntries(Object.entries(world.items).map(([id, d]) => [id, d.loc])),
    npcHp: Object.fromEntries(Object.entries(world.npcs).map(([id, d]) => [id, d.hp ?? 1])),
    npcRoom: Object.fromEntries(Object.entries(world.npcs).map(([id, d]) => [id, d.room])),
    visited: [],
    ended: null,
  };
  for (const id of Object.keys(world.items)) if (s.itemLoc[id] === "inv") s.inv.push(id);
  const events: string[] = [];
  // with classes, the start room waits until the player picks who they are
  if (!inClassPhase(world, s)) enterRoom(world, s, world.start, events);
  return { state: s, events };
}

// ---------- legal actions ----------
function npcsHere(world: World, s: State): string[] {
  return Object.keys(world.npcs).filter(
    (id) => s.npcRoom[id] === s.room && !npcDead(world, s, id),
  );
}

function itemsHere(world: World, s: State): string[] {
  return Object.keys(world.items).filter((id) => s.itemLoc[id] === s.room);
}

function customVisible(world: World, s: State, a: CustomAction): boolean {
  if (a.once && s.flags[`did_${a.id}`]) return false;
  return condsOk(world, s, a.if);
}

function topicVisible(world: World, s: State, npc: string, t: TopicDef): boolean {
  if (t.once && s.flags[`said_${npc}_${t.id}`]) return false;
  return condsOk(world, s, t.if);
}

export function legalActions(world: World, s: State): Action[] {
  if (s.ended) return [];
  // class first: nothing else is legal until the player picks who they are
  if (inClassPhase(world, s))
    return Object.keys(world.classes!).map((id) => ({ kind: "classpick", id }));
  // a pending level-up perk choice blocks the menu until spent
  if (s.perkPicks > 0) {
    const picks = eligiblePerks(world, s).sort();
    if (picks.length) return picks.slice(0, 12).map((id) => ({ kind: "perkpick", id }));
  }
  const out: Action[] = [];
  const room = world.rooms[s.room];
  if (!room) return out;
  for (const dir of Object.keys(room.exits ?? {})) out.push({ kind: "go", dir });
  if (roomIsDark(world, s)) return out; // in the dark you can only feel for exits
  for (const a of room.actions ?? [])
    if (customVisible(world, s, a)) out.push({ kind: "custom", room: s.room, id: a.id });
  for (const id of itemsHere(world, s))
    if (world.items[id]?.takeable) out.push({ kind: "take", item: id });
  for (const npc of npcsHere(world, s)) {
    const def = world.npcs[npc]!;
    for (const t of def.topics ?? [])
      if (topicVisible(world, s, npc, t)) out.push({ kind: "talk", npc, topic: t.id });
    if (def.hp !== undefined) out.push({ kind: "attack", npc });
  }
  for (const id of s.inv) {
    for (const u of world.items[id]?.use ?? []) {
      if (!condsOk(world, s, u.if)) continue;
      const t = u.target;
      const targetPresent =
        !t || s.inv.includes(t) || s.itemLoc[t] === s.room || s.npcRoom[t] === s.room;
      if (targetPresent) {
        out.push({ kind: "use", item: id, ...(t ? { target: t } : {}) });
        break; // one use entry per item
      }
    }
  }
  return out;
}

export function actionLabel(world: World, a: Action, s?: State): string {
  switch (a.kind) {
    case "go":
      return `go ${a.dir}`;
    case "take":
      return `take ${world.items[a.item]?.name ?? a.item}`;
    case "use": {
      const item = world.items[a.item]?.name ?? a.item;
      const target = a.target
        ? (world.items[a.target]?.name ?? world.npcs[a.target]?.name ?? a.target)
        : null;
      return target ? `use ${item} on ${target}` : `use ${item}`;
    }
    case "talk": {
      const npc = world.npcs[a.npc];
      const t = npc?.topics?.find((x) => x.id === a.topic);
      return `ask ${npc?.name ?? a.npc}: ${t?.label ?? a.topic}`;
    }
    case "attack": {
      const npcName = world.npcs[a.npc]?.name ?? a.npc;
      const weapon = s ? bestWeapon(world, s).item : null;
      const weaponName = weapon ? world.items[weapon]?.name : "bare hands";
      return `attack ${npcName} with ${weaponName}`;
    }
    case "custom":
      return world.rooms[a.room]?.actions?.find((x) => x.id === a.id)?.label ?? a.id;
    case "classpick": {
      const c = world.classes?.[a.id];
      return c ? `be ${article(c.name)} ${c.name} — ${c.desc}` : a.id;
    }
    case "perkpick": {
      const p = world.perks?.[a.id];
      return p ? `perk: ${p.name} (${p.desc})` : a.id;
    }
  }
}

// ---------- step ----------
function bestWeapon(world: World, s: State): { hit: number; dmg: number; item: string | null } {
  let best: { hit: number; dmg: number; item: string | null } = { hit: 0, dmg: 1, item: null };
  for (const id of s.inv) {
    const it = world.items[id];
    if (!it?.dmg) continue;
    if (it.dmg > best.dmg || (it.dmg === best.dmg && (it.hit ?? 0) > best.hit))
      best = { hit: it.hit ?? 0, dmg: it.dmg, item: id };
  }
  return best;
}

/** The check a "use" action would actually run, mirroring step()'s own def search. */
function useDefFor(world: World, s: State, item: string): UseDef | undefined {
  return (world.items[item]?.use ?? []).find((d) => {
    if (!condsOk(world, s, d.if)) return false;
    const t = d.target;
    return !t || s.inv.includes(t) || s.itemLoc[t] === s.room || s.npcRoom[t] === s.room;
  });
}

/** The fx list an action would run, if it has one and a leading check is worth previewing. */
function fxFor(world: World, s: State, a: Action): Fx[] | undefined {
  switch (a.kind) {
    case "custom":
      return world.rooms[a.room]?.actions?.find((x) => x.id === a.id)?.fx;
    case "talk":
      return world.npcs[a.npc]?.topics?.find((x) => x.id === a.topic)?.fx;
    case "use":
      return useDefFor(world, s, a.item)?.fx;
    default:
      return undefined;
  }
}

/**
 * A short "(roll N+ on the die)" preview for a risky action, so a player can
 * weigh it before spending a turn (and possibly hp) on it. Says "on the die"
 * explicitly — not "needs a total of N+" — because real players read an
 * ambiguous "needs N+" as the roll-plus-modifier total and then called a
 * correct fail a bug when their raw roll fell short but their total didn't.
 * For a skill check with a nonzero modifier, also names it ("+3 wits") so a
 * later "vs DC 12" in the post-roll event doesn't read as a different, higher
 * number than the "roll 8+" just previewed — same check, two frames (die-only
 * here, total-vs-DC there), bridged by the modifier appearing in both.
 * A "use" action with no check instead previews the item's own `hint` (if
 * any), e.g. "use iron crown (worth reading)" — an inventory item's use
 * option can appear in every room, far from wherever it was picked up, so
 * without this its effect stays unknown until a player spends a turn on it.
 * Display-only: it never touches actionLabel, so walkthroughs and proofs —
 * which match on the canonical label — are unaffected by odds text or by
 * attribute/perk changes.
 */
export function oddsHint(world: World, s: State, a: Action): string {
  if (a.kind === "attack") {
    const def = world.npcs[a.npc];
    if (!def) return "";
    const hit = bestWeapon(world, s).hit + (s.attrs["might"] ?? 0) + perkBonus(world, s, "hit");
    const need = Math.max(1, (def.df ?? 10) - hit);
    return ` (roll ${need}+ on the die)`;
  }
  if (a.kind === "go") {
    // legalActions lists every exit regardless of its gate, so a locked one
    // reads as a real choice; flag it before a turn is wasted walking into it
    const exit = world.rooms[s.room]?.exits?.[a.dir];
    if (exit?.if && !condsOk(world, s, exit.if))
      return exit.hint ? ` (locked: ${exit.hint})` : " (locked)";
    return exit?.landmark ? ` (toward ${exit.landmark})` : "";
  }
  const fx = fxFor(world, s, a);
  const chk = fx?.[0];
  if (chk && chk[0] === "check") {
    const mod = checkMod(world, s, chk[1]);
    const need = Math.max(1, chk[2] - mod);
    if (!mod) return ` (roll ${need}+ on the die)`;
    return ` (roll ${need}+ on the die, ${mod > 0 ? "+" : ""}${mod} ${chk[1]})`;
  }
  if (a.kind === "use") {
    const hint = world.items[a.item]?.hint;
    return hint ? ` (${hint})` : "";
  }
  return "";
}

export function step(world: World, prev: State, action: Action): StepOut {
  const legal = legalActions(world, prev);
  const key = canon(action);
  if (!legal.some((a) => canon(a) === key)) {
    return { state: prev, events: ["Illegal action — pick a number from the menu."] };
  }
  const s: State = structuredClone(prev);
  const events: string[] = [];
  s.turn += 1;

  switch (action.kind) {
    case "go": {
      const exit = world.rooms[s.room]?.exits?.[action.dir];
      if (!exit) break;
      if (!condsOk(world, s, exit.if)) {
        events.push(exit.lockedMsg ?? "You can't go that way yet.");
        break;
      }
      enterRoom(world, s, exit.to, events);
      break;
    }
    case "take": {
      s.itemLoc[action.item] = "inv";
      s.inv.push(action.item);
      const def = world.items[action.item];
      const label = def?.name ?? action.item;
      events.push(def?.hint ? `${label}: taken. (${def.hint})` : `${label}: taken.`);
      break;
    }
    case "use": {
      const defs = world.items[action.item]?.use ?? [];
      const u = defs.find((d) => {
        if (!condsOk(world, s, d.if)) return false;
        const t = d.target;
        return !t || s.inv.includes(t) || s.itemLoc[t] === s.room || s.npcRoom[t] === s.room;
      });
      if (u) applyFx(world, s, u.fx, events);
      else events.push("Nothing happens.");
      break;
    }
    case "talk": {
      const t = world.npcs[action.npc]?.topics?.find((x) => x.id === action.topic);
      if (!t) break;
      if (t.once) s.flags[`said_${action.npc}_${t.id}`] = true;
      events.push(`${world.npcs[action.npc]?.name}: "${t.say}"`);
      if (t.fx) applyFx(world, s, t.fx, events);
      break;
    }
    case "attack": {
      const def = world.npcs[action.npc]!;
      const w = bestWeapon(world, s);
      const hit = w.hit + (s.attrs["might"] ?? 0) + perkBonus(world, s, "hit");
      const roll = d20(s);
      const df = def.df ?? 10;
      const total = roll + hit;
      if (total >= df) {
        const dmg = (roll === 20 ? w.dmg * 2 : w.dmg) + perkBonus(world, s, "dmg");
        s.npcHp[action.npc] = (s.npcHp[action.npc] ?? 1) - dmg;
        events.push(`You hit the ${def.name} (d20:${roll}+${hit}=${total} vs DF ${df}, -${dmg}hp).`);
      } else {
        events.push(`You miss the ${def.name} (d20:${roll}+${hit}=${total} vs DF ${df}).`);
      }
      if ((s.npcHp[action.npc] ?? 0) <= 0) {
        events.push(`The ${def.name} is destroyed.`);
        if (def.onDeath) applyFx(world, s, def.onDeath, events);
      } else if (def.atk) {
        const armor = armorOf(world, s);
        const taken = Math.max(1, def.atk - armor);
        const absorbed = def.atk - taken;
        events.push(
          absorbed > 0
            ? `The ${def.name} strikes back — your armor takes ${absorbed} of it.`
            : `The ${def.name} strikes back.`,
        );
        applyFx(world, s, [["hp", -taken]], events);
      }
      break;
    }
    case "custom": {
      const a = world.rooms[action.room]?.actions?.find((x) => x.id === action.id);
      if (!a) break;
      if (a.once) s.flags[`did_${a.id}`] = true;
      applyFx(world, s, a.fx, events);
      break;
    }
    case "classpick": {
      const def = world.classes?.[action.id];
      if (!def) break;
      s.classId = action.id;
      for (const [k, v] of Object.entries(def.attrs ?? {})) s.attrs[k] = v;
      s.maxHp += def.hp ?? 0;
      s.hp = s.maxHp;
      for (const id of def.items ?? []) {
        if (!s.inv.includes(id)) s.inv.push(id);
        s.itemLoc[id] = "inv";
      }
      for (const id of def.perks ?? []) grantPerk(world, s, id, events);
      events.push(`You are ${article(def.name)} ${def.name}.`);
      enterRoom(world, s, world.start, events);
      break;
    }
    case "perkpick": {
      if (s.perkPicks <= 0) break;
      s.perkPicks -= 1;
      grantPerk(world, s, action.id, events);
      break;
    }
  }
  return { state: s, events };
}

/** Find a legal action by its rendered label (used by walkthroughs and the CLI). */
export function actionByLabel(world: World, s: State, label: string): Action | null {
  const want = label.trim().toLowerCase();
  for (const a of legalActions(world, s))
    if (actionLabel(world, a, s).toLowerCase() === want) return a;
  return null;
}
