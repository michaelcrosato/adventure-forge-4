/**
 * The direct-API fleet lane, proven in-process with the mock provider:
 * the driver plays a full blind session, gets a report, and the quoted
 * receipt survives the replay-verification an honest report must pass.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { mockProvider, playOne } from "../src/player.ts";
import { loadWorld } from "../src/validate.ts";
import type { World } from "../src/types.ts";

const world: World = loadWorld(fileURLToPath(new URL("../world/lighthouse.json", import.meta.url)));

test("direct player wins via walkthrough policy and files a verified report", async () => {
  const r = await playOne(world, 7, mockProvider(world), 80);
  assert.equal(r.ended, "beacon_lit");
  assert.ok(r.report, "report parsed");
  assert.equal(r.verified, true, "receipt verified by in-process replay");
  assert.ok(r.receipt?.includes("beacon_lit"));
  assert.ok(r.apiCalls === r.turns + 1 || r.apiCalls <= r.turns + 3, "≈1 model call per turn + report");
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

// NOTE: a one-shot plan lane (model plans the whole game from the opening scene,
// host executes the labels) was trialed live on 2026-09-01 and REMOVED: with
// menu-local labels and unguessable proper nouns, a real model's 30-step plan
// executed 1 action before derailing (10 straight rejects). The metric has no
// dynamic range in this game design; per-turn players remain the playtest lane.
