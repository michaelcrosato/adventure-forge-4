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
import { inClassPhase, inPerkPickPhase, newState, receipt as receiptOf, step } from "./engine.ts";
import { matchesMenuLabel, render, renderIntro } from "./format.ts";
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

/**
 * Find a rendered menu entry for a canonical walkthrough label. Exact match
 * first (two labels can differ only by a trailing parenthetical, e.g. "weigh
 * the two roads" and "weigh the two roads (scout)"), then the hint-tolerant
 * rule from format.ts, since menu text carries display-only " (…)" suffixes
 * from oddsHint that are never part of the canonical label.
 */
export function findMenuEntry<T extends { label: string }>(menu: T[], want: string): T | undefined {
  const w = want.trim().toLowerCase();
  return menu.find((m) => m.label.trim().toLowerCase() === w) ?? menu.find((m) => matchesMenuLabel(m.label, want));
}

/**
 * Scripted stand-in: follows the world's walkthrough by menu label, then files
 * a canned report quoting the real receipt. Proves the whole driver for zero
 * tokens. An ordinary step that is not on the menu is an error (the session
 * would otherwise silently drift off the proven path and file a bogus stall);
 * only a `repeat` step may vanish from the menu, which means its until-condition
 * is met.
 */
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
    const want = (): { label: string; repeat: boolean } | null => {
      if (repeat) return { label: repeat.repeat, repeat: true };
      const s = script.shift();
      if (typeof s === "string") return { label: s, repeat: false };
      if (s) { repeat = s; return { label: s.repeat, repeat: true }; }
      return null;
    };
    for (;;) {
      const w = want();
      if (!w) return { text: "1", usage }; // script exhausted with the game still open: nothing left to follow
      const hit = findMenuEntry(menu, w.label);
      if (hit) return { text: hit.n, usage };
      if (!w.repeat) throw new Error(`mock: walkthrough step "${w.label}" is not on the menu:\n${last}`);
      repeat = null; // repeat target gone => its until-condition is met; advance
    }
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

/** Start reminding the player it's running low on turns this many turns before
 * the session's cap — the cap was previously silent, so a session could hit it
 * with zero warning (a real playtest finding). */
export const TURN_WARNING_AT = 10;

/** Countdown line appended to a turn's scene once close to the turn budget, or "" otherwise. */
export function turnWarning(turn: number, maxGameTurns: number): string {
  const remaining = maxGameTurns - turn;
  if (remaining <= 0 || remaining > TURN_WARNING_AT) return "";
  return `\n(${remaining} turn${remaining === 1 ? "" : "s"} left before this session ends.)`;
}

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
    const menu = render(world, state, []).actions;
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
    if (!inClassPhase(world, state) && !inPerkPickPhase(world, state)) seen.add(state.room);
    const scene = render(world, state, res.events, { full: first }).text;
    msgs.push({ role: "user", content: scene + turnWarning(state.turn, maxGameTurns) });
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
    const parsed = JSON.parse(fence[1]!) as unknown;
    const shapeErrs = reportShapeErrors(parsed);
    if (shapeErrs.length) throw new Error(`report shape: ${shapeErrs.join("; ")}`);
    report = acceptReport(parsed as Record<string, unknown>);
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

// ---------- report shape ----------
/**
 * The fields a player's report may contribute, and nothing else. Everything
 * the host knows better — verified, seed, build, usage, the actual ending —
 * is written by the host AFTER these, so a report can never overwrite it.
 * loop/report-check.mjs applies the same rule to the MCP lane.
 */
export const REPORT_FIELDS = ["verdict", "fun", "clarity", "turns", "receipt", "bugs", "confusions", "suggestions"] as const;
export const VERDICTS = ["won", "lost", "quit", "stuck"] as const;

/** Why a parsed report is not a report — empty when it is. Mirrors loop/report-check.mjs. */
export function reportShapeErrors(v: unknown): string[] {
  if (!v || typeof v !== "object" || Array.isArray(v)) return ["report must be a JSON object"];
  const r = v as Record<string, unknown>;
  const errs: string[] = [];
  const num = (k: string, lo: number, hi: number) => {
    const x = r[k];
    if (typeof x !== "number" || x < lo || x > hi) errs.push(`${k} must be ${lo}..${hi}`);
  };
  if (!(VERDICTS as readonly unknown[]).includes(r.verdict)) errs.push(`verdict must be ${VERDICTS.join("|")}`);
  num("fun", 1, 5);
  num("clarity", 1, 5);
  if (!Array.isArray(r.bugs)) errs.push("bugs must be an array");
  if (!Array.isArray(r.suggestions)) errs.push("suggestions must be an array");
  if (typeof r.receipt !== "string") errs.push("receipt must be quoted verbatim");
  return errs;
}

/** Copy only the supported report fields (drops anything that could shadow host metadata). */
export function acceptReport(r: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of REPORT_FIELDS) if (k in r) out[k] = r[k];
  return out;
}

// ---------- fleet CLI ----------
/** Ground-truth ending id (distinct per ending, e.g. multiple ids per world when a
 * world offers more than one route to a win) — lets analysis across playtests see
 * which route players actually took without parsing the receipt string. */
export function fileReport(r: SessionResult, model: string, worldPath: string): string | null {
  if (!r.report) return null;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  // accepted report fields first, host-controlled metadata last: the host's
  // values win even if a report somehow carried a same-named key
  const item = {
    ...acceptReport(r.report),
    schema: 1, kind: "playtest", lane: "api", model, ts, seed: r.seed, stalled: r.stalled,
    build: buildId(worldPath), usage: r.usage, api_calls: r.apiCalls, verified: r.verified, ending: r.ended,
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
  const worldPath = process.env.TF_WORLD ?? join(ROOT, "world", "vale.json");
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
