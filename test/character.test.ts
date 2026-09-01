/**
 * Classes, attributes, perks, xp, and levels — the character layer. Everything
 * here runs on small in-memory worlds so each rule is tested alone.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { actionLabel, legalActions, newState, step, xpForLevel } from "../src/engine.ts";
import type { Action, State, World } from "../src/types.ts";

const mini = (over: Partial<World> = {}): World => ({
  id: "mini",
  title: "Mini",
  intro: "A test.",
  start: "a",
  hp: 10,
  maxScore: 10,
  rooms: { a: { name: "A", desc: "Room A." }, b: { name: "B", desc: "Room B." } },
  items: {},
  npcs: {},
  walkthrough: [],
  ...over,
});

const CLASSES: World["classes"] = {
  warden: { name: "Warden", desc: "strong", attrs: { might: 2 }, hp: 4, items: ["sword"] },
  scholar: { name: "Scholar", desc: "wise", attrs: { wits: 2, will: 1 } },
};

const doAction = (world: World, s: State, a: Action): State => step(world, s, a).state;

test("a class world starts with only the class menu", () => {
  const world = mini({ classes: CLASSES, items: { sword: { name: "sword", loc: "nowhere", dmg: 3 } } });
  const { state } = newState(world, 1);
  const legal = legalActions(world, state);
  assert.deepEqual(legal.map((a) => a.kind), ["classpick", "classpick"]);
  assert.match(actionLabel(world, legal[0]!, state), /be a Warden — strong/);
  // the start room is not entered yet
  assert.deepEqual(state.visited, []);
});

test("picking a class applies attrs, hp, and items, then enters the start room", () => {
  const world = mini({ classes: CLASSES, items: { sword: { name: "sword", loc: "nowhere", dmg: 3 } } });
  let { state } = newState(world, 1);
  state = doAction(world, state, { kind: "classpick", id: "warden" });
  assert.equal(state.classId, "warden");
  assert.equal(state.attrs["might"], 2);
  assert.equal(state.maxHp, 14);
  assert.equal(state.hp, 14);
  assert.ok(state.inv.includes("sword"));
  assert.deepEqual(state.visited, ["a"]);
  // and the class menu is gone
  assert.ok(legalActions(world, state).every((a) => a.kind !== "classpick"));
});

test("worlds without classes never see the class phase", () => {
  const world = mini();
  const { state } = newState(world, 1);
  assert.deepEqual(state.visited, ["a"]);
  assert.ok(legalActions(world, state).every((a) => a.kind !== "classpick"));
});

test("class conditions gate content", () => {
  const world = mini({
    classes: CLASSES,
    rooms: {
      a: {
        name: "A",
        desc: "Room A.",
        actions: [
          { id: "w_only", label: "warden move", if: [["class", "warden"]], fx: [["say", "ok"]] },
          { id: "not_w", label: "anyone else", if: [["!class", "warden"]], fx: [["say", "ok"]] },
        ],
      },
    },
  });
  let { state } = newState(world, 1);
  state = doAction(world, state, { kind: "classpick", id: "warden" });
  const ids = legalActions(world, state).filter((a) => a.kind === "custom").map((a) => (a as { id: string }).id);
  assert.deepEqual(ids, ["w_only"]);
});

test("checks add the attribute modifier", () => {
  // might 10 vs dc 11: min roll 1 + 10 = 11, so success is guaranteed
  const world = mini({
    classes: { giant: { name: "Giant", desc: "huge", attrs: { might: 10 } } },
    rooms: {
      a: { name: "A", desc: "Room A.", actions: [{ id: "lift", label: "lift", fx: [["check", "might", 11, [["say", "up"]], [["say", "no"]]]] }] },
    },
  });
  let { state } = newState(world, 3);
  state = doAction(world, state, { kind: "classpick", id: "giant" });
  const out = step(world, state, { kind: "custom", room: "a", id: "lift" });
  assert.match(out.events.join(" "), /success/);
  assert.match(out.events.join(" "), /\+10/);
});

test("might adds to attack rolls and armor reduces damage taken", () => {
  const world = mini({
    classes: { giant: { name: "Giant", desc: "huge", attrs: { might: 10 } } },
    items: { mail: { name: "mail", loc: "inv", armor: 2 } },
    npcs: { troll: { name: "troll", room: "a", hostile: true, hp: 1000, atk: 3, df: 11 } },
  });
  let { state } = newState(world, 5);
  state = doAction(world, state, { kind: "classpick", id: "giant" });
  const before = state.hp;
  // min roll 1 + might 10 >= df 11: the hit always lands
  const out = step(world, state, { kind: "attack", npc: "troll" });
  assert.match(out.events.join(" "), /You hit the troll/);
  // troll survives and strikes back for max(1, 3 - 2) = 1
  assert.equal(before - out.state.hp, 1);
});

test("xp crosses a threshold: level up, +2 max hp, a perk pick blocks the menu", () => {
  const world = mini({
    classes: CLASSES,
    perks: {
      tough: { name: "Tough", desc: "+3 max hp", bonus: { maxhp: 3 } },
      keen: { name: "Keen", desc: "+1 wits checks", bonus: { check: { wits: 1 } } },
    },
    rooms: { a: { name: "A", desc: "Room A.", actions: [{ id: "learn", label: "learn", fx: [["xp", 10]] }] } },
  });
  assert.equal(xpForLevel(2), 10);
  let { state } = newState(world, 1);
  state = doAction(world, state, { kind: "classpick", id: "scholar" });
  const maxBefore = state.maxHp;
  state = doAction(world, state, { kind: "custom", room: "a", id: "learn" });
  assert.equal(state.level, 2);
  assert.equal(state.maxHp, maxBefore + 2);
  assert.equal(state.perkPicks, 1);
  const legal = legalActions(world, state);
  assert.ok(legal.length > 0);
  assert.ok(legal.every((a) => a.kind === "perkpick"), "perk choice blocks the menu");
  // picking applies the bonus and unblocks
  state = doAction(world, state, { kind: "perkpick", id: "tough" });
  assert.ok(state.perks.includes("tough"));
  assert.equal(state.maxHp, maxBefore + 2 + 3);
  assert.equal(state.perkPicks, 0);
  assert.ok(legalActions(world, state).every((a) => a.kind !== "perkpick"));
});

test("perk requirements hold: level and class gates hide perks from the pick", () => {
  const world = mini({
    classes: CLASSES,
    perks: {
      open: { name: "Open", desc: "anyone" },
      high: { name: "High", desc: "level 5", require: { level: 5 } },
      wonly: { name: "W Only", desc: "wardens", require: { class: ["warden"] } },
    },
    rooms: { a: { name: "A", desc: "Room A.", actions: [{ id: "learn", label: "learn", fx: [["xp", 10]] }] } },
  });
  let { state } = newState(world, 1);
  state = doAction(world, state, { kind: "classpick", id: "scholar" });
  state = doAction(world, state, { kind: "custom", room: "a", id: "learn" });
  const picks = legalActions(world, state).map((a) => (a as { id: string }).id);
  assert.deepEqual(picks, ["open"]);
});

test("a level-up with no eligible perks does not block the menu", () => {
  const world = mini({
    classes: CLASSES,
    perks: { high: { name: "High", desc: "level 9", require: { level: 9 } } },
    rooms: { a: { name: "A", desc: "Room A.", actions: [{ id: "learn", label: "learn", fx: [["xp", 10]] }] } },
  });
  let { state } = newState(world, 1);
  state = doAction(world, state, { kind: "classpick", id: "scholar" });
  state = doAction(world, state, { kind: "custom", room: "a", id: "learn" });
  assert.equal(state.level, 2);
  assert.equal(state.perkPicks, 0);
  assert.ok(legalActions(world, state).every((a) => a.kind !== "perkpick"));
});

test("the perk effect grants directly and perk conditions gate content", () => {
  const world = mini({
    perks: { rite: { name: "Rite", desc: "old words" } },
    rooms: {
      a: {
        name: "A",
        desc: "Room A.",
        actions: [
          { id: "teach", label: "teach", once: true, fx: [["perk", "rite"]] },
          { id: "door", label: "speak the rite", if: [["perk", "rite"]], fx: [["say", "opens"]] },
        ],
      },
    },
  });
  let { state } = newState(world, 1);
  assert.ok(!legalActions(world, state).some((a) => a.kind === "custom" && a.id === "door"));
  state = doAction(world, state, { kind: "custom", room: "a", id: "teach" });
  assert.ok(state.perks.includes("rite"));
  assert.ok(legalActions(world, state).some((a) => a.kind === "custom" && a.id === "door"));
});

test("perk check bonuses feed the roll", () => {
  // wits 8 + perk 2 = +10 vs dc 11: guaranteed
  const world = mini({
    classes: { sage: { name: "Sage", desc: "wise", attrs: { wits: 8 } } },
    perks: { keen: { name: "Keen", desc: "+2 wits", bonus: { check: { wits: 2 } } } },
    rooms: {
      a: {
        name: "A",
        desc: "Room A.",
        actions: [
          { id: "teach", label: "teach", once: true, fx: [["perk", "keen"]] },
          { id: "riddle", label: "riddle", fx: [["check", "wits", 11, [["say", "solved"]], [["say", "stumped"]]]] },
        ],
      },
    },
  });
  let { state } = newState(world, 2);
  state = doAction(world, state, { kind: "classpick", id: "sage" });
  state = doAction(world, state, { kind: "custom", room: "a", id: "teach" });
  const out = step(world, state, { kind: "custom", room: "a", id: "riddle" });
  assert.match(out.events.join(" "), /success/);
});

test("class picks and perk picks replay deterministically (same seed, same hash)", () => {
  const world = mini({
    classes: CLASSES,
    perks: { tough: { name: "Tough", desc: "+3 hp", bonus: { maxhp: 3 } } },
    rooms: { a: { name: "A", desc: "Room A.", actions: [{ id: "learn", label: "learn", fx: [["xp", 10]] }] } },
    items: { sword: { name: "sword", loc: "nowhere", dmg: 3 } },
  });
  const run = () => {
    let { state } = newState(world, 9);
    state = doAction(world, state, { kind: "classpick", id: "warden" });
    state = doAction(world, state, { kind: "custom", room: "a", id: "learn" });
    state = doAction(world, state, { kind: "perkpick", id: "tough" });
    return state;
  };
  assert.deepEqual(run(), run());
});
