/**
 * tinyforge MCP server — the whole play surface in 4 tools.
 *
 * new_game -> intro + first menu. act -> one turn (narration + status + next
 * menu in ONE response, so a whole turn is ONE tool call). look -> resync.
 * status -> objectives recap + progress on every tracked path, any time.
 * Every session appends to a replayable trace in runs/, and the end-of-game
 * receipt is verifiable by `tsx src/crawl.ts --replay <trace>`.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { inClassPhase, inPerkPickPhase, inTalkMode, newState, receipt, step } from "./engine.ts";
import { render, renderIntro, renderStatus } from "./format.ts";
import { loadWorld, validateWorld } from "./validate.ts";
import type { Action, State, Trace, World } from "./types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const RUNS = join(ROOT, "runs");
mkdirSync(RUNS, { recursive: true });

const WORLD_PATH = process.env.TF_WORLD ?? join(ROOT, "world", "reach.json");
const world: World = loadWorld(WORLD_PATH);
{
  // refuse a bad world at boot instead of crashing mid-session
  const errs = validateWorld(world);
  if (errs.length) {
    console.error(`world ${WORLD_PATH} failed validation:`);
    for (const e of errs) console.error(`  - ${e}`);
    process.exit(1);
  }
}

type Session = {
  id: string;
  state: State;
  actions: Action[]; // menu offered for the CURRENT state
  trace: Trace;
  seen: Set<string>; // rooms fully rendered (render memo, not game state)
};
const sessions = new Map<string, Session>();
let counter = 0;

// new_game prints the id as "s=<id>" (a readable label); accept that copied
// verbatim too, so a session id round-trips regardless of which part an
// agent copies.
function resolveSession(s: string): Session | undefined {
  return sessions.get(s) ?? sessions.get(s.replace(/^s=/, ""));
}

function flush(sess: Session): void {
  if (sess.state.ended) sess.trace.receipt = receipt(world, sess.state);
  writeFileSync(join(RUNS, `${sess.id}.json`), JSON.stringify(sess.trace));
}

function view(sess: Session, events: string[], full: boolean): string {
  const first = !sess.seen.has(sess.state.room);
  if (!sess.state.ended && !inClassPhase(world, sess.state) && !inPerkPickPhase(world, sess.state) && !inTalkMode(world, sess.state))
    sess.seen.add(sess.state.room);
  const r = render(world, sess.state, events, { full: full || first });
  sess.actions = r.actions;
  return r.text;
}

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });

const server = new McpServer({ name: "tinyforge", version: "0.1.0" });

server.registerTool(
  "new_game",
  {
    description:
      "Start a session. Returns the intro, the scene, and a numbered action menu. Play by calling act with a menu number — every act response already contains the next scene and menu, so you never need a second call per turn.",
    inputSchema: { seed: z.number().int().optional().describe("Determinism seed (default: random).") },
  },
  async ({ seed }) => {
    const s = seed ?? Math.floor(Math.random() * 1e9);
    const id = `g${++counter}-${s}-${Date.now().toString(36)}`; // nonce keeps trace files distinct across server restarts
    const out = newState(world, s);
    const sess: Session = {
      id,
      state: out.state,
      actions: [],
      trace: { world: world.id, seed: s, actions: [] },
      seen: new Set(),
    };
    sessions.set(id, sess);
    const intro = renderIntro(world, sess.state, out.events);
    sess.actions = intro.actions;
    if (!inClassPhase(world, sess.state)) sess.seen.add(sess.state.room);
    flush(sess);
    return text(`s=${id}\n${intro.text}`);
  },
);

server.registerTool(
  "act",
  {
    description:
      "Take ONE action by menu number. Returns what happened, the scene, and the next numbered menu. " +
      "On a game-ending response, the receipt: line is a verification code proving your reported outcome matches this run (not a game score) — copy it verbatim if you file a report.",
    inputSchema: {
      s: z.string().describe("Session id from new_game."),
      a: z.number().int().describe("Menu number (1-based) from the latest response."),
    },
  },
  async ({ s, a }) => {
    const sess = resolveSession(s);
    if (!sess) return text(`No such session ${s}. Call new_game.`);
    if (sess.state.ended)
      return text(`Game over.\n${render(world, sess.state, []).text}`);
    const action = sess.actions[a - 1];
    if (!action)
      return text(`No action ${a}. Menu:\n${view(sess, [], false)}`);
    const before = sess.state.room;
    const out = step(world, sess.state, action);
    sess.state = out.state;
    sess.trace.actions.push(action);
    flush(sess);
    const moved = sess.state.room !== before;
    return text(view(sess, out.events, moved && !sess.seen.has(sess.state.room)));
  },
);

server.registerTool(
  "look",
  {
    description:
      "Re-show the current scene, your inventory, and the menu in full. Costs no turn — call it any time, including just to check what you're carrying.",
    inputSchema: { s: z.string().describe("Session id.") },
  },
  async ({ s }) => {
    const sess = resolveSession(s);
    if (!sess) return text(`No such session ${s}. Call new_game.`);
    return text(view(sess, [], true));
  },
);

server.registerTool(
  "status",
  {
    description:
      "Recap the objectives, show progress on every tracked path (e.g. verses vs crown), list every location you've visited so far, confirm what you're carrying and which perks you hold, and total your current check and combat modifiers (attributes + perks, already summed). The counts shown are always exact and current, never stale. Costs no turn — call it any time, not just at character select, e.g. right before a major choice, whenever you want a 'show verses' summary of what you've found and where you've been, or whenever you want to double-check your build instead of re-summing perks by hand.",
    inputSchema: { s: z.string().describe("Session id.") },
  },
  async ({ s }) => {
    const sess = resolveSession(s);
    if (!sess) return text(`No such session ${s}. Call new_game.`);
    return text(renderStatus(world, sess.state));
  },
);

await server.connect(new StdioServerTransport());
