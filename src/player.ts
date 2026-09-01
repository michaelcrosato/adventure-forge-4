/**
 * tinyforge direct-API player — the fleet lane. No MCP, no agent harness.
 *
 * The engine is a LIBRARY, so the player links it in-process and the model sees
 * only rendered game text over the raw Messages API. What that buys vs a
 * harnessed player (measured against the Claude Code lane):
 *   - prefix is ~0.5k tokens (player charter), not ~43k (harness prompt + tools)
 *   - blindness by construction: the model receives exactly the text we render
 *   - exact per-session token accounting from API usage fields
 *   - pinned model, owned retries, easy 100-way parallelism, Batch-API-able
 * The MCP server stays for interop (humans, any agent harness); this lane is
 * for volume. Same report schema, same queue, same replay-verified receipts.
 *
 *   tsx src/player.ts --count 3 --seed-base 100 --parallel 4      (needs ANTHROPIC_API_KEY)
 *   tsx src/player.ts --mock --count 2                            (zero tokens, proves the driver)
 */
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { inClassPhase, newState, receipt as receiptOf, step } from "./engine.ts";
import { render, renderIntro } from "./format.ts";
import { replayTrace } from "./crawl.ts";
import { loadWorld } from "./validate.ts";
import { triage } from "./triage.ts";
import type { Action, State, World } from "./types.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Build identity a report is bound to: git rev + content hash of the world file. */
export function buildId(worldPath: string): { rev: string; world: string } {
  let rev = "nogit";
  try {
    rev = execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    /* not a repo yet */
  }
  const world = createHash("sha256").update(readFileSync(worldPath)).digest("hex").slice(0, 8);
  return { rev, world };
}

// ---------- provider seam ----------
export type Msg = { role: "user" | "assistant"; content: string };
export type Usage = { in: number; out: number; cacheRead: number; cacheWrite: number };
export type Provider = (system: string, msgs: Msg[], maxTokens: number) => Promise<{ text: string; usage: Usage }>;

export function apiProvider(model: string): Provider {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY not set — use --mock, or export a key");
  return async (system, msgs, maxTokens) => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
          messages: msgs,
        }),
      });
      if (res.status === 429 || res.status >= 500) {
        if (attempt >= 4) throw new Error(`API ${res.status} after retries`);
        await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
        continue;
      }
      if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const j = (await res.json()) as {
        content: { type: string; text?: string }[];
        usage: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };
      };
      return {
        text: j.content.filter((c) => c.type === "text").map((c) => c.text).join(""),
        usage: {
          in: j.usage.input_tokens,
          out: j.usage.output_tokens,
          cacheRead: j.usage.cache_read_input_tokens ?? 0,
          cacheWrite: j.usage.cache_creation_input_tokens ?? 0,
        },
      };
    }
  };
}

/** Scripted stand-in: follows the world's walkthrough by menu label, then files a canned report quoting the real receipt. Proves the whole driver for zero tokens. */
export function mockProvider(world: World): Provider {
  const script = [...world.walkthrough];
  let repeat: { repeat: string; max: number } | null = null;
  return async (_system, msgs, _maxTokens) => {
    const usage: Usage = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };
    const last = msgs[msgs.length - 1]!.content;
    if (/output ONLY.*json report/is.test(last)) {
      const receipt = /receipt:(\S+)/.exec(msgs.map((m) => m.content).join("\n"))?.[1] ?? "";
      const verdict = /\*\*\* WIN/.test(msgs.map((m) => m.content).join("\n")) ? "won" : "lost";
      return {
        text: "```json\n" + JSON.stringify({ verdict, fun: 3, clarity: 3, turns: 0, receipt, bugs: [], confusions: [], suggestions: ["mock run"] }) + "\n```",
        usage,
      };
    }
    const menu = [...last.matchAll(/^(\d+) (.+)$/gm)].map((m) => ({ n: m[1]!, label: m[2]! }));
    const want = () => {
      if (repeat) return repeat.repeat;
      const s = script[0];
      if (typeof s === "string") { script.shift(); return s; }
      if (s) { repeat = s; script.shift(); return s.repeat; }
      return null;
    };
    for (let guard = 0; guard < 3; guard++) {
      const w = want();
      if (!w) return { text: "1", usage };
      const hit = menu.find((m) => m.label.toLowerCase() === w.toLowerCase());
      if (hit) return { text: hit.n, usage };
      repeat = null; // repeat target gone => its until-condition is met; advance
    }
    return { text: "1", usage };
  };
}

