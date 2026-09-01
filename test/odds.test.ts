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
  assert.equal(oddsHint(world, state, a), " (need 8+)"); // dc 11 - wits 3 = 8
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
  assert.equal(oddsHint(world, state, a), " (need 11+)"); // df 12 - hit 1 = 11
});

test("a guaranteed action clamps to need 1+, never a number below 1", () => {
  const world = mini({
    classes: { giant: { name: "Giant", desc: "huge", attrs: { might: 20 } } },
    rooms: { a: { name: "A", desc: "A.", actions: [{ id: "lift", label: "lift", fx: [["check", "might", 5, [["say", "ok"]], [["say", "no"]]]] }] } },
  });
  let { state } = newState(world, 1);
  state = step(world, state, { kind: "classpick", id: "giant" }).state;
  assert.equal(oddsHint(world, state, { kind: "custom", room: "a", id: "lift" }), " (need 1+)");
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
  assert.equal(oddsHint(world, state, { kind: "use", item: "scroll" }), " (need 6+)");
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
