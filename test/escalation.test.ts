/**
 * Escalating retry: a failed check raises the DC of a retry on that same
 * check by 1 (see docs/authoring.md §4, and applyFx's `check` case /
 * oddsHint in engine.ts). These pin the contract playtesting found missing:
 * a failed check could be retried forever at the same DC for the price of
 * one turn, so the odds preview nobody had to weigh was decoration.
 *
 * DC 21 at 0 modifier is used throughout on purpose: unreachable on a d20
 * (max total 20), so every attempt fails deterministically without hunting
 * for a seed — the tests are about the escalation arithmetic and its wiring,
 * not about winning the roll.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { condOk, hashState, newState, oddsHint, receipt, step } from "../src/engine.ts";
import { validateWorld } from "../src/validate.ts";
import { replayTrace } from "../src/crawl.ts";
import { renderMenu, renderStatus } from "../src/format.ts";
import type { Cond, Action, World } from "../src/types.ts";

const mini = (over: Partial<World> = {}): World => ({
  id: "mini",
  title: "Mini",
  intro: "x",
  start: "a",
  hp: 10,
  maxScore: 10,
  rooms: { a: { name: "A", desc: "A." } },
  items: {},
  npcs: {},
  walkthrough: [],
  ...over,
});

// DC 30: high enough that every attempt fails deterministically at any seed,
// AND high enough that the escalation cap (a natural 20, or the authored DC if
// that is already higher) leaves room for the rise these tests are about.
const riddleWorld = (dc = 30) =>
  mini({
    rooms: {
      a: {
        name: "A",
        desc: "A.",
        actions: [{ id: "riddle", label: "riddle", fx: [["check", "wits", dc, [["say", "ok"]], [["say", "no"]]]] }],
      },
    },
  });

test("a failed attempt raises the DC of the next try on the same check — preview and roll agree, every time", () => {
  const world = riddleWorld();
  let { state } = newState(world, 1);
  const a = { kind: "custom", room: "a", id: "riddle" } as Action;
  for (let n = 0; n < 3; n++) {
    const dc = 30 + n; // n prior failures already logged
    // a DC already above what a d20 can reach carries no "and stops at" comfort: it is
    // unreachable either way, and saying where it stops would be a false promise
    const raised = n > 0 ? `; raised ${n} by failed tries` : "";
    assert.equal(oddsHint(world, state, a), ` (DC ${dc}, wits: roll ${dc}+ on the die${raised})`, `attempt ${n + 1} preview`);
    const out = step(world, state, a);
    const line = out.events.find((e) => e.startsWith("WITS d20:"))!;
    assert.match(line, new RegExp(`vs DC ${dc} \\(${dc}\\+ succeeds\\) — fail\\.$`), `attempt ${n + 1} roll: "${line}"`);
    state = out.state;
  }
  assert.equal(state.checkAttempts["act:riddle"], 3, "three failures logged against this exact source");
});

test("escalation is keyed per check — failing one does not touch a different one", () => {
  const world = mini({
    rooms: {
      a: {
        name: "A",
        desc: "A.",
        actions: [
          { id: "hard", label: "hard riddle", fx: [["check", "wits", 21, [["say", "ok"]], [["say", "no"]]]] },
          { id: "easy", label: "easy riddle", fx: [["check", "wits", 9, [["say", "ok"]], [["say", "no"]]]] },
        ],
      },
    },
  });
  let { state } = newState(world, 1);
  const hard = { kind: "custom", room: "a", id: "hard" } as Action;
  const easy = { kind: "custom", room: "a", id: "easy" } as Action;
  state = step(world, state, hard).state;
  state = step(world, state, hard).state;
  assert.equal(state.checkAttempts["act:hard"], 2, "the failed check accrues its own attempts");
  assert.equal(state.checkAttempts["act:easy"], undefined, "a check never attempted stays unrecorded");
  assert.equal(oddsHint(world, state, easy), " (DC 9, wits: roll 9+ on the die)", "an unrelated check's odds are untouched");
});

test("a topic's check escalates too, keyed by npc and topic id, independent of a room action's", () => {
  // the "natural key" the proposal names — an npc topic, not just a room action
  const world = mini({
    npcs: {
      sage: {
        name: "the sage",
        room: "a",
        topics: [{ id: "riddle", label: "ask for the riddle's answer", say: "Try.", fx: [["check", "wits", 21, [["say", "ok"]], [["say", "no"]]]] }],
      },
    },
  });
  let { state } = newState(world, 1);
  const t = { kind: "talk", npc: "sage", topic: "riddle" } as Action;
  assert.equal(oddsHint(world, state, t), " (DC 21, wits: roll 21+ on the die)");
  state = step(world, state, t).state;
  assert.equal(state.checkAttempts["tp:sage:riddle"], 1);
  assert.equal(oddsHint(world, state, t), " (DC 22, wits: roll 22+ on the die; raised 1 by failed tries)", "the topic's own retry is now harder, and says why");
});

test("a check with no source id never escalates (a world.clock entry: not a menu action a player retries)", () => {
  const world = mini({
    clock: [{ id: "trial", fx: [["check", "wits", 21, [["say", "ok"]], [["say", "no"]]]] }],
    rooms: { a: { name: "A", desc: "A.", exits: { north: { to: "a" } } } }, // a self-loop, so "go north" always spends a turn
  });
  let { state } = newState(world, 1);
  for (let i = 0; i < 3; i++) {
    const out = step(world, state, { kind: "go", dir: "north" });
    const line = out.events.find((e) => e.startsWith("WITS d20:"))!;
    assert.match(line, /vs DC 21 \(21\+ succeeds\) — fail\.$/, `clock check on turn ${i + 1} should still read DC 21, not escalated`);
    state = out.state;
  }
  assert.deepEqual(state.checkAttempts, {}, "nothing was ever recorded: there was no sourceId to key on");
});

test("determinism holds across escalating retries: same seed, same failures, same hashes and receipt", () => {
  const world = riddleWorld();
  const a = { kind: "custom", room: "a", id: "riddle" } as Action;
  const run = () => {
    let { state } = newState(world, 7);
    const hashes = [hashState(state)];
    for (let i = 0; i < 4; i++) {
      state = step(world, state, a).state;
      hashes.push(hashState(state));
    }
    return { state, hashes };
  };
  const r1 = run();
  const r2 = run();
  assert.deepEqual(r1.hashes, r2.hashes, "byte-identical hash sequence across two runs of the same seed");
  assert.equal(receipt(world, r1.state), receipt(world, r2.state));
  assert.equal(r1.state.checkAttempts["act:riddle"], 4, "sanity: this run actually escalated something, not a vacuous pass");
});

test("escalated state round-trips through a trace replay", () => {
  const world = riddleWorld();
  const a = { kind: "custom", room: "a", id: "riddle" } as Action;
  let { state } = newState(world, 3);
  const actions: Action[] = [];
  for (let i = 0; i < 3; i++) {
    actions.push(a);
    state = step(world, state, a).state;
  }
  assert.equal(state.checkAttempts["act:riddle"], 3, "sanity: the recorded run really did escalate");
  const rec = replayTrace(world, { world: world.id, seed: 3, actions });
  assert.equal(rec, receipt(world, state), "checkAttempts survives structuredClone/canon and replays byte-identical");
});

test("a retried check's history shows up on the free status check, DC included", () => {
  const world = riddleWorld();
  let { state } = newState(world, 1);
  const a = { kind: "custom", room: "a", id: "riddle" } as Action;
  assert.doesNotMatch(renderStatus(world, state), /Failed before/, "nothing to report before any attempt");
  state = step(world, state, a).state;
  state = step(world, state, a).state;
  assert.match(renderStatus(world, state), /Failed before: riddle \(2x, now DC 32\)/);
});

test("the rendered menu line itself carries the escalated DC (renderMenu, not just oddsHint in isolation)", () => {
  const world = riddleWorld();
  let { state } = newState(world, 1);
  const first = renderMenu(world, state).text;
  assert.match(first, /^1 riddle \(DC 30, wits: roll 30\+ on the die\)$/m);
  state = step(world, state, { kind: "custom", room: "a", id: "riddle" }).state;
  state = step(world, state, { kind: "custom", room: "a", id: "riddle" }).state;
  const afterTwoFails = renderMenu(world, state).text;
  assert.match(afterTwoFails, /^1 riddle \(DC 32, wits: roll 32\+ on the die; raised 2 by failed tries\)$/m);
});

test("escalation stops where the die can still land it, and never lowers an authored DC", () => {
  // The design is "you can always keep trying, it just gets worse". Uncapped it
  // stopped being true: ten failures on a DC 11 check with no modifier previewed
  // "roll 21+ on the die", which no d20 rolls — while the option stayed on the
  // menu and each further press still charged the standing its miss branch costs.
  const world = riddleWorld(11);
  let { state } = newState(world, 1);
  const a = { kind: "custom", room: "a", id: "riddle" } as Action;
  const dcOf = () => Number(/DC (\d+)/.exec(oddsHint(world, state, a))![1]);
  const seen: number[] = [];
  for (let n = 0; n < 15; n++) { seen.push(dcOf()); state = step(world, state, a).state; }
  assert.equal(seen[0], 11, "the authored DC on the first try");
  assert.equal(Math.max(...seen), 20, `the rise stops at a natural 20, saw ${Math.max(...seen)}`);
  // and it is still possible there: the preview and the roll both say 20+, and
  // the line says where the rise stops — a playtester abandoned the King's
  // Strongroom box believing the DC would spiral out of reach forever
  assert.equal(oddsHint(world, state, a), " (DC 20, wits: roll 20+ on the die; raised 9 by failed tries, and stops at 20)");

  // an authored DC already past 20 is left exactly as written
  const hard = riddleWorld(30);
  let h = newState(hard, 1).state;
  assert.match(oddsHint(hard, h, a), /DC 30, wits: roll 30\+/);
  h = step(hard, h, a).state;
  assert.match(oddsHint(hard, h, a), /DC 31, wits: roll 31\+/, "the author's own number still escalates from where they put it");
});

test("the five room-scoped conditions each have their negated twin", () => {
  // They shipped without them, alone among every op in the DSL — so there was
  // no way to write "only when nothing here ignores armor", which is exactly
  // what the Warden's `brace for it` (armor +2) wants: it is offered against
  // all eight `pierce` hostiles, in rooms whose own text says "armor useless".
  const world = mini({
    npcs: {
      wight: { name: "wight", room: "a", hostile: true, pierce: true, hp: 5, atk: 1, df: 5 },
    },
    rooms: { a: { name: "A", desc: "A." } },
  });
  const { state } = newState(world, 1);
  const pairs: [Cond, Cond][] = [
    [["horrorHere"], ["!horrorHere"]],
    [["holdsGround"], ["!holdsGround"]],
    [["companionDown"], ["!companionDown"]],
    [["checkHere", "wits", 5], ["!checkHere", "wits", 5]],
    [["lowHp"], ["!lowHp"]],
  ];
  for (const [pos, neg] of pairs)
    assert.notEqual(condOk(world, state, pos), condOk(world, state, neg), `${pos[0]} and ${neg[0]} must disagree`);
  // and this room really does hold a horror, so the pair above is not both-false
  assert.ok(condOk(world, state, ["horrorHere"]));
  assert.ok(!condOk(world, state, ["!horrorHere"]));
  // the validator accepts them: a closed DSL that rejects half a pair is a hole.
  // (this fixture carries no walkthrough, so only condition errors are checked)
  const w2 = mini({ rooms: { a: { name: "A", desc: "A.", actions: [{ id: "x", label: "x", if: [["!horrorHere"], ["!lowHp"], ["!checkHere", "wits", 9], ["!holdsGround"], ["!companionDown"]], fx: [["say", "ok"]] }] } } });
  assert.deepEqual(validateWorld(w2).filter((e) => /cond|unknown op/i.test(e)), []);
});
