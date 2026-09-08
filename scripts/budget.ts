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

// piping to `head` closes stdout mid-write, which node turns into an unhandled
// EPIPE and a stack trace over the numbers you were reading. Authors pipe.
process.stdout.on("error", (e: NodeJS.ErrnoException) => { if (e.code === "EPIPE") process.exit(0); });

const [path, ...rest] = process.argv.slice(2);
if (!path) { console.error("usage: node --import tsx scripts/budget.ts <world.json> [--top N] [--terse]"); process.exit(2); }
const top = rest.includes("--top") ? Number(rest[rest.indexOf("--top") + 1]) : 5;
const terse = rest.includes("--terse");
const world: World = loadWorld(path);

type Screen = { n: number; chars: number; room: string; label: string };

/** Replay one route (the walkthrough, or an ending proof) and measure every screen it renders. */
function walk(steps: World["walkthrough"], what: string): { screens: Screen[]; intro: ReturnType<typeof renderIntro> } {
  let { state, events } = newState(world, 1);
  const seen = new Set<string>([state.room]);
  const intro = renderIntro(world, state, events);
  const screens: Screen[] = [];
  const doLabel = (label: string) => {
    const a = actionByLabel(world, state, label);
    if (!a) { console.error(`${what} is broken at screen ${screens.length + 1}: no action "${label}" in ${state.room}`); process.exit(1); }
    const before: State = state;
    const out = step(world, state, a);
    state = out.state;
    const first = state.room !== before.room && !seen.has(state.room);
    seen.add(state.room);
    screens.push({ n: screens.length + 1, chars: render(world, state, out.events, { full: first }).text.length, room: state.room, label });
  };
  for (const w of steps) {
    if (typeof w === "string") doLabel(w);
    else { let n = 0; while (!condOk(world, state, w.until) && n++ < w.max && !state.ended) doLabel(w.repeat); }
    if (state.ended) break;
  }
  return { screens, intro };
}

const { screens, intro } = walk(world.walkthrough, "the walkthrough");

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

// Every other proven route, measured the same way. The walkthrough is one road
// through the realm and the only one the ceilings were ever checked against;
// five of the eight ending proofs render a screen past MAX_MAX, two of them a
// whole conversation's worth past it. A player on any of those roads is a real
// player, so the numbers belong here where an author will see them.
const proofs = Object.entries(world.proofs ?? {});
if (proofs.length) {
  console.log();
  console.log(`the other proven routes (the same ceilings, ${AVG_MAX} avg and ${MAX_MAX} max):`);
  for (const [key, steps] of proofs) {
    const r = walk(steps, `proofs.${key}`).screens;
    if (!r.length) continue;
    const s2 = r.reduce((a, x) => a + x.chars, 0), avg2 = s2 / r.length;
    const w2 = r.reduce((a, x) => (x.chars > a.chars ? x : a), r[0]!);
    const flags = [avg2 > AVG_MAX ? `avg OVER by ${(avg2 - AVG_MAX).toFixed(0)}` : "", w2.chars > MAX_MAX ? `max OVER by ${w2.chars - MAX_MAX}` : ""].filter(Boolean).join(", ");
    console.log(`  ${key.padEnd(28)} ${String(r.length).padStart(3)} screens  avg ${avg2.toFixed(0).padStart(4)}  max ${String(w2.chars).padStart(4)} (${w2.room})${flags ? `   ${flags}` : ""}`);
  }
}
