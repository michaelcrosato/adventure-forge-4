/**
 * tinyforge blind-play driver — one command per turn, no server, no readline.
 *
 * For playtesters that live in a shell (an agent with a Bash tool) rather than
 * behind an MCP client. Every call rebuilds the session from its recorded trace
 * in runs/, so the trace is the only truth and the receipt on the final screen
 * verifies by replay exactly like the MCP lane's (`loop/report-check.mjs`).
 *
 *   tsx src/turn.ts new <seed>            start; prints "s=<id>", the intro, the first menu
 *   tsx src/turn.ts act <id> <n>          take menu entry n; prints the next turn
 *   tsx src/turn.ts look <id>             re-show the scene in full (free)
 *   tsx src/turn.ts status <id>           journal, party, inventory, modifiers (free)
 *   tsx src/turn.ts labels <id>           the session's actions as walkthrough labels (for proofs)
 *
 * TF_WORLD picks the world file (default world/vale.json, same as every entry point).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { actionLabel, inClassPhase, inPerkPickPhase, inTalkMode, newState, receipt, step } from "./engine.ts";
import { render, renderIntro, renderStatus } from "./format.ts";
import { loadWorld } from "./validate.ts";
import type { Action, State, Trace, World } from "./types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUNS = join(ROOT, "runs");
const WORLD_PATH = process.env.TF_WORLD ?? join(ROOT, "world", "vale.json");

type Built = { state: State; seen: Set<string>; events: string[]; menu: Action[] };

/** Replay a trace from the start, keeping the same first-visit render memo a live session keeps. */
function build(world: World, trace: Trace): Built {
  let out = newState(world, trace.seed);
  let state = out.state;
  let events = out.events;
  const seen = new Set<string>();
  const memo = () => {
    if (!state.ended && !inClassPhase(world, state) && !inPerkPickPhase(world, state) && !inTalkMode(world, state)) seen.add(state.room);
  };
  memo();
  for (const a of trace.actions) {
    out = step(world, state, a);
    state = out.state;
    events = out.events;
    memo();
  }
  return { state, seen, events, menu: render(world, state, []).actions };
}

const tracePath = (id: string) => join(RUNS, `${id}.json`);
const readTrace = (id: string): Trace => JSON.parse(readFileSync(tracePath(id.replace(/^s=/, "")), "utf8")) as Trace;
const writeTrace = (id: string, t: Trace) => writeFileSync(tracePath(id), JSON.stringify(t));

function main(argv: string[]): void {
  const [cmd, ...rest] = argv;
  const world = loadWorld(WORLD_PATH);
  mkdirSync(RUNS, { recursive: true });
  switch (cmd) {
    case "new": {
      const seed = Number(rest[0]);
      if (!Number.isInteger(seed)) throw new Error("usage: new <seed>");
      // a nonce keeps trace files distinct across sessions on the same seed;
      // Date is fine here — this file is an I/O edge, not the engine core
      const id = `b${seed}-${Date.now().toString(36)}`;
      const trace: Trace = { world: world.id, seed, actions: [] };
      writeTrace(id, trace);
      const { state, events } = newState(world, seed);
      console.log(`s=${id}\n${renderIntro(world, state, events).text}`);
      return;
    }
    case "act": {
      const id = (rest[0] ?? "").replace(/^s=/, "");
      const n = Number(rest[1]);
      const trace = readTrace(id);
      const b = build(world, trace);
      if (b.state.ended) { console.log(`Game over.\n${render(world, b.state, []).text}`); return; }
      const action = b.menu[n - 1];
      if (!action) { console.log(`No action ${n}. Menu:\n${render(world, b.state, [], { full: false }).text}`); return; }
      const before = b.state.room;
      const out = step(world, b.state, action);
      trace.actions.push(action);
      if (out.state.ended) trace.receipt = receipt(world, out.state);
      writeTrace(id, trace);
      const moved = out.state.room !== before;
      const full = moved && !b.seen.has(out.state.room);
      console.log(render(world, out.state, out.events, { full }).text);
      return;
    }
    case "look": {
      const b = build(world, readTrace(rest[0] ?? ""));
      console.log(render(world, b.state, [], { full: true }).text);
      return;
    }
    case "status": {
      const b = build(world, readTrace(rest[0] ?? ""));
      console.log(renderStatus(world, b.state));
      return;
    }
    case "labels": {
      const trace = readTrace(rest[0] ?? "");
      let { state } = newState(world, trace.seed);
      const labels: string[] = [];
      for (const a of trace.actions) {
        labels.push(actionLabel(world, a, state));
        state = step(world, state, a).state;
      }
      console.log(JSON.stringify(labels));
      return;
    }
    default:
      console.error("usage: tsx src/turn.ts new <seed> | act <id> <n> | look <id> | status <id> | labels <id>");
      process.exit(2);
  }
}

main(process.argv.slice(2));
