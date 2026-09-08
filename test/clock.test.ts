/**
 * The realm's own turn: `world.clock`, a list of scheduled effects
 * evaluated once per spent turn, plus the read-only `["turn", op, n]`
 * condition it is checked against. See docs/authoring.md §13 "The world
 * clock" and the design doc docs/superpowers/specs/2026-09-08-the-realm-moves.md.
 *
 * Map: same shape as conditions.test.ts — A (start) -- north --> C (every
 * clock-testing action lives here, off the walkthrough so the menu cap never
 * sees it) -- south --> back to A.
 */
import assert from "node:assert/strict";
import { unlinkSync, writeFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { condOk, hashState, newState, receipt, step } from "../src/engine.ts";
import { loadWorld, validateWorld } from "../src/validate.ts";
import type { Action, ClockEntry, Cond, World } from "../src/types.ts";

const world = (): World => ({
  id: "clock",
  title: "Clock",
  intro: "x",
  start: "a",
  hp: 30,
  maxScore: 5,
  rooms: {
    a: {
      name: "A",
      desc: "A.",
      exits: { north: { to: "c" } },
      actions: [
        { id: "win", label: "win", fx: [["score", 5], ["end", "win", "done", "Done."]] },
        { id: "look_free", label: "get your bearings", free: true, fx: [["say", "Nothing new."]] },
        { id: "die", label: "die", fx: [["hp", -30]] },
      ],
    },
    c: {
      name: "C",
      desc: "C.",
      exits: { south: { to: "a" } },
      actions: [{ id: "wait", label: "wait", fx: [["say", "You wait."]] }],
    },
  },
  items: {},
  npcs: {},
  walkthrough: ["win"],
});

test("the base world validates clean, with or without a well-formed clock", () => {
  const w = world();
  assert.deepEqual(validateWorld(w), []);
  w.clock = [
    { id: "warned", if: [["flag", "started"], ["turn", ">=", 1]], once: true, fx: [["say", "Word reaches you."]] },
    { id: "pressure", fx: [["say", "The pressure does not let up."]] },
  ];
  assert.deepEqual(validateWorld(w), []);
});

// ---------- firing ----------

test("a clock entry fires once its `if` passes", () => {
  const w = world();
  w.clock = [{ id: "warn", if: [["turn", ">=", 1]], fx: [["say", "The realm stirs."]] }];
  const { state } = newState(w, 1);
  const out = step(w, state, { kind: "go", dir: "north" }); // turn 0 -> 1, so "turn >= 1" holds this same turn
  assert.ok(out.events.includes("The realm stirs."), out.events.join(" | "));
});

test("a clock entry whose `if` does not yet hold stays silent", () => {
  const w = world();
  w.clock = [{ id: "later", if: [["turn", ">=", 5]], fx: [["say", "Too soon."]] }];
  const { state } = newState(w, 1);
  const out = step(w, state, { kind: "go", dir: "north" }); // turn 1, well short of 5
  assert.ok(!out.events.includes("Too soon."), out.events.join(" | "));
});

test("at most one clock entry fires per turn, even when several are eligible", () => {
  const w = world();
  w.clock = [
    { id: "first", fx: [["say", "First fires."]] },
    { id: "second", fx: [["say", "Second fires."]] },
  ];
  const { state } = newState(w, 1);
  const out = step(w, state, { kind: "go", dir: "north" });
  assert.ok(out.events.includes("First fires."), out.events.join(" | "));
  assert.ok(!out.events.includes("Second fires."), out.events.join(" | "));
});

test("file order decides which entry fires: reordering the same two entries changes the winner", () => {
  const w = world();
  w.clock = [
    { id: "second", fx: [["say", "Second fires."]] },
    { id: "first", fx: [["say", "First fires."]] },
  ];
  const { state } = newState(w, 1);
  const out = step(w, state, { kind: "go", dir: "north" });
  assert.ok(out.events.includes("Second fires."), out.events.join(" | "));
  assert.ok(!out.events.includes("First fires."), out.events.join(" | "));
});

// ---------- once vs recurring ----------

test("once fires exactly once and sets clocked_<id>", () => {
  const w = world();
  w.clock = [{ id: "warned", once: true, fx: [["say", "Word reaches you."]] }];
  const { state } = newState(w, 1);
  const out1 = step(w, state, { kind: "go", dir: "north" });
  assert.ok(out1.events.includes("Word reaches you."), out1.events.join(" | "));
  assert.ok(out1.state.flags["clocked_warned"]);
  const out2 = step(w, out1.state, { kind: "custom", room: "c", id: "wait" });
  assert.ok(!out2.events.includes("Word reaches you."), out2.events.join(" | "));
});

test("a non-once entry can fire again on a later turn its `if` still holds", () => {
  const w = world();
  w.clock = [{ id: "pressure", fx: [["say", "The pressure mounts."]] }];
  const { state } = newState(w, 1);
  const out1 = step(w, state, { kind: "go", dir: "north" });
  assert.ok(out1.events.includes("The pressure mounts."), out1.events.join(" | "));
  const out2 = step(w, out1.state, { kind: "custom", room: "c", id: "wait" });
  assert.ok(out2.events.includes("The pressure mounts."), out2.events.join(" | "));
  const out3 = step(w, out2.state, { kind: "custom", room: "c", id: "wait" });
  assert.ok(out3.events.includes("The pressure mounts."), out3.events.join(" | "));
});

// ---------- free actions and endings ----------

test("nothing fires on a free action", () => {
  const w = world();
  w.clock = [{ id: "pressure", fx: [["say", "The pressure mounts."]] }];
  const { state } = newState(w, 1);
  const turnBefore = state.turn;
  const out = step(w, state, { kind: "custom", room: "a", id: "look_free" });
  assert.equal(out.state.turn, turnBefore, "a free action spends no turn");
  assert.ok(!out.events.includes("The pressure mounts."), out.events.join(" | "));
});

test("nothing fires once the game has ended, even on the very turn a clock entry would otherwise be eligible", () => {
  const w = world();
  w.clock = [{ id: "pressure", fx: [["say", "The pressure mounts."]] }];
  const { state } = newState(w, 1);
  const out = step(w, state, { kind: "custom", room: "a", id: "die" }); // hp -30 ends the game this same turn
  assert.ok(out.state.ended);
  assert.ok(!out.events.includes("The pressure mounts."), out.events.join(" | "));
});

test("nothing fires when a condition's hpPerTurn ends the game the same turn, even with an always-eligible clock entry", () => {
  const w = world();
  w.conditions = { bleeding: { name: "bleeding", hpPerTurn: -1 } };
  w.rooms["c"]!.actions!.push({ id: "lethal_bleed", label: "lethal bleed", fx: [["hp", -29], ["cond", "bleeding", 3]] });
  w.clock = [{ id: "pressure", fx: [["say", "The pressure mounts."]] }];
  let { state } = newState(w, 1);
  state = step(w, state, { kind: "go", dir: "north" }).state; // into room c (this spent turn may itself fire the clock once — irrelevant here)
  // hp 30 -> 1, then bleeding's hpPerTurn ticks -1 to 0 in the SAME turn (tickConditions runs before tickClock): dies before the clock gets a look-in
  const out = step(w, state, { kind: "custom", room: "c", id: "lethal_bleed" });
  assert.ok(out.state.ended, "the condition's hpPerTurn should have ended the game this turn");
  assert.equal(out.state.ended?.id, "dead");
  assert.ok(!out.events.includes("The pressure mounts."), out.events.join(" | "));
});

test("a clock fx can end the game", () => {
  const w = world();
  w.clock = [{ id: "burns", fx: [["end", "lose", "burned", "The realm burns without you."]] }];
  const { state } = newState(w, 1);
  const out = step(w, state, { kind: "go", dir: "north" });
  assert.equal(out.state.ended?.kind, "lose");
  assert.equal(out.state.ended?.id, "burned");
});

// ---------- the turn condition ----------

test("the turn condition supports every comparator", () => {
  const w = world();
  let { state } = newState(w, 1);
  state = step(w, state, { kind: "go", dir: "north" }).state; // turn 1
  state = step(w, state, { kind: "custom", room: "c", id: "wait" }).state; // turn 2
  state = step(w, state, { kind: "custom", room: "c", id: "wait" }).state; // turn 3
  assert.equal(state.turn, 3);
  assert.ok(condOk(w, state, ["turn", "=", 3]));
  assert.ok(!condOk(w, state, ["turn", "=", 2]));
  assert.ok(condOk(w, state, ["turn", "<", 4]));
  assert.ok(!condOk(w, state, ["turn", "<", 3]));
  assert.ok(condOk(w, state, ["turn", ">", 2]));
  assert.ok(!condOk(w, state, ["turn", ">", 3]));
  assert.ok(condOk(w, state, ["turn", ">=", 3]));
  assert.ok(condOk(w, state, ["turn", ">=", 2]));
  assert.ok(!condOk(w, state, ["turn", ">=", 4]));
  assert.ok(condOk(w, state, ["turn", "<=", 3]));
  assert.ok(condOk(w, state, ["turn", "<=", 4]));
  assert.ok(!condOk(w, state, ["turn", "<=", 2]));
});

// ---------- determinism ----------

test("determinism: same seed and actions replay to a byte-identical receipt, a clock (with a chance draw) running", () => {
  const w = world();
  w.clock = [{ id: "roll", fx: [["chance", 50, [["say", "Something shifts."]], [["say", "Nothing more."]]]] }];
  const actions: Action[] = [
    { kind: "go", dir: "north" },
    { kind: "custom", room: "c", id: "wait" },
    { kind: "custom", room: "c", id: "wait" },
    { kind: "custom", room: "c", id: "wait" },
    { kind: "go", dir: "south" },
    { kind: "custom", room: "a", id: "win" },
  ];
  const run = () => {
    let { state } = newState(w, 42);
    for (const a of actions) state = step(w, state, a).state;
    return { receipt: receipt(w, state), hash: hashState(state) };
  };
  const r1 = run();
  const r2 = run();
  assert.equal(r1.hash, r2.hash);
  assert.equal(r1.receipt, r2.receipt);
  assert.ok(r1.receipt.includes(".done."), r1.receipt);
});

// ---------- validator: closed DSL ----------

test("validator: a clock entry with an unknown key is rejected", () => {
  const w = world();
  w.clock = [{ id: "x", fx: [["say", "hi"]], bogus: 1 } as unknown as ClockEntry];
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("clock x") && e.includes("unknown field bogus")), errs.join("\n"));
});

