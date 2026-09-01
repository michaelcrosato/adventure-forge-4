/**
 * tinyforge crawler — Tier 1: mechanical, deterministic, zero LLM.
 *
 * Seeded random walks over the real engine, checking invariants every step:
 *   CRASH     step() threw
 *   EMPTYMENU no legal actions while the game is still open
 *   DESYNC    stepping the same state twice gave different hashes (impurity)
 *   BOUNDS    hp/score/turn outside their contracts
 * Also replays the walkthrough and prints coverage (rooms seen, endings seen).
 * Exit 0 = green. `--replay <trace.json>` re-runs a recorded session and
 * prints its receipt (used to verify playtest reports).
 */
import { readFileSync } from "node:fs";
import { hashState, legalActions, newState, receipt, step } from "./engine.ts";
import { loadWorld, replayWalkthrough } from "./validate.ts";
import type { Trace, World } from "./types.ts";

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
} {
  const findings: string[] = [];
  const roomsSeen = new Set<string>();
  const endingsSeen = new Set<string>();
  let steps = 0;

  for (let w = 0; w < walks && findings.length < 20; w++) {
    const rnd = walkRng(1000 + w);
    let { state } = newState(world, w + 1);
    roomsSeen.add(state.room);
    for (let i = 0; i < maxSteps; i++) {
      if (state.ended) { endingsSeen.add(state.ended.id); break; }
      const legal = legalActions(world, state);
      if (!legal.length) { findings.push(`EMPTYMENU walk ${w} turn ${state.turn} room ${state.room}`); break; }
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
      state = out.state;
      steps++;
      roomsSeen.add(state.room);
      if (state.hp < 0 || state.hp > world.hp) findings.push(`BOUNDS hp=${state.hp} walk ${w}`);
      if (state.score < 0 || state.score > world.maxScore) findings.push(`BOUNDS score=${state.score} walk ${w}`);
    }
  }
  return { findings, roomsSeen, endingsSeen, steps };
}

export function replayTrace(world: World, trace: Trace): string {
  let { state } = newState(world, trace.seed);
  for (const a of trace.actions) state = step(world, state, a).state;
  return receipt(world, state);
}

// ---------- CLI ----------
if (process.argv[1]?.endsWith("crawl.ts")) {
  const args = process.argv.slice(2);
  const worldPath = args.find((a) => a.endsWith(".json") && !a.includes("runs/")) ?? "world/lighthouse.json";

  if (args.includes("--replay")) {
    const tracePath = args[args.indexOf("--replay") + 1]!;
    const trace = JSON.parse(readFileSync(tracePath, "utf8")) as Trace;
    const world = loadWorld(`world/${trace.world}.json`);
    console.log(replayTrace(world, trace));
    process.exit(0);
  }

  const world = loadWorld(worldPath);
  const walks = args.includes("--deep") ? 400 : 60;
  const maxSteps = args.includes("--deep") ? 300 : 120;
  const t0 = Date.now();
  const r = crawl(world, walks, maxSteps);
  const wt = replayWalkthrough(world, 1);
  if (wt.error) r.findings.push(`WALKTHROUGH ${wt.error}`);
  const rooms = Object.keys(world.rooms).length;
  console.log(
    `crawl: ${walks} walks, ${r.steps} steps, ${Date.now() - t0}ms | rooms ${r.roomsSeen.size}/${rooms} | endings seen: ${[...r.endingsSeen].join(",") || "none"} | walkthrough: ${wt.error ?? `win in ${wt.turns}t`}`,
  );
  if (r.findings.length) {
    for (const f of r.findings) console.error(`  ✗ ${f}`);
    process.exit(1);
  }
  process.exit(0);
}
