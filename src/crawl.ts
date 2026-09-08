/**
 * tinyforge crawler — Tier 1: mechanical, deterministic, zero LLM.
 *
 * Seeded random walks over the real engine, checking invariants every step:
 *   CRASH     step() threw
 *   EMPTYMENU no legal actions while the game is still open
 *   DESYNC    stepping the same state twice gave different hashes (impurity)
 *   BOUNDS    hp/score/turn outside their contracts
 *   HOLE      the rendered turn or status contains "undefined", "null", "NaN",
 *             or "[object Object]" — a missing content field the validator's
 *             reference checks cannot see, printed as-is to the player
 * Also replays the walkthrough and prints coverage (rooms seen, endings seen)
 * plus two NUMBERS that are deliberately not findings yet:
 *
 *   over-cap menus  rooms offering more than MENU_CAP options. The validator
 *                   already errors on this ("walkthrough: menu hit N > cap"),
 *                   so it is a hard contract — but it can only see the
 *                   walkthrough, and off it `world/vale.json` reaches 15 in
 *                   `square` and `throne`. Fixing that means folding the
 *                   Vale's npc topics behind `talk to X` the way the Reach
 *                   does, which re-captures its walkthrough and all seven
 *                   proofs. Until that lands this is a count, not a finding:
 *                   red here would block every author on the realm for a
 *                   defect none of them introduced.
 *   biggest screen  the largest response a walk rendered, as a player would
 *                   see it. `test/budget.test.ts` holds each world to 1100
 *                   characters along its proven walkthrough only, so nothing
 *                   measures a screen off it — and two ending proofs already
 *                   render 1107 and 1148.
 *
 * Both go in the summary line so the truth is in front of every `npm run
 * verify`, and both become findings the moment the shipped worlds are clean.
 * Exit 0 = green. `--replay <trace.json>` re-runs a recorded session and
 * prints its receipt (used to verify playtest reports).
 */
import { readFileSync, readdirSync } from "node:fs";
import { hashState, legalActions, newState, receipt, step } from "./engine.ts";
import { render, renderStatus } from "./format.ts";
import { MENU_CAP } from "./types.ts";
import { loadWorld, replayWalkthrough } from "./validate.ts";
import type { Trace, World } from "./types.ts";

const HOLE = /\b(?:undefined|null|NaN|\[object Object\])\b/;

function walkRng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function crawl(world: World, walks: number, maxSteps: number): {
  findings: string[];
  roomsSeen: Set<string>;
  endingsSeen: Set<string>;
  steps: number;
  worst: { chars: number; room: string; turn: number };
  overCap: { count: number; worstN: number; room: string };
} {
  const findings: string[] = [];
  const roomsSeen = new Set<string>();
  const endingsSeen = new Set<string>();
  let steps = 0;
  let worst = { chars: 0, room: "", turn: 0 };
  const overCap = { count: 0, worstN: 0, room: "" };

  for (let w = 0; w < walks && findings.length < 20; w++) {
    const rnd = walkRng(1000 + w);
    let { state } = newState(world, w + 1);
    const seenThisWalk = new Set<string>([state.room]);
    roomsSeen.add(state.room);
    for (let i = 0; i < maxSteps; i++) {
      if (state.ended) { endingsSeen.add(state.ended.id); break; }
      const legal = legalActions(world, state);
      if (!legal.length) { findings.push(`EMPTYMENU walk ${w} turn ${state.turn} room ${state.room}`); break; }
      if (legal.length > MENU_CAP) {
        overCap.count++;
        if (legal.length > overCap.worstN) { overCap.worstN = legal.length; overCap.room = state.room; }
      }
      const a = legal[Math.floor(rnd() * legal.length)]!;
      let out;
      try {
        out = step(world, state, a);
        // purity check: same state + same action twice must be identical
        const again = step(world, state, a);
        if (hashState(out.state) !== hashState(again.state)) {
          findings.push(`DESYNC walk ${w} turn ${state.turn} action ${JSON.stringify(a)}`);
          break;
        }
      } catch (e) {
        findings.push(`CRASH walk ${w} turn ${state.turn} action ${JSON.stringify(a)}: ${String(e)}`);
        break;
      }
      const firstHere = !seenThisWalk.has(out.state.room);
      state = out.state;
      steps++;
      seenThisWalk.add(state.room);
      roomsSeen.add(state.room);
      if (state.hp < 0 || state.hp > state.maxHp) findings.push(`BOUNDS hp=${state.hp}/${state.maxHp} walk ${w}`);
      if (state.score < 0 || state.score > world.maxScore) findings.push(`BOUNDS score=${state.score} walk ${w}`);
      // `full: true` for the hole check, so a first-visit-only desc is searched too
      const full = render(world, state, out.events, { full: true }).text;
      const hole = HOLE.exec(`${full}\n${renderStatus(world, state)}`);
      if (hole) findings.push(`HOLE walk ${w} turn ${state.turn} room ${state.room} action ${JSON.stringify(a)}: "${hole[0]}" in output`);
      // ...and the honest render for the size, the way a player would see it:
      // the long desc only the first time this walk reached the room
      const asPlayed = firstHere ? full : render(world, state, out.events, {}).text;
      if (asPlayed.length > worst.chars) worst = { chars: asPlayed.length, room: state.room, turn: state.turn };
    }
  }
  return { findings, roomsSeen, endingsSeen, steps, worst, overCap };
}

export function replayTrace(world: World, trace: Trace): string {
  let { state } = newState(world, trace.seed);
  for (const a of trace.actions) state = step(world, state, a).state;
  return receipt(world, state);
}

// ---------- CLI ----------
if (process.argv[1]?.endsWith("crawl.ts")) {
  const args = process.argv.slice(2);

  if (args.includes("--replay")) {
    const tracePath = args[args.indexOf("--replay") + 1]!;
    const trace = JSON.parse(readFileSync(tracePath, "utf8")) as Trace;
    // the same world selection every entry point uses; a trace names its world
    // id, which is the default file name under world/
    const world = loadWorld(process.env.TF_WORLD ?? `world/${trace.world}.json`);
    console.log(replayTrace(world, trace));
    process.exit(0);
  }

  const explicit = args.find((a) => a.endsWith(".json") && !a.includes("runs/"));
  const paths = explicit
    ? [explicit]
    : readdirSync("world").filter((f) => f.endsWith(".json")).map((f) => `world/${f}`);
  const walks = args.includes("--deep") ? 400 : 60;
  const maxSteps = args.includes("--deep") ? 300 : 120;
  let bad = 0;
  for (const p of paths) {
    const world = loadWorld(p);
    const t0 = Date.now();
    const r = crawl(world, walks, maxSteps);
    const wt = replayWalkthrough(world, 1);
    if (wt.error) r.findings.push(`WALKTHROUGH ${wt.error}`);
    const rooms = Object.keys(world.rooms).length;
    console.log(
      `crawl ${world.id}: ${walks} walks, ${r.steps} steps, ${Date.now() - t0}ms | rooms ${r.roomsSeen.size}/${rooms} | endings seen: ${[...r.endingsSeen].join(",") || "none"} | biggest screen ${r.worst.chars} (${r.worst.room || "-"}) | over-cap menus ${r.overCap.count}${r.overCap.count ? ` (worst ${r.overCap.worstN} in ${r.overCap.room})` : ""} | walkthrough: ${wt.error ?? `win in ${wt.turns}t`}`,
    );
    if (r.findings.length) {
      bad++;
      for (const f of r.findings) console.error(`  ✗ ${f}`);
    }
  }
  process.exit(bad ? 1 : 0);
}