// ---------- one blind session, in-process ----------
const SYSTEM = (maxGameTurns: number) => `You are a blind playtester of a text RPG. You see ONLY what the game prints.
Each message is one turn: status, events, scene, then a NUMBERED menu.
Reply with ONE menu number (optionally followed by ":" and 5 words of intent).
Play with intent: explore, talk, take, try to reach a real ending (*** WIN or *** LOSE) within ${maxGameTurns} turns. Getting stuck is a finding — remember where and why.
When asked for your report, output ONLY a fenced \`\`\`json block, no prose.`;

export type SessionResult = {
  seed: number;
  turns: number;
  ended: string | null;
  stalled: boolean;
  report: Record<string, unknown> | null;
  reportError?: string;
  verified: boolean;
  usage: Usage;
  apiCalls: number;
  receipt: string | null;
};

/** End a live session early when nothing is happening — no new room, no score —
 * for this many consecutive turns. A stall is cheaper to stop than to fund, and
 * "stalled at X" is itself a finding. */
export const STALL_AFTER = 12;

export async function playOne(
  world: World,
  seed: number,
  provider: Provider,
  maxGameTurns = 80,
): Promise<SessionResult> {
  const usage: Usage = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };
  let apiCalls = 0;
  const ask: Provider = async (sys, msgs, max) => {
    const r = await provider(sys, msgs, max);
    apiCalls++;
    usage.in += r.usage.in; usage.out += r.usage.out;
    usage.cacheRead += r.usage.cacheRead; usage.cacheWrite += r.usage.cacheWrite;
    return r;
  };
  const system = SYSTEM(maxGameTurns);
  const msgs: Msg[] = [];
  const actions: Action[] = [];
  const seen = new Set<string>();

  let out = newState(world, seed);
  let state: State = out.state;
  if (!inClassPhase(world, state)) seen.add(state.room);
  msgs.push({ role: "user", content: renderIntro(world, state, out.events).text });

  let stalled = false;
  let lastProgress = 0; // turn of last score gain or first-visit
  while (!state.ended && state.turn < maxGameTurns) {
    if (state.turn - lastProgress >= STALL_AFTER) { stalled = true; break; }
    const reply = await ask(system, msgs, 60);
    msgs.push({ role: "assistant", content: reply.text.trim() });
    // accept "3", "3: go north", or structured {"a":3} (provider-compat)
    const parseN = (t: string) => Number(/^\s*(\d+)/.exec(t)?.[1] ?? /"a"\s*:\s*(\d+)/.exec(t)?.[1]);
    let n = parseN(reply.text);
    let menu = render(world, state, []).actions;
    if (!Number.isInteger(n) || n < 1 || n > menu.length) {
      msgs.push({ role: "user", content: `Reply with ONLY a menu number (1-${menu.length}).` });
      const retry = await ask(system, msgs, 20);
      msgs.push({ role: "assistant", content: retry.text.trim() });
      n = parseN(retry.text);
      if (!Number.isInteger(n) || n < 1 || n > menu.length) break; // stuck
    }
    const action = menu[n - 1]!;
    actions.push(action);
    const beforeScore = state.score;
    const res = step(world, state, action);
    state = res.state;
    const first = !seen.has(state.room);
    if (first || state.score > beforeScore) lastProgress = state.turn;
    seen.add(state.room);
    msgs.push({ role: "user", content: render(world, state, res.events, { full: first }).text });
  }

  msgs.push({
    role: "user",
    content: `The session is over. Now output ONLY the fenced json report:
\`\`\`json
{"verdict":"won|lost|quit|stuck","fun":1-5,"clarity":1-5,"turns":${state.turn},"receipt":"<the receipt:... value verbatim, or empty>","bugs":[{"sev":"P0|P1|P2","what":"...","where":"..."}],"confusions":["..."],"suggestions":["..."]}
\`\`\``,
  });
  const rep = await ask(system, msgs, 1000);
  let report: Record<string, unknown> | null = null;
  let reportError: string | undefined;
  try {
    const fence = /```json\s*([\s\S]*?)```/.exec(rep.text);
    if (!fence) throw new Error("no fenced json block");
    report = JSON.parse(fence[1]!) as Record<string, unknown>;
  } catch (e) {
    reportError = String(e);
  }

  // Honesty check: the quoted receipt must equal an in-process replay of the trace.
  const trueReceipt = state.ended ? receiptOf(world, state) : null;
  const replayed = replayTrace(world, { world: world.id, seed, actions });
  const verified =
    !!report && typeof report.receipt === "string" && report.receipt === trueReceipt && replayed === trueReceipt;

  return { seed, turns: state.turn, ended: state.ended?.id ?? null, stalled, report, reportError, verified, usage, apiCalls, receipt: trueReceipt };
}