test("validator: a clock entry missing required fields is rejected", () => {
  const w = world();
  w.clock = [{ fx: [["say", "hi"]] } as unknown as ClockEntry]; // no id
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes('missing or non-string "id"')), errs.join("\n"));
});

test("validator: a turn condition with a bad operator is rejected", () => {
  const w = world();
  w.clock = [{ id: "bad", if: [["turn", "~=", 3] as unknown as Cond], fx: [["say", "x"]] }];
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("clock bad") && e.includes("bad turn comparator")), errs.join("\n"));
});

test("validator: a clock fx naming an unknown room is rejected", () => {
  const w = world();
  w.clock = [{ id: "bad_room", fx: [["goto", "nowhere_at_all"]] }];
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("clock bad_room") && e.includes("unknown room nowhere_at_all")), errs.join("\n"));
});

test("validator: a clock fx naming an unknown npc is rejected", () => {
  const w = world();
  w.clock = [{ id: "bad_npc", fx: [["harm", "ghost", 3]] }];
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("clock bad_npc") && e.includes("unknown npc ghost")), errs.join("\n"));
});

test("validator: a duplicate clock id is rejected", () => {
  const w = world();
  w.clock = [
    { id: "same", fx: [["say", "one"]] },
    { id: "same", fx: [["say", "two"]] },
  ];
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("clock: duplicate id same")), errs.join("\n"));
});

