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
  assert.equal(oddsHint(world, state, a), " (roll 8+ on the die, +3 wits)"); // dc 11 - wits 3 = 8
  // the canonical label never changes, so authored walkthroughs keep matching
  assert.equal(actionLabel(world, a, state), "riddle");
});

test("a check with no modifier still names the stat it uses", () => {
  const world = mini({
    rooms: {
      a: {
        name: "A",
        desc: "A.",
        actions: [{ id: "riddle", label: "riddle", fx: [["check", "wits", 11, [["say", "ok"]], [["say", "no"]]]] }],
      },
    },
  });
  const { state } = newState(world, 1);
  const a = { kind: "custom", room: "a", id: "riddle" } as Action;
  assert.equal(oddsHint(world, state, a), " (roll 11+ on the die, wits)"); // no class picked, mod 0
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
  assert.equal(oddsHint(world, state, { kind: "custom", room: "a", id: "lift" }), " (roll 1+ on the die, +20 might)");
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

test("an unlocked exit with a landmark previews the destination", () => {
  const world = mini({
    rooms: { a: { name: "A", desc: "A.", exits: { west: { to: "a", landmark: "hunter's camp" } } } },
  });
  const { state } = newState(world, 1);
  assert.equal(oddsHint(world, state, { kind: "go", dir: "west" }), " (toward hunter's camp)");
});

test("a locked exit's own hint takes priority over a landmark on the same exit", () => {
  const world = mini({
    rooms: {
      a: {
        name: "A",
        desc: "A.",
        exits: { west: { to: "a", if: [["has", "key"]], hint: "find the key", landmark: "hunter's camp" } },
      },
    },
  });
  const { state } = newState(world, 1);
  assert.equal(oddsHint(world, state, { kind: "go", dir: "west" }), " (locked: find the key)");
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
  assert.equal(oddsHint(world, state, { kind: "use", item: "scroll" }), " (roll 6+ on the die, +4 wits)");
});

test("a use action with no check previews the item's own hint instead", () => {
  const world = mini({
    items: {
      crown: {
        name: "iron crown",
        loc: "inv",
        hint: "worth reading",
        use: [{ fx: [["say", "worn words"]] }],
      },
      plain: { name: "plain rock", loc: "inv", use: [{ fx: [["say", "a rock"]] }] },
    },
  });
  const { state } = newState(world, 1);
  assert.equal(oddsHint(world, state, { kind: "use", item: "crown" }), " (worth reading)");
  assert.equal(oddsHint(world, state, { kind: "use", item: "plain" }), "", "no hint, no preview");
});

test("a check's post-roll event states the total vs DC directly, and success tracks that comparison", () => {
  // Regression for reports where a player derived a "needed N+" number from
  // the DC and modifier, then re-derived a total to compare against it, and
  // lost track of which frame (die-only vs total) a given number was in. The
  // event text now names only numbers a player already has (roll, mod, DC)
  // plus their sum, so pass/fail reads directly off "total vs DC" — no mental
  // subtraction, no re-derivation, no second frame to mix up.
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
  const m = line!.match(/^WITS d20:(\d+)\+(\d+)=(\d+) vs DC (\d+) \((\d+)\+ succeeds\) — (success|fail)\.$/);
  assert.ok(m, `event text states total vs DC directly: "${line}"`);
  const [, roll, mod, total, dc, dcAgain, verdict] = m!;
  assert.equal(Number(total), Number(roll) + Number(mod));
  assert.equal(Number(dc), 11);
  assert.equal(Number(dcAgain), Number(dc), "the succeed threshold reuses the DC already stated, not a derived number");
  assert.equal(verdict === "success", Number(total) >= Number(dc));
});

test("a near-miss fail (within 2 of the DC) gets an extra cue; other outcomes don't", () => {
  // Regression for a playtest report: "pins are turning" read the same on a
  // roll that missed by 1 as one that missed by 10. Swept across seeds
  // (rather than pinned to one hand-picked roll) so the assertion tracks the
  // actual near-miss/fail logic, not one lucky die.
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
  let sawNearMiss = false;
  let sawFarMiss = false;
  for (let seed = 1; seed <= 40; seed++) {
    let { state } = newState(world, seed);
    state = step(world, state, { kind: "classpick", id: "sage" }).state;
    const { events } = step(world, state, { kind: "custom", room: "a", id: "riddle" });
    const line = events.find((e) => e.startsWith("WITS d20:"))!;
    const m = line.match(/=(\d+) vs DC (\d+) .* — (success|fail)\./)!;
    const [, totalStr, dcStr, verdict] = m;
    const near = verdict === "fail" && Number(dcStr) - Number(totalStr) <= 2;
    const cue = events[events.indexOf(line) + 1];
    assert.equal(cue === "So close — that one nearly landed.", near, `seed ${seed}: "${line}" -> cue "${cue}"`);
    if (near) sawNearMiss = true;
    if (verdict === "fail" && !near) sawFarMiss = true;
  }
  assert.ok(sawNearMiss, "sweep never hit a near-miss fail — widen the seed range");
  assert.ok(sawFarMiss, "sweep never hit a wide-miss fail — widen the seed range");
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
