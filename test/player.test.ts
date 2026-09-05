/**
 * The direct-API fleet lane, proven in-process with the mock provider:
 * the driver plays a full blind session, gets a report, and the quoted
 * receipt survives the replay-verification an honest report must pass.
 */
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  acceptReport,
  apiProvider,
  fileReport,
  findMenuEntry,
  mockProvider,
  playOne,
  reportShapeErrors,
  turnWarning,
} from "../src/player.ts";
import type { Msg, Provider, SessionResult } from "../src/player.ts";
import { loadWorld } from "../src/validate.ts";
import type { World } from "../src/types.ts";

const world: World = loadWorld(fileURLToPath(new URL("../world/lighthouse.json", import.meta.url)));
const vale: World = loadWorld(fileURLToPath(new URL("../world/vale.json", import.meta.url)));
const noUsage = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };

test("mock provider follows the Vale walkthrough over rendered text to a verified full-score win", async () => {
  // Regression: display hints such as "go east (toward drowned shrine)" once
  // defeated label matching, so the mock skipped steps and stalled at turn 35.
  const r = await playOne(vale, 1, mockProvider(vale), 80);
  assert.equal(r.ended, "king_at_rest");
  assert.equal(r.stalled, false);
  assert.equal(r.verified, true, "receipt verified by in-process replay");
  assert.ok(r.receipt?.includes(`.${vale.maxScore}.`), `full score in receipt ${r.receipt}`);
});

test("an ordinary walkthrough step missing from the menu is an error, not a silent skip", async () => {
  const broken: World = { ...world, walkthrough: ["go nowhere"] };
  await assert.rejects(playOne(broken, 1, mockProvider(broken), 80), /"go nowhere" is not on the menu/);
});

test("findMenuEntry prefers an exact label over a hint-tolerant match", () => {
  // two real Vale labels differ only by a trailing parenthetical of their own
  const menu = [
    { n: "1", label: "weigh the two roads (scout)" },
    { n: "2", label: "weigh the two roads" },
  ];
  assert.equal(findMenuEntry(menu, "weigh the two roads")?.n, "2");
  assert.equal(findMenuEntry(menu, "weigh the two roads (scout)")?.n, "1");
  assert.equal(findMenuEntry([{ n: "1", label: "go east (toward drowned shrine)" }], "go east")?.n, "1");
  assert.equal(findMenuEntry([{ n: "1", label: "go east" }], "go west"), undefined);
});

test("reportShapeErrors accepts a well-formed report and names each fault of a malformed one", () => {
  assert.deepEqual(
    reportShapeErrors({ verdict: "won", fun: 3, clarity: 4, turns: 9, receipt: "r", bugs: [], confusions: [], suggestions: [] }),
    [],
  );
  const errs = reportShapeErrors({ verdict: "champion", fun: 9, clarity: "x", bugs: "none", suggestions: [], receipt: 5 });
  for (const k of ["verdict", "fun", "clarity", "bugs", "receipt"])
    assert.ok(errs.some((e) => e.startsWith(k)), `${k} flagged in: ${errs.join("; ")}`);
  assert.deepEqual(reportShapeErrors(null), ["report must be a JSON object"]);
  assert.deepEqual(reportShapeErrors([1]), ["report must be a JSON object"]);
});

test("a malformed report is rejected with a shape error and the session files as unverified", async () => {
  const provider: Provider = async (_system: string, msgs: Msg[]) => {
    const last = msgs[msgs.length - 1]!.content;
    const text = /output ONLY.*json report/is.test(last) ? '```json\n{"verdict":"champion","receipt":"x"}\n```' : "1";
    return { text, usage: noUsage };
  };
  const r = await playOne(world, 11, provider, 80);
  assert.equal(r.report, null);
  assert.match(r.reportError ?? "", /report shape/);
  assert.equal(r.verified, false);
});

test("a filed report cannot overwrite host-controlled metadata (verified, seed, build, ending, lane)", () => {
  // The writer used to spread the model's report AFTER the host fields, so a
  // report carrying e.g. verified:true or ending:"invented" replaced the truth.
  const forged = {
    verdict: "won", fun: 5, clarity: 5, turns: 3, receipt: "forged", bugs: [], confusions: [], suggestions: [],
    verified: true, seed: 999, ending: "invented", build: { rev: "fake", world: "fake" }, lane: "mcp", kind: "issue",
  };
  const r: SessionResult = {
    seed: 7, turns: 3, ended: "beacon_lit", stalled: false, verified: false, apiCalls: 4,
    receipt: "lighthouse.7.3.0.beacon_lit.00000000", usage: noUsage, report: forged,
  };
  const file = fileReport(r, "mock", fileURLToPath(new URL("../world/lighthouse.json", import.meta.url)));
  assert.ok(file, "report file written");
  try {
    const item = JSON.parse(readFileSync(file!, "utf8"));
    assert.equal(item.verified, false);
    assert.equal(item.seed, 7);
    assert.equal(item.ending, "beacon_lit");
    assert.equal(item.lane, "api");
    assert.equal(item.kind, "playtest");
    assert.notEqual(item.build.rev, "fake");
    assert.equal(item.verdict, "won", "accepted report fields still land");
    assert.equal(item.receipt, "forged", "the quoted receipt is kept as evidence; verified says whether it held");
  } finally {
    rmSync(file!, { force: true });
  }
  // and the accept step itself keeps only the supported fields
  assert.deepEqual(Object.keys(acceptReport(forged)).sort(), ["bugs", "clarity", "confusions", "fun", "receipt", "suggestions", "turns", "verdict"]);
});