test("a part file's clock entries concatenate into the root's, in file order", () => {
  const rootPath = fileURLToPath(new URL("./fixtures/.tmp_clock_include_root.json", import.meta.url));
  const partPath = fileURLToPath(new URL("./fixtures/.tmp_clock_include_part.json", import.meta.url));
  const root = {
    id: "cr", title: "CR", intro: "x", start: "a", hp: 10, maxScore: 5,
    include: [".tmp_clock_include_part.json"],
    rooms: { a: { name: "A", desc: "A.", actions: [{ id: "win", label: "win", fx: [["score", 5], ["end", "win", "done", "Done."]] }] } },
    items: {}, npcs: {}, walkthrough: ["win"],
    clock: [{ id: "root_one", fx: [["say", "root"]] }],
  };
  const part = { clock: [{ id: "part_one", fx: [["say", "part"]] }] };
  writeFileSync(rootPath, JSON.stringify(root));
  writeFileSync(partPath, JSON.stringify(part));
  try {
    const w = loadWorld(rootPath);
    // the root's own entries come first, so file order is also the priority
    // order the engine's one-a-turn rule reads
    assert.deepEqual((w.clock ?? []).map((e) => e.id), ["root_one", "part_one"]);
    assert.deepEqual(validateWorld(w), []);
  } finally {
    unlinkSync(rootPath);
    unlinkSync(partPath);
  }
});