// ---------- fleet CLI ----------
function fileReport(r: SessionResult, model: string, worldPath: string): string | null {
  if (!r.report) return null;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const item = {
    schema: 1, kind: "playtest", lane: "api", model, ts, seed: r.seed, stalled: r.stalled,
    build: buildId(worldPath), usage: r.usage, api_calls: r.apiCalls, verified: r.verified, ...r.report,
  };
  mkdirSync(join(ROOT, "reports"), { recursive: true });
  const file = join(ROOT, "reports", `playtest-${ts}-s${r.seed}.json`);
  writeFileSync(file, JSON.stringify(item, null, 2));
  return file;
}

if (process.argv[1]?.endsWith("player.ts")) {
  const args = process.argv.slice(2);
  const opt = (f: string, d: string) => (args.includes(f) ? args[args.indexOf(f) + 1]! : d);
  const count = Number(opt("--count", "1"));
  const seedBase = Number(opt("--seed-base", String(Math.floor(Date.now() / 1000) % 100000)));
  const parallel = Number(opt("--parallel", "4"));
  const maxGameTurns = Number(opt("--max-game-turns", "80"));
  const model = opt("--model", process.env.TF_PLAYER_MODEL ?? "claude-haiku-4-5");
  const mock = args.includes("--mock");
  const worldPath = process.env.TF_WORLD ?? join(ROOT, "world", "lighthouse.json");
  const world = loadWorld(worldPath);

  const run = async () => {
    console.log(
      `fleet: ${count} player(s), seeds ${seedBase}+, ${mock ? "MOCK (zero tokens)" : `model ${model}`}, parallel ${parallel}`,
    );
    const seeds = Array.from({ length: count }, (_, i) => seedBase + i);
    const results: SessionResult[] = [];
    let next = 0;
    const worker = async () => {
      while (next < seeds.length) {
        const seed = seeds[next++]!;
        try {
          const provider = mock ? mockProvider(world) : apiProvider(model);
          const r = await playOne(world, seed, provider, maxGameTurns);
          results.push(r);
          const filed = fileReport(r, mock ? "mock" : model, worldPath);
          console.log(
            `  seed ${seed}: ${r.ended ?? (r.stalled ? "stalled" : "no-ending")} in ${r.turns}t | api calls ${r.apiCalls} | tok in ${r.usage.in} out ${r.usage.out} cacheR ${r.usage.cacheRead} cacheW ${r.usage.cacheWrite} | verified:${r.verified}${filed ? ` | ${filed.replace(ROOT + "/", "")}` : ` | REPORT REJECTED (${r.reportError})`}`,
          );
        } catch (e) {
          console.error(`  seed ${seed}: FAILED ${String(e).slice(0, 200)}`);
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(parallel, count) }, worker));
    const tot = results.reduce(
      (a, r) => ({ in: a.in + r.usage.in, out: a.out + r.usage.out, cacheRead: a.cacheRead + r.usage.cacheRead, cacheWrite: a.cacheWrite + r.usage.cacheWrite }),
      { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 },
    );
    console.log(
      `fleet done: ${results.length}/${count} ok, ${results.filter((r) => r.verified).length} verified | totals: in ${tot.in} out ${tot.out} cacheRead ${tot.cacheRead} cacheWrite ${tot.cacheWrite}`,
    );
    const t = triage();
    console.log(`triage: ${t.consumed} report(s) -> ${t.filed.length} new issue(s)${t.skipped ? `, ${t.skipped} already known` : ""}`);
    for (const i of t.filed)
      console.log(`  ${i.priority} ${i.unit_kind} x${i.corroboration}: ${i.title.slice(0, 90)}`);
  };
  run().catch((e) => { console.error(e); process.exit(1); });
}
