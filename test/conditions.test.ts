/**
 * Timed conditions: named status effects with a turn duration, on the player
 * (`conds`) and on npcs (`npcConds`), plus `harm` for damage outside a roll.
 * See docs/authoring.md §"Conditions (status effects)" for the DSL.
 *
 * Map: A (start) -- north --> C (every condition-testing action lives here,
 * away from the walkthrough so the menu cap never sees it) -- east --> B (the
 * wolf). A also has a direct east exit straight to B, for a "no condition
 * applied" control path.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { armorOf, checkMod, checkModParts, combatMods, condOk, hashState, legalActions, newState, oddsHint, receipt, step } from "../src/engine.ts";
import { render, renderStatus } from "../src/format.ts";
import { validateWorld } from "../src/validate.ts";
import type { Action, World } from "../src/types.ts";

const world = (): World => ({
  id: "cond",
  title: "Cond",
  intro: "x",
  start: "a",
  hp: 30,
  maxScore: 5,
  conditions: {
    winded: { name: "winded", hit: -2, hint: "your guard is down" },
    braced: { name: "braced", armor: 2 },
    bleeding: { name: "bleeding", hpPerTurn: -1 },
    mending: { name: "mending", hpPerTurn: 2 },
    steady: { name: "steady", checks: { grace: 2 } },
    strong: { name: "strong", dmg: 3 },
  },
  rooms: {
    a: {
      name: "A",
      desc: "A.",
      exits: { north: { to: "c" }, east: { to: "b" } },
      actions: [
        { id: "win", label: "win", fx: [["score", 5], ["end", "win", "done", "Done."]] },
        { id: "look_free", label: "get your bearings", free: true, fx: [["say", "Nothing new."]] },
      ],
    },
    b: { name: "B", desc: "B.", exits: { west: { to: "a" } } },
    c: {
      name: "C",
      desc: "C.",
      exits: { south: { to: "a" }, east: { to: "b" } },
      actions: [
        { id: "wind", label: "get winded", fx: [["cond", "winded", 2]] },
        { id: "wind_long", label: "get very winded", fx: [["cond", "winded", 5]] },
        { id: "brace", label: "brace", fx: [["cond", "braced", 3]] },
        { id: "unwind", label: "shake it off", fx: [["uncond", "winded"]] },
        { id: "wait", label: "wait", fx: [["say", "You wait."]] },
        { id: "hurt_self", label: "hurt self", fx: [["hp", -29]] },
        { id: "bleed", label: "start bleeding", fx: [["cond", "bleeding", 3]] },
        { id: "mend", label: "start mending", fx: [["cond", "mending", 2]] },
        { id: "steady_up", label: "steady yourself", fx: [["cond", "steady", 3]] },
        { id: "get_strong", label: "get strong", fx: [["cond", "strong", 3]] },
        { id: "hex_wolf", label: "hex the wolf", fx: [["npccond", "wolf", "winded", 3]] },
        { id: "brace_wolf", label: "brace the wolf", fx: [["npccond", "wolf", "braced", 3]] },
        { id: "unhex_wolf", label: "lift the hex", fx: [["unnpccond", "wolf", "winded"]] },
        { id: "burn_wolf", label: "burn the wolf", fx: [["harm", "wolf", 5]] },
        { id: "smite_wolf", label: "smite the wolf", fx: [["harm", "wolf", 999]] },
        { id: "look_free", label: "get your bearings", free: true, fx: [["say", "Nothing new."]] },
      ],
    },
  },
  items: { club: { name: "club", loc: "inv", hit: 1, dmg: 2 } },
  npcs: { wolf: { name: "wolf", room: "b", hostile: true, hp: 100, atk: 4, df: 10, onDeath: [["set", "wolf_felled"]] } },
  walkthrough: ["win"],
});

test("the base world is well-formed: every new op and the conditions record validate clean", () => {
  assert.deepEqual(validateWorld(world()), []);
});

// ---------- apply, refresh, expire ----------

test("cond applies, ticks down on every spent turn, and expires with one short event", () => {
  const w = world();
  let { state } = newState(w, 1);
  state = step(w, state, { kind: "go", dir: "north" }).state;
  state = step(w, state, { kind: "custom", room: "c", id: "wind" }).state; // applied for 2, ticks to 1 this same turn
  assert.equal(state.conds["winded"], 1);
  assert.ok(condOk(w, state, ["cond", "winded"]));
  const out = step(w, state, { kind: "custom", room: "c", id: "wait" }); // 1 -> 0, expires
  assert.equal(out.state.conds["winded"], undefined);
  assert.ok(!condOk(w, out.state, ["cond", "winded"]));
  assert.ok(out.events.includes("winded passes."), out.events.join(" | "));
});

test("re-applying a condition refreshes to the longer of the two remaining durations, never shortens it", () => {
  const w = world();
  let { state } = newState(w, 1);
  state = step(w, state, { kind: "go", dir: "north" }).state;
  state = step(w, state, { kind: "custom", room: "c", id: "wind" }).state; // 2 -> 1
  assert.equal(state.conds["winded"], 1);
  state = step(w, state, { kind: "custom", room: "c", id: "wind_long" }).state; // max(1,5)=5 -> 4
  assert.equal(state.conds["winded"], 4);
  state = step(w, state, { kind: "custom", room: "c", id: "wind" }).state; // max(4,2)=4 -> 3, NOT shortened to 1
  assert.equal(state.conds["winded"], 3, "a shorter re-application never shortens the remaining duration");
});

test("uncond clears a condition outright, before it would expire on its own", () => {
  const w = world();
  let { state } = newState(w, 1);
  state = step(w, state, { kind: "go", dir: "north" }).state;
  state = step(w, state, { kind: "custom", room: "c", id: "wind_long" }).state;
  assert.ok((state.conds["winded"] ?? 0) > 0);
  state = step(w, state, { kind: "custom", room: "c", id: "unwind" }).state;
  assert.equal(state.conds["winded"], undefined);
});

// ---------- free actions tick nothing ----------

test("a free action spends no turn and ticks nothing", () => {
  const w = world();
  let { state } = newState(w, 1);
  state = step(w, state, { kind: "go", dir: "north" }).state;
  state = step(w, state, { kind: "custom", room: "c", id: "wind" }).state; // -> 1
  const turnBefore = state.turn;
  const out = step(w, state, { kind: "custom", room: "c", id: "look_free" });
  assert.equal(out.state.turn, turnBefore, "a free action spends no turn");
  assert.equal(out.state.conds["winded"], 1, "ticking did not run on a free action");
  assert.ok(!out.events.some((e) => e.includes("passes")), "no expiry fired on a free action");
});

// ---------- hpPerTurn ----------

test("hpPerTurn hurts the player each spent turn and expires like any other condition", () => {
  const w = world();
  let { state } = newState(w, 1); // hp 30
  state = step(w, state, { kind: "go", dir: "north" }).state;
  state = step(w, state, { kind: "custom", room: "c", id: "bleed" }).state; // hpPerTurn applies same turn it's granted
  assert.equal(state.hp, 29);
  assert.equal(state.conds["bleeding"], 2);
  state = step(w, state, { kind: "custom", room: "c", id: "wait" }).state;
  assert.equal(state.hp, 28);
  const out = step(w, state, { kind: "custom", room: "c", id: "wait" }); // last tick: hurts, then expires
  assert.equal(out.state.hp, 27);
  assert.equal(out.state.conds["bleeding"], undefined);
  assert.ok(out.events.includes("bleeding passes."));
});

test("hpPerTurn can kill the player through the normal death path", () => {
  const w = world();
  let { state } = newState(w, 1);
  state = step(w, state, { kind: "go", dir: "north" }).state;
  state = step(w, state, { kind: "custom", room: "c", id: "hurt_self" }).state; // hp -> 1
  assert.equal(state.hp, 1);
  assert.ok(!state.ended);
  const out = step(w, state, { kind: "custom", room: "c", id: "bleed" }); // -1 this turn kills
  assert.equal(out.state.hp, 0);
  assert.ok(out.state.ended);
  assert.equal(out.state.ended?.id, "dead");
  assert.ok(out.events.includes("You have died."));
});

test("a positive hpPerTurn heals instead of hurting", () => {
  const w = world();
  let { state } = newState(w, 1);
  state = step(w, state, { kind: "go", dir: "north" }).state;
  state = step(w, state, { kind: "custom", room: "c", id: "hurt_self" }).state; // hp -> 1
  const out = step(w, state, { kind: "custom", room: "c", id: "mend" }); // hpPerTurn +2
  assert.equal(out.state.hp, 3);
});

// ---------- every modifier field, on the player ----------

test("each player condition field changes exactly the number it claims to", () => {
  const w = world();
  let { state } = newState(w, 1);
  const baseHit = combatMods(w, state).hit;
  const baseDmg = combatMods(w, state).dmg;
  const baseArmor = armorOf(w, state);
  const baseGrace = checkMod(w, state, "grace");
  const baseWits = checkMod(w, state, "wits");

  state = step(w, state, { kind: "go", dir: "north" }).state;
  state = step(w, state, { kind: "custom", room: "c", id: "wind" }).state; // hit -2
  assert.equal(combatMods(w, state).hit, baseHit - 2);

  state = step(w, state, { kind: "custom", room: "c", id: "get_strong" }).state; // dmg +3
  assert.equal(combatMods(w, state).dmg, baseDmg + 3);

  state = step(w, state, { kind: "custom", room: "c", id: "brace" }).state; // armor +2
  assert.equal(armorOf(w, state), baseArmor + 2);
  assert.equal(combatMods(w, state).armor, baseArmor + 2);

  state = step(w, state, { kind: "custom", room: "c", id: "steady_up" }).state; // checks.grace +2
  assert.equal(checkMod(w, state, "grace"), baseGrace + 2);
  assert.equal(checkMod(w, state, "wits"), baseWits, "an unrelated check is untouched");

  const parts = checkModParts(w, state, "grace");
  assert.ok(parts.some((p) => p.label === "steady" && p.n === 2), JSON.stringify(parts));
});

// ---------- cond / npccond as conditions ----------

test("cond, !cond, npccond and !npccond read the player's and an npc's active conditions", () => {
  const w = world();
  let { state } = newState(w, 1);
  assert.ok(condOk(w, state, ["!cond", "winded"]));
  assert.ok(!condOk(w, state, ["cond", "winded"]));
  assert.ok(!condOk(w, state, ["npccond", "wolf", "braced"]));
  assert.ok(condOk(w, state, ["!npccond", "wolf", "braced"]));

  state = step(w, state, { kind: "go", dir: "north" }).state;
  state = step(w, state, { kind: "custom", room: "c", id: "wind_long" }).state; // long enough to outlast the next turn's tick too
  state = step(w, state, { kind: "custom", room: "c", id: "brace_wolf" }).state;

  assert.ok(condOk(w, state, ["cond", "winded"]));
  assert.ok(!condOk(w, state, ["!cond", "winded"]));
  assert.ok(condOk(w, state, ["npccond", "wolf", "braced"]));
  assert.ok(!condOk(w, state, ["!npccond", "wolf", "braced"]));
});

// ---------- npc conditions: df and strike ----------

test("an npc's armor condition raises its df", () => {
  const w = world();
  let { state } = newState(w, 1);
  // club hit+1, no might, no perks/conditions: need = df(10) - 1 = 9
  assert.equal(oddsHint(w, state, { kind: "attack", npc: "wolf" }), " (roll 9+ on the die)");
  state = step(w, state, { kind: "go", dir: "north" }).state;
  state = step(w, state, { kind: "custom", room: "c", id: "brace_wolf" }).state; // armor +2 -> df 12
  assert.equal(oddsHint(w, state, { kind: "attack", npc: "wolf" }), " (roll 11+ on the die)");
});

test("an npc's hit condition changes the damage its strike deals", () => {
  const w = world();
  const seed = 7;

  // control: straight to the wolf's room, no condition on it
  let { state: base } = newState(w, seed);
  base = step(w, base, { kind: "go", dir: "east" }).state;
  const beforeBase = base.hp;
  const outBase = step(w, base, { kind: "attack", npc: "wolf" });
  const takenBase = beforeBase - outBase.state.hp;
  assert.ok(takenBase > 0, "the wolf always strikes back — it has 100hp and cannot die in one blow");

  // same seed, same eventual room, but the wolf carries -2 hit first. Neither
  // the detour nor applying the condition draws from the PRNG, so the attack
  // roll a few steps later is bit-identical to the control run above.
  let { state: hexed } = newState(w, seed);
  hexed = step(w, hexed, { kind: "go", dir: "north" }).state;
  hexed = step(w, hexed, { kind: "custom", room: "c", id: "hex_wolf" }).state;
  hexed = step(w, hexed, { kind: "go", dir: "east" }).state;
  const beforeHexed = hexed.hp;
  const outHexed = step(w, hexed, { kind: "attack", npc: "wolf" });
  const takenHexed = beforeHexed - outHexed.state.hp;

  assert.equal(takenBase - takenHexed, 2, "the wolf's -2 hit condition reduces the damage its strike lands by 2");
});

// ---------- harm ----------

test("harm deals damage with no attack roll, and fires onDeath exactly once when it kills", () => {
  const w = world();
  let { state } = newState(w, 1);
  state = step(w, state, { kind: "go", dir: "north" }).state;
  state = step(w, state, { kind: "custom", room: "c", id: "burn_wolf" }).state; // -5, no roll involved
  assert.equal(state.npcHp["wolf"], 95);
  assert.ok(!state.flags["wolf_felled"]);

  const out = step(w, state, { kind: "custom", room: "c", id: "smite_wolf" }); // -999: kills
  assert.ok(out.state.npcHp["wolf"]! <= 0);
  assert.ok(out.state.flags["wolf_felled"], "onDeath ran");
  assert.ok(out.events.some((e) => e.includes("is destroyed")));

  // safe when already dead: no crash, no second onDeath, no second "destroyed" line
  const again = step(w, out.state, { kind: "custom", room: "c", id: "smite_wolf" });
  assert.ok(!again.events.some((e) => e.includes("is destroyed")));
  assert.equal(again.state.npcHp["wolf"], out.state.npcHp["wolf"], "no further loss on a corpse");
});

test("harm is safe when the target npc is absent from the world", () => {
  const w = world();
  w.rooms["c"]!.actions!.push({ id: "harm_ghost", label: "harm ghost", fx: [["harm", "ghost", 5]] });
  let { state } = newState(w, 1);
  state = step(w, state, { kind: "go", dir: "north" }).state;
  const out = step(w, state, { kind: "custom", room: "c", id: "harm_ghost" });
  assert.deepEqual(out.events, [], "no crash and no event for an npc that does not exist");
});

// ---------- rendering: zero cost when unused, visible when active ----------

test("the HUD line carries active player conditions compactly, and costs nothing when none are active", () => {
  const w = world();
  let { state } = newState(w, 1);
  const plainHead = render(w, state, []).text.split("\n")[0]!;
  assert.ok(!plainHead.includes("["), "no bracket at all when no condition is active");

  state = step(w, state, { kind: "go", dir: "north" }).state;
  state = step(w, state, { kind: "custom", room: "c", id: "wind_long" }).state; // long enough to outlast the next turn's tick too
  state = step(w, state, { kind: "custom", room: "c", id: "brace" }).state;
  const withConds = render(w, state, []).text.split("\n")[0]!;
  // sorted by id, so "braced" (b) prints before "winded" (w) regardless of application order
  assert.match(withConds, /\[braced \d+ winded \d+\]$/);
});

test("status lists active player conditions with their remaining turns and hint", () => {
  const w = world();
  let { state } = newState(w, 1);
  assert.ok(!renderStatus(w, state).includes("Conditions:"), "nothing to show yet");
  state = step(w, state, { kind: "go", dir: "north" }).state;
  state = step(w, state, { kind: "custom", room: "c", id: "wind" }).state; // -> 1 turn left
  const text = renderStatus(w, state);
  assert.match(text, /Conditions: winded \(1 turn left\) — your guard is down/);
});

test("an npc's active condition shows in its room-line parenthetical", () => {
  const w = world();
  let { state } = newState(w, 1);
  state = step(w, state, { kind: "go", dir: "north" }).state;
  state = step(w, state, { kind: "custom", room: "c", id: "brace_wolf" }).state;
  state = step(w, state, { kind: "go", dir: "east" }).state; // into the wolf's room
  const text = render(w, state, [], { full: true }).text;
  assert.match(text, /wolf \(hostile, holds its ground, hp\d+\/\d+, braced \d+\)/);
});

// ---------- determinism ----------

test("determinism: same seed and actions replay to a byte-identical receipt, conditions in play", () => {
  const w = world();
  const actions: Action[] = [
    { kind: "go", dir: "north" },
    { kind: "custom", room: "c", id: "wind" },
    { kind: "custom", room: "c", id: "brace" },
    { kind: "custom", room: "c", id: "bleed" },
    { kind: "custom", room: "c", id: "wind_long" }, // refresh
    { kind: "custom", room: "c", id: "hex_wolf" },
    { kind: "custom", room: "c", id: "brace_wolf" },
    { kind: "custom", room: "c", id: "burn_wolf" },
    { kind: "custom", room: "c", id: "wait" },
    { kind: "go", dir: "east" },
    { kind: "attack", npc: "wolf" },
    { kind: "go", dir: "west" },
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

test("validator: a conditions entry with an unknown key is rejected", () => {
  const w = world();
  (w.conditions!["winded"] as unknown as Record<string, unknown>)["bogus"] = 1;
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("condition winded") && e.includes("unknown field")), errs.join("\n"));
});

test("validator: a conditions entry's checks field rejects an unknown check name", () => {
  const w = world();
  w.conditions!["odd"] = { name: "odd", checks: { swimming: 2 } };
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("condition odd") && e.includes("unknown check name swimming")), errs.join("\n"));
});

test("validator: cond and uncond effects reject an unknown condition id", () => {
  const w = world();
  w.rooms["c"]!.actions!.push({ id: "bad1", label: "bad1", fx: [["cond", "nope", 2]] });
  w.rooms["c"]!.actions!.push({ id: "bad2", label: "bad2", fx: [["uncond", "nope"]] });
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("bad1") && e.includes("unknown condition nope")), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("bad2") && e.includes("unknown condition nope")), errs.join("\n"));
});

test("validator: npccond and unnpccond effects reject an unknown npc or condition id", () => {
  const w = world();
  w.rooms["c"]!.actions!.push({ id: "bad3", label: "bad3", fx: [["npccond", "ghost", "winded", 2]] });
  w.rooms["c"]!.actions!.push({ id: "bad4", label: "bad4", fx: [["npccond", "wolf", "nope", 2]] });
  w.rooms["c"]!.actions!.push({ id: "bad5", label: "bad5", fx: [["unnpccond", "ghost", "winded"]] });
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("bad3") && e.includes("unknown npc ghost")), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("bad4") && e.includes("unknown condition nope")), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("bad5") && e.includes("unknown npc ghost")), errs.join("\n"));
});

test("validator: harm rejects an unknown npc", () => {
  const w = world();
  w.rooms["c"]!.actions!.push({ id: "bad6", label: "bad6", fx: [["harm", "ghost", 3]] });
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("bad6") && e.includes("unknown npc ghost")), errs.join("\n"));
});

test("validator: cond and npccond conditions in an if reject unknown condition or npc ids", () => {
  const w = world();
  w.rooms["c"]!.actions!.push({ id: "bad7", label: "bad7", if: [["cond", "nope"]], fx: [["say", "x"]] });
  w.rooms["c"]!.actions!.push({ id: "bad8", label: "bad8", if: [["npccond", "wolf", "nope"]], fx: [["say", "x"]] });
  w.rooms["c"]!.actions!.push({ id: "bad9", label: "bad9", if: [["npccond", "ghost", "winded"]], fx: [["say", "x"]] });
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("bad7") && e.includes("unknown condition nope")), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("bad8") && e.includes("unknown condition nope")), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("bad9") && e.includes("unknown npc ghost")), errs.join("\n"));
});

test("validator: cond and npccond effects require their turns argument to be a number", () => {
  const w = world();
  w.rooms["c"]!.actions!.push({ id: "bad10", label: "bad10", fx: [["cond", "winded", "two" as unknown as number]] });
  w.rooms["c"]!.actions!.push({ id: "bad11", label: "bad11", fx: [["npccond", "wolf", "winded", "two" as unknown as number]] });
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("bad10") && e.includes("cond turns must be a number")), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("bad11") && e.includes("npccond turns must be a number")), errs.join("\n"));
});
