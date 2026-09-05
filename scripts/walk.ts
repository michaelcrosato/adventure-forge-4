/**
 * Walkthrough assistant for authors: replays a list of menu labels against a
 * world at seed 1, inserting a perk pick wherever a level-up blocks the menu
 * (the first eligible perk, or one named with --perk), and prints the resolved
 * label list as JSON — ready to paste into `walkthrough` or `proofs`. On a
 * label that is not on the menu it prints the room, the turn, and the menu.
 *
 *   node --import tsx scripts/walk.ts world/reach.json steps.json [--perk "Second Wind"] [--show]
 *
 * steps.json is a JSON array of labels (repeat steps are passed through).
 */
import { readFileSync } from "node:fs";
import { actionByLabel, actionLabel, condOk, legalActions, newState, step } from "../src/engine.ts";
import { render } from "../src/format.ts";
import { loadWorld } from "../src/validate.ts";
import type { WalkStep } from "../src/types.ts";

const [worldPath, stepsPath, ...rest] = process.argv.slice(2);
if (!worldPath || !stepsPath) {
  console.error("usage: node --import tsx scripts/walk.ts <world.json> <steps.json> [--perk name] [--show]");
  process.exit(2);
}
const perkPref = rest.includes("--perk") ? rest[rest.indexOf("--perk") + 1] : undefined;
const show = rest.includes("--show");
const world = loadWorld(worldPath);
const steps = JSON.parse(readFileSync(stepsPath, "utf8")) as WalkStep[];

let { state } = newState(world, 1);
const out: WalkStep[] = [];
const seen = new Set<string>();
let ok = true;

const pickPerk = () => {
  const menu = legalActions(world, state);
  if (!menu.length || menu[0]!.kind !== "perkpick") return false;
  const labels = menu.map((a) => actionLabel(world, a, state));
  const chosen = labels.find((l) => perkPref && l.includes(perkPref)) ?? labels[0]!;
  state = step(world, state, actionByLabel(world, state, chosen)!).state;
  out.push(chosen);
  console.error(`  [level-up at turn ${state.turn}: picked "${chosen}"]`);
  return true;
};

const doLabel = (label: string): boolean => {
  // a walkthrough may name its own perk picks; only auto-pick when the step is something else
  while (!label.startsWith("perk:") && pickPerk()) { /* drain level-ups first */ }
  const a = actionByLabel(world, state, label);
  if (!a) {
    console.error(`\n✗ no legal action "${label}" at ${state.room} (turn ${state.turn}). Menu:`);
    for (const x of legalActions(world, state)) console.error(`    ${actionLabel(world, x, state)}`);
    return false;
  }
  const before = state.room;
  const res = step(world, state, a);
  state = res.state;
  if (show) {
    const first = state.room !== before && !seen.has(state.room);
    console.error(render(world, state, res.events, { full: first }).text + "\n");
  }
  seen.add(state.room);
  return true;
};

for (const w of steps) {
  if (typeof w === "string") {
    if (!doLabel(w)) { ok = false; break; }
    out.push(w);
  } else {
    let n = 0;
    while (!condOk(world, state, w.until) && n++ < w.max && !state.ended) if (!doLabel(w.repeat)) { ok = false; break; }
    if (!ok) break;
    out.push(w);
  }
  if (state.ended) break;
}
while (!state.ended && pickPerk()) { /* a level-up on the last step */ }

console.error(`\n${ok ? "✓" : "✗"} ${state.turn} turns, room ${state.room}, score ${state.score}/${world.maxScore}, hp ${state.hp}/${state.maxHp}, level ${state.level}, ended ${state.ended?.id ?? "no"}`);
console.log(JSON.stringify(out));
process.exit(ok ? 0 : 1);
