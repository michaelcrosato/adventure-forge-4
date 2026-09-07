/**
 * Scripting effects: `if` branches on conditions, `slay` ends an npc without a
 * fight, and `here` names the player's room inside move/npcgo.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { legalActions, newState, step } from "../src/engine.ts";
import { validateWorld } from "../src/validate.ts";
import type { World } from "../src/types.ts";

const world = (): World => ({
  id: "fx",
  title: "Fx",
  intro: "x",
  start: "a",
  hp: 10,
  maxScore: 5,
  rooms: {
    a: {
      name: "A",
      desc: "A.",
      exits: { east: { to: "b" } },
      actions: [
        { id: "greet", label: "greet", fx: [["if", [["has", "coin"]], [["say", "rich"]], [["say", "poor"]]]] },
        { id: "call", label: "call the dog", fx: [["npcgo", "dog", "here"]] },
        { id: "drop", label: "drop the coin", if: [["has", "coin"]], fx: [["move", "coin", "here"]] },
        { id: "curse", label: "curse the dog", fx: [["slay", "dog"]] },
        { id: "win", label: "win", fx: [["score", 5], ["end", "win", "done", "Done."]] },
      ],
    },
    b: { name: "B", desc: "B.", exits: { west: { to: "a" } } },
  },
  items: { coin: { name: "coin", loc: "inv", takeable: true } },
  npcs: { dog: { name: "dog", room: "b", hp: 3, atk: 1, df: 8, onDeath: [["say", "The dog dies."]] } },
  walkthrough: ["win"],
});

test("if runs the then-branch when every condition passes, else the else-branch", () => {
  const w = world();
  let { state } = newState(w, 1);
  assert.match(step(w, state, { kind: "custom", room: "a", id: "greet" }).events.join(" "), /rich/);
  state = step(w, state, { kind: "custom", room: "a", id: "drop" }).state;
  assert.equal(state.itemLoc["coin"], "a", "'here' resolved to the player's room");
  assert.ok(!state.inv.includes("coin"));
  assert.match(step(w, state, { kind: "custom", room: "a", id: "greet" }).events.join(" "), /poor/);
  assert.ok(legalActions(w, state).some((a) => a.kind === "take" && a.item === "coin"), "a dropped item can be picked back up");
});

test("npcgo here brings an npc to the player; slay kills it silently, without onDeath", () => {
  const w = world();
  let { state } = newState(w, 1);
  assert.equal(state.npcRoom["dog"], "b");
  state = step(w, state, { kind: "custom", room: "a", id: "call" }).state;
  assert.equal(state.npcRoom["dog"], "a");
  assert.ok(legalActions(w, state).some((a) => a.kind === "attack" && a.npc === "dog"));
  const out = step(w, state, { kind: "custom", room: "a", id: "curse" });
  assert.equal(out.state.npcHp["dog"], 0);
  assert.doesNotMatch(out.events.join(" "), /The dog dies/, "a scripted death runs no onDeath");
  assert.ok(!legalActions(w, out.state).some((a) => a.kind === "attack"));
});

test("validator: if branches are checked like any other effect list; slay and here need real ids", () => {
  const w = world();
  assert.deepEqual(validateWorld(w), []);
  w.rooms["a"]!.actions!.push({ id: "bad", label: "bad", fx: [["if", [["has", "ghost"]], [["slay", "nobody"]], [["goto", "nowhere_room"]]], ["npcgo", "dog", "here"]] });
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("bad.if: unknown item ghost")), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("bad.if.then: unknown npc nobody")), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("bad.if.else: unknown room nowhere_room")), errs.join("\n"));
  assert.ok(!errs.some((e) => /unknown room here|bad location here/.test(e)), "here is a valid effect target");
});

test("validator: a goto inside an if still counts for reachability", () => {
  const w = world();
  w.rooms["c"] = { name: "C", desc: "C." };
  w.rooms["a"]!.actions!.push({ id: "jump", label: "jump", fx: [["if", [], [["goto", "c"]], []]] });
  assert.deepEqual(validateWorld(w), []);
});

test("any passes when one listed condition passes, and is validated like any other condition", () => {
  const w = world();
  w.rooms["a"]!.actions!.push({ id: "either", label: "either", if: [["any", [["flag", "x"], ["has", "coin"]]]], fx: [["say", "ok"]] });
  let { state } = newState(w, 1);
  assert.ok(legalActions(w, state).some((a) => a.kind === "custom" && a.id === "either"), "coin in hand satisfies the any");
  state = step(w, state, { kind: "custom", room: "a", id: "drop" }).state;
  assert.ok(!legalActions(w, state).some((a) => a.kind === "custom" && a.id === "either"), "neither holds");
  state.flags["x"] = true;
  assert.ok(legalActions(w, state).some((a) => a.kind === "custom" && a.id === "either"));
  assert.deepEqual(validateWorld(w), []);
  w.rooms["a"]!.actions!.push({ id: "bad", label: "bad", if: [["any", [["has", "ghost"]]], ["any", []]], fx: [] });
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("bad.any: unknown item ghost")), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("any needs a non-empty list")), errs.join("\n"));
});
