/**
 * What a carried thing is for — or that it is for nothing.
 *
 * Wave seven, seed 8801: "Buying an item (oilskin cloak) and picking up many
 * quest-flavor trinkets never had a clear payoff or callback — most carried
 * items (sea-glass, tent-peg, tally-sticks, etc.) were flavor-only with no use
 * surfaced during play." A player who ends a run holding twenty keepsakes and
 * cannot name what one of them did is telling you something, but "most" is not
 * a number and cannot be acted on.
 *
 * So: every item, and every way the realm can read it.
 *
 *   its own `use` entries                       — a thing you do with it
 *   `["has", id]` / `["!has", id]` anywhere     — a gate it opens
 *   `["move", id, …]` from somewhere else       — content that takes or gives it
 *   a `use` on another item naming it as target — a key for a lock
 *   an npc `wants` / a trade                    — someone who will take it
 *
 * An item nothing reads is not automatically a defect: a keepsake is allowed
 * to be a keepsake, and the realm is the better for the sea-glass. The defect
 * is when a player cannot tell which is which, so the report separates the
 * ones that at least *say* they are keepsakes (a `hint` naming them as such)
 * from the ones that are simply silent.
 *
 *   npx tsx scripts/audit-items.ts world/reach.json
 *   npx tsx scripts/audit-items.ts world/reach.json --terse
 *   npx tsx scripts/audit-items.ts world/reach.json --dead   # only the silent ones
 */
import { loadWorld } from "../src/validate.ts";
import type { Cond, Fx, World } from "../src/types.ts";

process.stdout.on("error", (e: NodeJS.ErrnoException) => { if (e.code === "EPIPE") process.exit(0); });

const [path, ...rest] = process.argv.slice(2);
if (!path) { console.error("usage: npx tsx scripts/audit-items.ts <world.json> [--terse] [--dead]"); process.exit(2); }
const terse = rest.includes("--terse"), deadOnly = rest.includes("--dead");
const world: World = loadWorld(path);
const items = Object.entries(world.items);

type Use = { gates: number; moves: number; target: number; own: number };
const use = new Map<string, Use>(items.map(([id]) => [id, { gates: 0, moves: 0, target: 0, own: 0 }]));
const bump = (id: string, k: keyof Use) => { const u = use.get(id); if (u) u[k]++; };

function walkConds(cs: Cond[] | undefined): void {
  for (const c of cs ?? []) {
    if (c[0] === "has" || c[0] === "!has") bump(String(c[1]), "gates");
    if (c[0] === "any") walkConds(c[1]);
  }
}
function walkFx(fxs: Fx[] | undefined): void {
  for (const f of fxs ?? []) {
    if (f[0] === "move") bump(String(f[1]), "moves");
    if (f[0] === "if") { walkConds(f[1]); walkFx(f[2]); walkFx(f[3]); }
    if (f[0] === "check") { walkFx(f[3]); walkFx(f[4]); }
    if (f[0] === "chance") { walkFx(f[2]); walkFx(f[3]); }
  }
}

// every place in the realm that can carry conditions or effects
for (const room of Object.values(world.rooms)) {
  walkFx(room.onEnter);
  walkFx(room.onEnterOnce);
  for (const a of room.actions ?? []) { walkConds(a.if); walkFx(a.fx); }
  for (const v of room.variants ?? []) walkConds(v.if);
  for (const e of Object.values(room.exits ?? {})) walkConds(e.if);
}
for (const npc of Object.values(world.npcs)) {
  walkFx(npc.onDeath);
  for (const t of npc.topics ?? []) { walkConds(t.if); walkFx(t.fx); }
  for (const r of npc.companion?.remarks ?? []) { walkConds(r.if); walkFx(r.fx); }
  for (const l of npc.companion?.leaves ?? []) walkConds(l.if);
}
for (const [id, it] of items) {
  for (const u of it.use ?? []) {
    bump(id, "own");
    walkConds(u.if);
    walkFx(u.fx);
    if (u.target) bump(u.target, "target");
  }
}
for (const a of Object.values(world.abilities ?? {})) { walkConds(a.if); walkFx(a.fx); }
for (const c of world.clock ?? []) { walkConds(c.if); walkFx(c.fx); }
for (const q of Object.values(world.quests ?? {})) {
  walkConds(q.start); walkConds(q.done); walkConds(q.failed);
  for (const st of q.stages) walkConds(st.if);
}
for (const ep of world.epilogue ?? []) walkConds(ep.if);
for (const o of Array.isArray(world.objectives) ? world.objectives : []) walkConds(o.if);
for (const t of world.statusTracks ?? []) void t;

const total = (u: Use) => u.gates + u.moves + u.target + u.own;