test("direct player wins via walkthrough policy and files a verified report", async () => {
  const r = await playOne(world, 7, mockProvider(world), 80);
  assert.equal(r.ended, "beacon_lit");
  assert.ok(r.report, "report parsed");
  assert.equal(r.verified, true, "receipt verified by in-process replay");
  assert.ok(r.receipt?.includes("beacon_lit"));
  assert.ok(r.apiCalls === r.turns + 1 || r.apiCalls <= r.turns + 3, "≈1 model call per turn + report");
});

test("filed report records the ground-truth ending id, for path/route analysis across playtests", async () => {
  const r = await playOne(world, 7, mockProvider(world), 80);
  const worldPath = fileURLToPath(new URL("../world/lighthouse.json", import.meta.url));
  const file = fileReport(r, "mock", worldPath);
  assert.ok(file, "report file written");
  try {
    const item = JSON.parse(readFileSync(file!, "utf8"));
    assert.equal(item.ending, "beacon_lit");
  } finally {
    rmSync(file!, { force: true });
  }
});

test("a session that cannot parse replies ends stuck but still reports", async () => {
  const noisy = async () => ({ text: "I refuse to pick.", usage: { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 } });
  const r = await playOne(world, 9, noisy, 80);
  assert.equal(r.ended, null);
  assert.equal(r.verified, false);
});

test("stall guard ends a wandering session early instead of funding it", async () => {
  // always picks menu item 1: bounces between already-seen rooms, no score
  const wanderer = async () => ({ text: "1", usage: { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 } });
  const r = await playOne(world, 11, wanderer, 80);
  assert.equal(r.stalled, true);
  assert.ok(r.turns < 80, `ended at t${r.turns}, not the full budget`);
});

/** Run fn with a throwaway API key in the environment, restoring whatever was there. */
async function withApiKey<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";
  try {
    return await fn();
  } finally {
    if (prev === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = prev;
  }
}

const jsonResponse = (text: string) =>
  new Response(
    JSON.stringify({ content: [{ type: "text", text }], usage: { input_tokens: 10, output_tokens: 1, cache_read_input_tokens: 5 } }),
    { status: 200 },
  );

test("apiProvider retries a dropped connection, a 5xx, and a 429 with backoff, then returns text and usage", async () => {
  await withApiKey(async () => {
    let calls = 0;
    const fetchFn = (async () => {
      calls++;
      if (calls === 1) throw new TypeError("fetch failed");
      if (calls === 2) return new Response("overloaded", { status: 529 });
      if (calls === 3) return new Response("slow down", { status: 429 });
      return jsonResponse("3");
    }) as unknown as typeof fetch;
    const ask = apiProvider("m", { fetchFn, baseDelayMs: 1 });
    const r = await ask("sys", [{ role: "user", content: "hi" }], 10);
    assert.equal(calls, 4);
    assert.equal(r.text, "3");
    assert.deepEqual(r.usage, { in: 10, out: 1, cacheRead: 5, cacheWrite: 0 });
  });
});

test("apiProvider gives up after its attempt budget, and never retries a plain 4xx", async () => {
  await withApiKey(async () => {
    let calls = 0;
    const always500 = (async () => { calls++; return new Response("down", { status: 500 }); }) as unknown as typeof fetch;
    await assert.rejects(
      apiProvider("m", { fetchFn: always500, baseDelayMs: 1, maxAttempts: 3 })("sys", [], 10),
      /API 500 after 3 attempts/,
    );
    assert.equal(calls, 3);
    calls = 0;
    const bad400 = (async () => { calls++; return new Response("bad request", { status: 400 }); }) as unknown as typeof fetch;
    await assert.rejects(apiProvider("m", { fetchFn: bad400, baseDelayMs: 1 })("sys", [], 10), /API 400: bad request/);
    assert.equal(calls, 1, "a 4xx is the caller's fault, not transient");
  });
});

test("turnWarning stays silent until the session nears its turn cap, then counts down", () => {
  assert.equal(turnWarning(50, 80), "", "far from the cap: no warning");
  assert.equal(turnWarning(69, 80), "", "11 left: still quiet");
  assert.equal(turnWarning(70, 80), "\n(10 turns left before this session ends.)");
  assert.equal(turnWarning(79, 80), "\n(1 turn left before this session ends.)");
  assert.equal(turnWarning(80, 80), "", "at/past the cap: loop has already ended, nothing to warn about");
});

// NOTE: a one-shot plan lane (model plans the whole game from the opening scene,
// host executes the labels) was trialed live on 2026-09-01 and REMOVED: with
// menu-local labels and unguessable proper nouns, a real model's 30-step plan
// executed 1 action before derailing (10 straight rejects). The metric has no
// dynamic range in this game design; per-turn players remain the playtest lane.