test("a clock id a part reuses is a load error naming the file that got there first", () => {
  const rootPath = fileURLToPath(new URL("./fixtures/.tmp_clock_dup_root.json", import.meta.url));
  const partPath = fileURLToPath(new URL("./fixtures/.tmp_clock_dup_part.json", import.meta.url));
  const otherPath = fileURLToPath(new URL("./fixtures/.tmp_clock_dup_other.json", import.meta.url));
  const base = {
    id: "cr", title: "CR", intro: "x", start: "a", hp: 10, maxScore: 5,
    rooms: { a: { name: "A", desc: "A.", actions: [{ id: "win", label: "win", fx: [["score", 5], ["end", "win", "done", "Done."]] }] } },
    items: {}, npcs: {}, walkthrough: ["win"],
  };
  // a part colliding with the root
  writeFileSync(rootPath, JSON.stringify({ ...base, include: [".tmp_clock_dup_part.json"], clock: [{ id: "march", fx: [["say", "root"]] }] }));
  writeFileSync(partPath, JSON.stringify({ clock: [{ id: "march", fx: [["say", "part"]] }] }));
  try {
    assert.throws(() => loadWorld(rootPath), /clock id "march" already defined in the root file/);
  } finally {
    unlinkSync(rootPath);
    unlinkSync(partPath);
  }
  // and two parts colliding with each other, where the message has to name a part
  writeFileSync(rootPath, JSON.stringify({ ...base, include: [".tmp_clock_dup_part.json", ".tmp_clock_dup_other.json"] }));
  writeFileSync(partPath, JSON.stringify({ clock: [{ id: "march", fx: [["say", "one"]] }] }));
  writeFileSync(otherPath, JSON.stringify({ clock: [{ id: "march", fx: [["say", "two"]] }] }));
  try {
    assert.throws(() => loadWorld(rootPath), /clock id "march" already defined in \.tmp_clock_dup_part\.json/);
  } finally {
    unlinkSync(rootPath);
    unlinkSync(partPath);
    unlinkSync(otherPath);
  }
});
