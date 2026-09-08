/**
 * The token budget, measured — the same replay `test/budget.test.ts` asserts,
 * printed instead of asserted.
 *
 * The test says pass or fail. An author changing content needs the number: how
 * much room is left, which screens are eating it, and whether a change moved
 * the walkthrough at all. Every agent working on this realm was re-deriving
 * that by hand, which means the numbers in their reports could not be checked
 * without re-deriving them again. So: one tool, one set of numbers.
 *
 *   node --import tsx scripts/budget.ts world/reach.json [--top 8] [--terse]
 *
 * `--terse` prints one line, for a before/after diff:
 *   avg 449.9257 max 1076 sum 121030 screens 269
 */
import { actionByLabel, condOk, newState, step } from "../src/engine.ts";
import { render, renderIntro } from "../src/format.ts";
import { loadWorld } from "../src/validate.ts";
import type { State, World } from "../src/types.ts";

// the same three ceilings test/budget.test.ts enforces — kept in step by hand,
// and the test is the one that decides
const AVG_MAX = 450, MAX_MAX = 1100, INTRO_MAX = 1400;

const [path, ...rest] = process.argv.slice(2);
if (!path) { console.error("usage: node --import tsx scripts/budget.ts <world.json> [--top N] [--terse]"); process.exit(2); }
const top = rest.includes("--top") ? Number(rest[rest.indexOf("--top") + 1]) : 5;
const terse = rest.includes("--terse");
const world: World = loadWorld(path);

let { state, events } = newState(world, 1);
const seen = new Set<string>([state.room]);
const intro = renderIntro(world, state, events);

type Screen = { n: number; chars: number; room: string; label: string };
const screens: Screen[] = [];
const doLabel = (label: string) => {
  const a = actionByLabel(world, state, label);
  if (!a) { console.error(`the walkthrough is broken at screen ${screens.length + 1}: no action "${label}" in ${state.room}`); process.exit(1); }
  const before: State = state;
  const out = step(world, state, a);
  state = out.state;
  const first = state.room !== before.room && !seen.has(state.room);
  seen.add(state.room);
  screens.push({ n: screens.length + 1, chars: render(world, state, out.events, { full: first }).text.length, room: state.room, label });
};
for (const w of world.walkthrough) {
  if (typeof w === "string") doLabel(w);
  else { let n = 0; while (!condOk(world, state, w.until) && n++ < w.max && !state.ended) doLabel(w.repeat); }
  if (state.ended) break;
}

const sum = screens.reduce((a, s) => a + s.chars, 0);
const avg = sum / screens.length;
const worst = screens.reduce((a, s) => (s.chars > a.chars ? s : a), screens[0]!);

if (terse) {
  console.log(`avg ${avg.toFixed(4)} max ${worst.chars} sum ${sum} screens ${screens.length}`);
  process.exit(0);
}

const bar = (v: number, cap: number) => `${v > cap ? "OVER by" : "ok,   "} ${Math.abs(cap - v).toFixed(v % 1 ? 2 : 0).padStart(6)} left`;
console.log(`${path} — ${world.id}: ${screens.length} screens along the proven walkthrough`);
console.log(`  avg   ${avg.toFixed(4).padStart(9)} / ${AVG_MAX}   ${bar(avg, AVG_MAX)}`);
console.log(`  max   ${String(worst.chars).padStart(9)} / ${MAX_MAX}   ${bar(worst.chars, MAX_MAX)}   (screen ${worst.n}, ${worst.room})`);
console.log(`  intro ${String(intro.text.length).padStart(9)} / ${INTRO_MAX}   ${bar(intro.text.length, INTRO_MAX)}`);
console.log(`  sum   ${String(sum).padStart(9)}   (~${Math.round(sum / 3.8 / 1000)}k tokens of game text for a whole win)`);
console.log();
console.log(`the avg ceiling is the binding one: ${(AVG_MAX * screens.length - sum).toFixed(0)} characters of slack across all ${screens.length}`);
console.log(`screens — one added line on every screen is about ${screens.length * 30} of them. A screen the`);
console.log(`walkthrough never reaches costs nothing here and is not measured by anything else,`);
console.log(`so "it did not move the budget" is not the same as "a player will never see it".`);
console.log();
console.log(`the ${top} biggest screens:`);
for (const s of [...screens].sort((a, b) => b.chars - a.chars).slice(0, top)) {
  console.log(`  ${String(s.chars).padStart(5)}  screen ${String(s.n).padStart(3)}  ${s.room.padEnd(24)} ${s.label}`);
}
