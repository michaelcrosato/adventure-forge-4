/**
 * Content lint for authors and reviewers — the style budget and the counts
 * the validator does not check. Loads a world (root file, parts included,
 * regions and stamps expanded) and prints:
 *
 *   - every string over its budget (desc 260, brief 70, label 40, say 220,
 *     epilogue 140, quest stage 120), with where it lives
 *   - rooms without a brief; conversation npcs without a farewell topic
 *   - per region prefix: rooms, named places, landmarks, npcs, quests,
 *     stamps, score and xp available, gold available
 *
 *   node --import tsx scripts/lint-world.ts world/reach.json [--prefix fd]
 */
import { loadWorld } from "../src/validate.ts";
import type { Fx, World } from "../src/types.ts";

const [path, ...rest] = process.argv.slice(2);
if (!path) { console.error("usage: node --import tsx scripts/lint-world.ts <world.json> [--prefix xx]"); process.exit(2); }
const only = rest.includes("--prefix") ? rest[rest.indexOf("--prefix") + 1]! : null;
const world: World = loadWorld(path);

const LIMITS = { desc: 260, brief: 70, label: 40, say: 220, epilogue: 140, stage: 120 };
const over: string[] = [];
const check = (where: string, kind: keyof typeof LIMITS, text: string | undefined) => {
  if (typeof text === "string" && text.length > LIMITS[kind]) over.push(`${where}: ${kind} ${text.length} > ${LIMITS[kind]}: "${text.slice(0, 60)}…"`);
};
const prefixOf = (id: string) => id.split("_")[0] ?? "";
const want = (id: string) => !only || prefixOf(id) === only;

/** Walk effects: say lengths, and totals of score/xp/gold. */
type Totals = { score: number; xp: number; gold: number };
const walkFx = (where: string, fxs: Fx[] | undefined, t: Totals) => {
  for (const fx of fxs ?? []) {
    switch (fx[0]) {
      case "say": check(where, "say", fx[1]); break;
      case "score": if (fx[1] > 0) t.score += fx[1]; break;
      case "xp": t.xp += fx[1]; break;
      case "addvar": if (fx[1] === "gold" && fx[2] > 0) t.gold += fx[2]; break;
      case "check": walkFx(where, fx[3], t); walkFx(where, fx[4], t); break;
      case "chance": walkFx(where, fx[2], t); walkFx(where, fx[3], t); break;
      case "if": walkFx(where, fx[2], t); walkFx(where, fx[3], t); break;
    }
  }
};

const regions = new Map<string, { rooms: number; named: number; landmarks: number; npcs: number; quests: number; stamps: number; totals: Totals; noBrief: string[]; noFarewell: string[] }>();
const bucket = (id: string) => {
  const k = prefixOf(id);
  if (!regions.has(k)) regions.set(k, { rooms: 0, named: 0, landmarks: 0, npcs: 0, quests: 0, stamps: 0, totals: { score: 0, xp: 0, gold: 0 }, noBrief: [], noFarewell: [] });
  return regions.get(k)!;
};

for (const [rid, room] of Object.entries(world.rooms)) {
  if (!want(rid)) continue;
  const b = bucket(rid);
  b.rooms++;
  if (!/\d+,\d+$/.test(room.name)) b.named++;
  if (room.landmark) b.landmarks++;
  if (!room.brief) b.noBrief.push(rid);
  check(`room ${rid}`, "desc", room.desc);
  check(`room ${rid}`, "brief", room.brief);
  for (const v of room.variants ?? []) { check(`room ${rid} variant`, "desc", v.desc); check(`room ${rid} variant`, "brief", v.brief); }
  walkFx(`room ${rid} onEnter`, room.onEnter, b.totals);
  walkFx(`room ${rid} onEnterOnce`, room.onEnterOnce, b.totals);
  for (const a of room.actions ?? []) { check(`room ${rid} action ${a.id}`, "label", a.label); walkFx(`room ${rid} action ${a.id}`, a.fx, b.totals); }
}
for (const [iid, item] of Object.entries(world.items)) {
  if (!want(iid)) continue;
  const b = bucket(iid);
  for (const u of item.use ?? []) walkFx(`item ${iid} use`, u.fx, b.totals);
}
for (const [nid, npc] of Object.entries(world.npcs)) {
  if (!want(nid)) continue;
  const b = bucket(nid);
  b.npcs++;
  check(`npc ${nid}`, "desc", npc.desc);
  walkFx(`npc ${nid} onDeath`, npc.onDeath, b.totals);
  if (npc.dialogue && !(npc.topics ?? []).some((t) => t.end)) b.noFarewell.push(nid);
  for (const t of npc.topics ?? []) { check(`npc ${nid} topic ${t.id}`, "label", t.label); check(`npc ${nid} topic ${t.id}`, "say", t.say); walkFx(`npc ${nid} topic ${t.id}`, t.fx, b.totals); }
  for (const r of npc.companion?.remarks ?? []) check(`npc ${nid} remark ${r.id}`, "say", r.say);
}
for (const [qid, q] of Object.entries(world.quests ?? {})) {
  if (!want(qid)) continue;
  bucket(qid).quests++;
  for (const st of q.stages) check(`quest ${qid}`, "stage", st.text);
}
for (const [i, ep] of (world.epilogue ?? []).entries()) check(`epilogue ${i}`, "epilogue", ep.text);
for (const st of world.stamps ?? []) if (want(st.id)) bucket(st.id).stamps++;

console.log(`world ${world.id}: ${Object.keys(world.rooms).length} rooms, ${Object.keys(world.npcs).length} npcs, ${Object.keys(world.items).length} items, ${Object.keys(world.quests ?? {}).length} quests, ${(world.epilogue ?? []).length} epilogue lines, maxScore ${world.maxScore}`);
console.log("\nregion  rooms named lmk  npcs quests stamps  score   xp  gold");
for (const [k, b] of [...regions.entries()].sort()) {
  console.log(`${k.padEnd(7)} ${String(b.rooms).padStart(5)} ${String(b.named).padStart(5)} ${String(b.landmarks).padStart(3)} ${String(b.npcs).padStart(5)} ${String(b.quests).padStart(6)} ${String(b.stamps).padStart(6)} ${String(b.totals.score).padStart(6)} ${String(b.totals.xp).padStart(4)} ${String(b.totals.gold).padStart(5)}`);
  if (b.noBrief.length) console.log(`        no brief: ${b.noBrief.join(", ")}`);
  if (b.noFarewell.length) console.log(`        conversation npcs without a farewell: ${b.noFarewell.join(", ")}`);
}
if (over.length) { console.log(`\n${over.length} over budget:`); for (const o of over) console.log(`  ${o}`); }
else console.log("\nall text within budget");
process.exit(over.length ? 1 : 0);
