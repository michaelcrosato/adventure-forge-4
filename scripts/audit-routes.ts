/**
 * Does the way there go through a door that is shut?
 *
 * A quest stage's `at` names the room it points at, and the free `status`
 * screen prints the walk to it via `pathTo`. `bearingsHere` uses a separate,
 * always-cached search that crosses every exit in the graph, gated ones
 * included — right for a bearing, which says where a place *is*: a locked
 * door does not move the barrow. `pathTo` is not that search: it tries a
 * currently-open way first (`routeTo(..., respectGates: true)`), and only
 * falls back to one that crosses a shut exit when no open way exists at all.
 *
 * Wave nine, seed 9911: "Directional 'get your bearings' hints sometimes
 * described paths that didn't match the actual room-to-room connections
 * encountered while following them, causing backtracking." Every leg led
 * exactly where it said — `audit-bearings` walks all of them and none lie
 * about the graph. What the player hit was a shut door mid-route.
 *
 * The split this prints is the whole finding. A route whose LAST leg is shut
 * is the design working: the door is the objective, and you are being sent
 * to open it. A route shut BEFORE the last leg, in the graph's own shape,
 * sends you through a door that is not the point — the "graph" counts below
 * show how often the underlying map has that shape at all; "still shut"
 * shows how often `pathTo` has no open alternative and actually sends the
 * player through it.
 *
 *   npx tsx scripts/audit-routes.ts world/reach.json [--terse]
 *
 * Measured along the world's own walkthrough, so every route counted is one a
 * player of the proven road actually reads, with the flags they actually hold
 * at that turn.
 */
import { actionByLabel, condOk, journal, newState, routeTo, step } from "../src/engine.ts";
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

/** Walk a routeTo() predecessor map back into an ordered leg list. */
function legsFrom(from: Map<string, [string, string]>, start: string, target: string): Leg[] {
  const legs: Leg[] = [];
  let cur = target;
  while (cur !== start) {
    const [p, d] = from.get(cur)!;
    legs.unshift({ dir: d, from: p, to: cur });
    cur = p;
  }
  return legs;
}

const isShut = (w: World, s: State, l: Leg): boolean => {
  const ex = w.rooms[l.from]?.exits?.[l.dir];
  return !!ex?.if && !ex.if.every((c) => condOk(w, s, c));
};

let printed = 0;
let shutRoutes = 0;
let midwayRoutes = 0;
let resolvedRoutes = 0;
const graphOffenders = new Map<string, number>();
const stillOffenders = new Map<string, number>();

let { state } = newState(world, 1);
const look = (): void => {
  for (const q of journal(world, state)) {
    if (q.status !== "active" || !q.at || q.at === state.room) continue;
    // the graph's own shape: gates ignored, same search a bearing uses
    const graphFrom = routeTo(world, state, q.at, false);
    if (!graphFrom) continue;
    const legs = legsFrom(graphFrom, state.room, q.at);
    if (!legs.length) continue;
    printed++;
    const shut = legs.filter((l) => isShut(world, state, l));
    if (!shut.length) continue;
    shutRoutes++;
    const midway = shut.filter((l) => l.to !== q.at);
    if (!midway.length) continue;
    midwayRoutes++;
    for (const leg of midway) {
      const key = `${leg.from} ${leg.dir} -> ${leg.to}  (${q.id} points at ${q.at})`;
      graphOffenders.set(key, (graphOffenders.get(key) ?? 0) + 1);
    }

    // what pathTo actually sends the player through: gates respected first
    const openFrom = routeTo(world, state, q.at, true);
    if (openFrom) {
      resolvedRoutes++;
      continue;
    }
    // no open way exists — pathTo falls back to the same graph route printed above
    for (const leg of midway) {
      const key = `${leg.from} ${leg.dir} -> ${leg.to}  (${q.id} points at ${q.at})`;
      stillOffenders.set(key, (stillOffenders.get(key) ?? 0) + 1);
    }
  }
};

look();
// Same replay shape as validate.ts, crawl.ts and the other audit scripts: a
// repeat checks its `until` before the first press, not after, so a step whose
// condition already holds presses nothing. And a label that isn't on the menu
// is a desync between this tool and the world it is measuring — said out loud,
// since a measuring tool's blind spot is worse than no tool at all.
const press = (label: string): boolean => {
  const a = actionByLabel(world, state, label);
  if (!a) {
    console.error(`desync: "${label}" is not on the menu at ${state.room} (t${state.turn}) — the walkthrough and this replay have parted ways`);
    return false;
  }
  state = step(world, state, a).state as State;
  look();
  return true;
};
for (const step_ of world.walkthrough) {
  if (typeof step_ === "string") {
    if (!press(step_)) break;
  } else {
    let k = 0;
    while (!condOk(world, state, step_.until) && k++ < step_.max && !state.ended) if (!press(step_.repeat)) break;
  }
  if (state.ended) break;
}

const pct = (n: number): string => (printed ? `${((n / printed) * 100).toFixed(1)}%` : "—");
console.log(`${printed} routes printed along the walkthrough`);
console.log(`${shutRoutes} cross an exit shut at that moment, in the graph's own shape (${pct(shutRoutes)})`);
console.log(`${midwayRoutes} of those are shut somewhere other than the last leg (${pct(midwayRoutes)}) — a door that is not the objective, in the graph`);
console.log(`${resolvedRoutes} of ${midwayRoutes} pathTo resolves to a currently-open way instead (${midwayRoutes ? ((resolvedRoutes / midwayRoutes) * 100).toFixed(1) : "—"}%)`);
console.log(`${midwayRoutes - resolvedRoutes} still send the player through a shut door before the objective — no open way exists`);
if (!terse && stillOffenders.size) {
  console.log(`\nstill shut, most-printed first (pathTo found no open alternative):`);
  for (const [key, n] of [...stillOffenders].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}x  ${key}`);
}
if (!terse && graphOffenders.size) {
  console.log(`\nthe graph's own shut-midway legs, most-printed first (structural exposure, resolved or not):`);
  for (const [key, n] of [...graphOffenders].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}x  ${key}`);
}
console.log(
  `\nA shut LAST leg is the design: the door is the objective. A shut leg before\nit, in the graph's own shape, is a route through a door that is not the point\n— pathTo now prefers an open way around it when one exists, and only falls\nback to crossing it when none does. Neither is a bearing that lies —\naudit-bearings walks every leg and none lead anywhere but where they say.`,
);