/**
 * A hint that promises the thing is *for* something — "might unlock more of
 * theirs", "good for one climb", "worth carrying to". On an item nothing
 * reads, that is the one category here that is unambiguously a defect: the
 * realm told the player it would matter and then never asked for it.
 *
 * The test is a heuristic on prose and it is reported as candidates to read,
 * never as a verdict. An item with no reader and a hint that says "a small
 * thing to keep" is doing its job.
 */
const PROMISES = /\b(unlocks?|will open|opens (?!no|nothing)|use it|worth (carrying|keeping) (to|for)|shows the way|you will need|needed for)\b/i;
const hintOf = (id: string) => world.items[id]?.hint ?? "";

/**
 * The other kind of promise, and the one the wording test missed: a hint that
 * names a place.
 *
 * A blind player of wave eight carried the notched belt knife — "a boy's, by
 * the grip — too small for a grown hand; the Broken Bridge, west, remembers a
 * horse to match" — around the Ashwood and reported it as "never resolvable
 * within the areas I explored, leaving a dangling thread with no way to know
 * if it was missable content or a bug". This tool had called it a keepsake,
 * because no word in that sentence is on the list above. But it names a room,
 * and naming a room is telling the player to take the thing there.
 *
 * So the test is against the world rather than against a vocabulary: does the
 * hint contain the name or landmark of a real place? Short names are skipped —
 * "The Ford" and "Home" turn up inside ordinary sentences — which is why this
 * stays a list of candidates to read and not a verdict.
 */
const PLACE_MIN = 9;
const places = [...new Set(Object.values(world.rooms).flatMap((r) => [r.landmark, r.name]).filter((n): n is string => !!n && n.length >= PLACE_MIN))];
const namesAPlace = (id: string): string | undefined => {
  const hint = hintOf(id).toLowerCase();
  return places.find((n) => hint.includes(n.toLowerCase()));
};
/** Kit is read by the fight, not by a `has` gate: a sword with `dmg` is doing its job unnamed. */
const isKit = (id: string) => {
  const it = world.items[id];
  return !!it && (it.hit !== undefined || it.dmg !== undefined || it.armor !== undefined || it.light === true);
};

const dead = items.filter(([id]) => total(use.get(id)!) === 0 && !isKit(id));
const broken = (id: string) => PROMISES.test(hintOf(id)) || !!namesAPlace(id);
const promised = dead.filter(([id]) => broken(id));
const mute = dead.filter(([id]) => !hintOf(id));
const keepsakes = dead.filter(([id]) => hintOf(id) && !broken(id));

if (terse) {
  console.log(`items ${items.length} read ${items.length - dead.length} keepsakes ${keepsakes.length} promised ${promised.length} mute ${mute.length}`);
  process.exit(0);
}

if (!deadOnly) {
  console.log(`${path} — ${world.id}: ${items.length} items\n`);
  const rank = items
    .map(([id, it]) => ({ id, name: it.name, u: use.get(id)!, n: total(use.get(id)!) }))
    .sort((a, b) => b.n - a.n);
  console.log(`the ten the realm reads most — a thing with many readers is a thing the player will meet again:`);
  for (const r of rank.slice(0, 10))
    console.log(`  ${String(r.n).padStart(3)}  ${r.id.padEnd(26)} ${r.name.slice(0, 28).padEnd(28)} gates ${r.u.gates} moves ${r.u.moves} key ${r.u.target} uses ${r.u.own}`);
  console.log();
}

console.log(`${promised.length} items nothing reads whose own hint promises they are FOR something — read these, they are the defect:`);
for (const [id, it] of promised) {
  const place = namesAPlace(id);
  console.log(`  ${id.padEnd(26)} ${it.name.slice(0, 28).padEnd(28)} ${hintOf(id).slice(0, 56)}${place ? `\n  ${" ".repeat(26)} names a place: ${place} — nothing there reads it` : ""}`);
}

if (mute.length) {
  console.log(`\n${mute.length} items nothing reads and that carry no hint at all — a player cannot even tell they are keepsakes:`);
  for (const [id, it] of mute) console.log(`  ${id.padEnd(26)} ${it.name.slice(0, 40)}`);
}

console.log(
  `\n${items.length - dead.length} of ${items.length} items are read by something, wielded, worn, or carried for light. Of the ${dead.length} that are not, ${keepsakes.length} carry a hint\n` +
    `that reads as a keepsake and are doing their job — the sea-glass, "smoothed by years in the tide; a small\n` +
    `thing to keep", earns its place and the realm is better for it. ${promised.length} promise${promised.length === 1 ? "s" : ""} a use the realm never asks\n` +
    `for, and ${mute.length} say nothing at all. Those are the two to fix, and the cheaper fix is usually a hint rather\n` +
    `than a use: a player forgives a keepsake and does not forgive a broken promise.`,
);
process.exit(0);
