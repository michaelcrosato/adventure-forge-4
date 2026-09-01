/**
 * oddsHint is display-only: it never touches actionLabel, so it cannot break
 * walkthrough/proof matching (actionByLabel matches on the canonical label).
 * These tests pin its math and its separation from the canonical label.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { actionByLabel, actionLabel, newState, oddsHint, step } from "../src/engine.ts";
import type { Action, State, World } from "../src/types.ts";

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

test("a check-first custom action previews the d20 threshold, net of mods", () => {
  const world = mini({
    classes: { sage: { name: "Sage", desc: "wise", attrs: { wits: 3 } } },
    rooms: {
      a: {
        name: "A",
        desc: "A.",
        actions: [{ id: "riddle", label: "riddle", fx: [["check", "wits", 11, [["say", "ok"]], [["say", "no"]]]] }],
      },
    },
  });
  let { state } = newState(world, 1);
  state = step(world, state, { kind: "classpick", id: "sage" }).state;
  const a = { kind: "custom", room: "a", id: "riddle" } as Action;
  assert.equal(oddsHint(world, state, a), " (roll 8+ on the die)"); // dc 11 - wits 3 = 8
  // the canonical label never changes, so authored walkthroughs keep matching
  assert.equal(actionLabel(world, a, state), "riddle");
});

test("an attack previews the roll needed against the target's defense", () => {
  const world = mini({
    items: { club: { name: "club", loc: "inv", hit: 1, dmg: 2 } },
    npcs: { rat: { name: "rat", room: "a", hostile: true, hp: 3, df: 12 } },
  });
  const { state } = newState(world, 1);
  const a: Action = { kind: "attack", npc: "rat" };
  assert.equal(oddsHint(world, state, a), " (roll 11+ on the die)"); // df 12 - hit 1 = 11
});

test("a guaranteed action clamps to need 1+, never a number below 1", () => {
  const world = mini({
    classes: { giant: { name: "Giant", desc: "huge", attrs: { might: 20 } } },
    rooms: { a: { name: "A", desc: "A.", actions: [{ id: "lift", label: "lift", fx: [["check", "might", 5, [["say", "ok"]], [["say", "no"]]]] }] } },
  });
  let { state } = newState(world, 1);
  state = step(world, state, { kind: "classpick", id: "giant" }).state;
  assert.equal(oddsHint(world, state, { kind: "custom", room: "a", id: "lift" }), " (roll 1+ on the die)");
});

test("a locked exit is flagged before a turn is wasted on it", () => {
  const world = mini({
    rooms: {
      a: { name: "A", desc: "A.", exits: { north: { to: "b", if: [["has", "key"]], lockedMsg: "Locked." } } },
      b: { name: "B", desc: "B." },
    },
    items: { key: { name: "key", loc: "nowhere" } },
  });
  const { state } = newState(world, 1);
  assert.equal(oddsHint(world, state, { kind: "go", dir: "north" }), " (locked)");
  state.inv.push("key");
  assert.equal(oddsHint(world, state, { kind: "go", dir: "north" }), "", "unlocked once the key is held");
});

test("a locked exit with an authored hint explains what's missing", () => {
  const world = mini({
    rooms: {
      a: {
        name: "A",
        desc: "A.",
        exits: { north: { to: "b", if: [["has", "key"]], lockedMsg: "Locked.", hint: "find the key" } },
      },
      b: { name: "B", desc: "B." },
    },
    items: { key: { name: "key", loc: "nowhere" } },
  });
  const { state } = newState(world, 1);
  assert.equal(oddsHint(world, state, { kind: "go", dir: "north" }), " (locked: find the key)");
});

test("an unconditional exit previews nothing", () => {
  const world = mini({ rooms: { a: { name: "A", desc: "A.", exits: { north: { to: "a" } } } } });
  const { state } = newState(world, 1);
  assert.equal(oddsHint(world, state, { kind: "go", dir: "north" }), "");
});

test("actions with no check preview nothing", () => {
  const world = mini({
    rooms: {
      a: {
        name: "A",
        desc: "A.",
        exits: { north: { to: "a" } },
        actions: [{ id: "wave", label: "wave", fx: [["say", "hi"]] }],
      },
    },
  });
  const { state } = newState(world, 1);
  assert.equal(oddsHint(world, state, { kind: "go", dir: "north" }), "");
  assert.equal(oddsHint(world, state, { kind: "custom", room: "a", id: "wave" }), "");
});

test("a check-first use action previews too, matching the def step() would run", () => {
  const world = mini({
    classes: { sage: { name: "Sage", desc: "wise", attrs: { wits: 4 } } },
    items: {
      scroll: {
        name: "scroll",
        loc: "inv",
        use: [{ fx: [["check", "wits", 10, [["say", "read"]], [["say", "blur"]]]] }],
      },
    },
  });
  let { state } = newState(world, 1);
  state = step(world, state, { kind: "classpick", id: "sage" }).state;
  assert.equal(oddsHint(world, state, { kind: "use", item: "scroll" }), " (roll 6+ on the die)");
});

test("a check's post-roll event names the die roll needed, not a total, and success tracks the raw roll", () => {
  // Regression for a report where a player read "d20:6+3=9 (needed 7+)" as a
  // passing total (9 >= 7) and called the resulting fail a bug — the check
  // was really roll >= 7 on the die, and 6 < 7. The event text must spell out
  // "on the die" so the number it names can't be mistaken for the total.
  const world = mini({
    classes: { sage: { name: "Sage", desc: "wise", attrs: { wits: 3 } } },
    rooms: {
      a: {
        name: "A",
        desc: "A.",
        actions: [{ id: "riddle", label: "riddle", fx: [["check", "wits", 11, [["say", "ok"]], [["say", "no"]]]] }],
      },
    },
  });
  let { state } = newState(world, 1);
  state = step(world, state, { kind: "classpick", id: "sage" }).state;
  const { events } = step(world, state, { kind: "custom", room: "a", id: "riddle" });
  const line = events.find((e) => e.startsWith("WITS d20:"));
  assert.ok(line, "check emits a WITS d20 event");
  const m = line!.match(/^WITS d20:(\d+)\+(\d+) \(needed to roll (\d+)\+ on the die\) — (success|fail)\.$/);
  assert.ok(m, `event text names the die roll, not the total: "${line}"`);
  const [, roll, mod, need, verdict] = m!;
  assert.equal(Number(need), 11 - Number(mod)); // dc 11 - wits 3 = 8
  assert.equal(verdict === "success", Number(roll) >= Number(need));
});

test("odds text does not appear in actionByLabel matching (walkthroughs stay stable)", () => {
  const world = mini({
    rooms: {
      a: {
        name: "A",
        desc: "A.",
        actions: [{ id: "force", label: "force it", fx: [["check", "might", 12, [["say", "ok"]], [["say", "no"]]]] }],
      },
    },
  });
  const { state } = newState(world, 1);
  const found = actionByLabel(world, state, "force it");
  assert.ok(found, "the plain label still resolves — no odds suffix baked in");
});
