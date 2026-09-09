/**
 * Does the way there go through a door that is shut?
 *
 * A quest stage's `at` names the room it points at, and the free `status`
 * screen prints the walk to it. That walk comes from the same breadth-first
 * search `bearings` uses, and it crosses every exit in the graph — gated ones
 * included. That is right for a bearing, which says where a place *is*: a
 * locked door does not move the barrow.
 *
 * It is not always right for a route the player is being told to follow. Wave
 * nine, seed 9911: "Directional 'get your bearings' hints sometimes described
 * paths that didn't match the actual room-to-room connections encountered while
 * following them, causing backtracking." Every leg led exactly where it said —
 * `audit-bearings` walks all of them and none lie about the graph. What the
 * player hit was a shut door mid-route.
 *
 * The split this prints is the whole finding. A route whose LAST leg is shut is
 * the design working: the door is the objective, and you are being sent to open
 * it. A route shut BEFORE the last leg sends you through a door that is not the
 * point, and following it costs you the walk back.
 *
 *   npx tsx scripts/audit-routes.ts world/reach.json [--terse]
 *
 * Measured along the world's own walkthrough, so every route counted is one a
 * player of the proven road actually reads, with the flags they actually hold
 * at that turn.
 */
import { actionByLabel, condOk, journal, newState, step } from "../src/engine.ts";
import { loadWorld } from "../src/validate.ts";
import type { State, World } from "../src/types.ts";

const [file, ...flags] = process.argv.slice(2);
if (!file) {
  console.error("usage: npx tsx scripts/audit-routes.ts <world.json> [--terse]");
  process.exit(1);
}
const terse = flags.includes("--terse");
const world = loadWorld(file) as World;

type Leg = { dir: string; from: string; to: string };

/** The path the journal prints, found the way the engine finds it: gates ignored. */
function route(w: World, from: string, to: string): Leg[] | null {
  if (from === to) return [];
  const prev = new Map<string, [string, string]>();
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!;
    for (const [dir, ex] of Object.entries(w.rooms[at]?.exits ?? {})) {
      if (prev.has(ex.to) || ex.to === from) continue;
      prev.set(ex.to, [at, dir]);
      if (ex.to === to) {
        const legs: Leg[] = [];
        let cur = to;
        while (cur !== from) {
          const [p, d] = prev.get(cur)!;
          legs.unshift({ dir: d, from: p, to: cur });
          cur = p;
        }
        return legs;
      }
      queue.push(ex.to);
    }
  }
  return null;
}

let printed = 0;
let shutRoutes = 0;
let midwayRoutes = 0;
const offenders = new Map<string, number>();

let { state } = newState(world, 1);
const look = (): void => {
  for (const q of journal(world, state)) {
    if (q.status !== "active" || !q.at) continue;
    const legs = route(world, state.room, q.at);
    if (!legs || !legs.length) continue;
    printed++;
    const shut = legs.filter((l) => {
      const ex = world.rooms[l.from]?.exits?.[l.dir];
      return ex?.if && !ex.if.every((c) => condOk(world, state, c));
    });
    if (!shut.length) continue;
    shutRoutes++;
    const midway = shut.filter((l) => l.to !== q.at);
    if (!midway.length) continue;
    midwayRoutes++;
    for (const leg of midway) {
      const key = `${leg.from} ${leg.dir} -> ${leg.to}  (${q.id} points at ${q.at})`;
      offenders.set(key, (offenders.get(key) ?? 0) + 1);
    }
  }
};

look();
for (const step_ of world.walkthrough) {
  const label = typeof step_ === "string" ? step_ : step_.repeat;
  let k = 0;
  do {
    const a = actionByLabel(world, state, label);
    if (!a) break;
    state = step(world, state, a).state as State;
    look();
  } while (typeof step_ !== "string" && !condOk(world, state, step_.until) && ++k < step_.max && !state.ended);
  if (state.ended) break;
}

const pct = (n: number): string => (printed ? `${((n / printed) * 100).toFixed(1)}%` : "—");
console.log(`${printed} routes printed along the walkthrough`);
console.log(`${shutRoutes} cross an exit shut at that moment (${pct(shutRoutes)})`);
console.log(`${midwayRoutes} are shut somewhere other than the last leg (${pct(midwayRoutes)}) — a door that is not the objective`);
if (!terse && offenders.size) {
  console.log(`\nshut legs that are not the objective, most-printed first:`);
  for (const [key, n] of [...offenders].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}x  ${key}`);
}
console.log(
  `\nA shut LAST leg is the design: the door is the objective. A shut leg before\nit is a route through a door that is not the point, and following it costs the\nwalk back. Neither is a bearing that lies — audit-bearings walks every leg and\nnone lead anywhere but where they say.`,
);
