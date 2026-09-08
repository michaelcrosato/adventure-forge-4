/**
 * Actions available generally, not tied to one room — `world.abilities`, the
 * `resources` pools they spend, the "ability" Action kind, and the new
 * room-scoped DSL primitives abilities need (`harmhostile`, `condhostile`,
 * `calmhostile`, `revive`, `sayunvisited`, and the conds `horrorHere`,
 * `holdsGround`, `companionDown`, `checkHere`). Also the disengage change:
 * `leave` relaxed to an aggressive npc, at the price of one strike and a
 * short suppression (see docs/authoring.md §7/§8 and the reach's abilities
 * change).
 *
 * Map: A (start; win, a hearth rest, self-harm, a free survey) -- east --> B
 * (an aggressive wolf and a companion, for combat-context abilities, the
 * harmhostile/condhostile/revive fx, and the disengage tests) -- west --> A.
 * A -- north --> C (a non-aggressive pierce "horror", for horrorHere /
 * holdsGround / calmhostile). A -- south --> D (one room action, to check
 * abilities sort after it). A -- up --> CAP (eleven room actions plus its
 * own exit — twelve already, the cap — to check abilities respect it). A
 * -- down --> CHECK (a visible hard wits check, for checkHere). A -- in -->
 * E (a landmark, left unvisited, for sayunvisited).
 */
import assert from "node:assert/strict";
import { unlinkSync, writeFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { actionLabel, condOk, hashState, legalActions, newState, oddsHint, receipt, step } from "../src/engine.ts";
import { loadWorld, validateWorld } from "../src/validate.ts";
import { MENU_CAP } from "../src/types.ts";
import type { AbilityDef, Action, State, World } from "../src/types.ts";

const world = (): World => ({
  id: "ability",
  title: "Ability",
  intro: "x",
  start: "a",
  hp: 30,
  maxScore: 5,
  classes: {
    warden: { name: "Warden", desc: "warden" },
    scout: { name: "Scout", desc: "scout" },
  },
  regions: { r1: { name: "Region One" } },
  conditions: {
    braced: { name: "braced", armor: 2 },
    winded: { name: "winded", hit: -2 },
    insight: { name: "insight", checks: { wits: 4 } },
  },
  resources: { res_warden: 2 },
  abilities: {
    brace: {
      label: "brace for it",
      context: "combat",
      if: [["class", "warden"], ["var", "res_warden", ">=", 1]],
      fx: [["addvar", "res_warden", -1], ["cond", "braced", 2], ["say", "You set your feet."]],
    },
    weight: {
      label: "take the weight",
      context: "combat",
      if: [["class", "warden"], ["companionDown"]],
      fx: [["revive"], ["say", "Up you get."]],
    },
    bearings: {
      label: "size up the field",
      free: true,
      if: [["class", "warden"]],
      fx: [["say", "You take stock."]],
    },
    shout: {
      label: "shout once",
      once: true,
      if: [["class", "warden"]],
      fx: [["say", "You shout."]],
    },
    calm_it: {
      label: "calm it",
      context: "combat",
      if: [["class", "scout"], ["horrorHere"], ["holdsGround"]],
      fx: [["calmhostile"], ["say", "It settles."]],
    },
    study: {
      label: "study hard",
      if: [["class", "scout"], ["checkHere", "wits", 11]],
      fx: [["cond", "insight", 2], ["say", "You focus."]],
    },
  },
  rooms: {
    a: {
      name: "A",
      desc: "A.",
      region: "r1",
      landmark: "Alpha",
      exits: {
        east: { to: "b" }, north: { to: "c" }, south: { to: "d" },
        up: { to: "cap_room" }, down: { to: "check_room" }, in: { to: "e" },
      },
      actions: [
        { id: "win", label: "win", fx: [["score", 5], ["end", "win", "done", "Done."]] },
        { id: "rest_here", label: "rest at the hearth", fx: [["hp", 5], ["say", "You rest."]] },
        { id: "hurt_self", label: "hurt self", fx: [["hp", -20]] },
        { id: "survey", label: "survey the land", fx: [["sayunvisited"]] },
      ],
    },
    b: {
      name: "B",
      desc: "B.",
      exits: { west: { to: "a" } },
      actions: [
        { id: "burn_wolf", label: "burn the wolf", fx: [["harmhostile", 5]] },
        { id: "hex_wolf", label: "hex the wolf", fx: [["condhostile", "winded", 3]] },
        { id: "revive_now", label: "revive now", fx: [["revive"]] },
      ],
    },
    c: { name: "C", desc: "C.", exits: { south: { to: "a" } }, actions: [{ id: "soothe", label: "soothe it", fx: [["calmhostile"]] }] },
    d: { name: "D", desc: "D.", exits: { north: { to: "a" } }, actions: [{ id: "d_act", label: "do a thing here", fx: [["say", "You do it."]] }] },
    cap_room: {
      name: "Cap",
      desc: "Cap.",
      noTravel: true, // otherwise "Alpha" (already visited) offers a 13th entry: travel — not what this room is testing
      exits: { down: { to: "a" } }, // one exit + eleven actions = twelve, exactly the cap, before any ability
      actions: Array.from({ length: 11 }, (_, i) => ({ id: `cap_${i}`, label: `cap action ${i}`, free: true, fx: [["say", "x"]] })),
    },
    check_room: {
      name: "Check",
      desc: "Check.",
      exits: { up: { to: "a" } },
      actions: [{ id: "hard_check", label: "attempt the hard thing", fx: [["check", "wits", 11, [["say", "ok"]], [["say", "no"]]]] }],
    },
    e: { name: "E", desc: "E.", region: "r1", landmark: "Echo", exits: { out: { to: "a" } } },
  },
  items: {},
  npcs: {
    wolf: { name: "wolf", room: "b", hostile: true, aggressive: true, hp: 10, atk: 3, df: 10 },
    wight: { name: "wight", room: "c", hostile: true, pierce: true, hp: 8, atk: 2, df: 9 },
    ally: { name: "Ally", room: "b", hp: 6, companion: {} },
  },
  walkthrough: ["be a Warden — warden", "win"],
});

/** Resolve the class-pick phase via the real "classpick" action (not a direct field write), so enterRoom/onEnter run exactly as a real game's first turn does. */
function pickClass(w: World, cls: string, seed = 1): State {
  const { state } = newState(w, seed);
  return step(w, state, { kind: "classpick", id: cls }).state;
}

test("the base world is well-formed: abilities, resources, and every new op validate clean", () => {
  assert.deepEqual(validateWorld(world()), []);
});

// ---------- visibility: if, context, once, free ----------

test("an ability appears when its `if` holds and not otherwise", () => {
  const w = world();
  assert.ok(!legalActions(w, pickClass(w, "scout")).some((a) => a.kind === "ability" && a.id === "bearings"), "bearings needs class warden");
  assert.ok(legalActions(w, pickClass(w, "warden")).some((a) => a.kind === "ability" && a.id === "bearings"));
});

test('context: "combat" hides an ability with no hostile present, and shows it once one stands here', () => {
  const w = world();
  let state = pickClass(w, "warden");
  assert.ok(!legalActions(w, state).some((a) => a.kind === "ability" && a.id === "brace"), "no hostile in room a");
  state = step(w, state, { kind: "go", dir: "east" }).state; // into room b, the wolf's room
  assert.ok(legalActions(w, state).some((a) => a.kind === "ability" && a.id === "brace"), "the wolf is hostile and here");
});

test("a resource pool decrements on use and blocks the ability once it reaches zero", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "east" }).state;
  assert.equal(state.vars["res_warden"], 2);
  state = step(w, state, { kind: "ability", id: "brace" }).state;
  assert.equal(state.vars["res_warden"], 1);
  assert.ok(legalActions(w, state).some((a) => a.kind === "ability" && a.id === "brace"), "one point left, still offered");
  state = step(w, state, { kind: "ability", id: "brace" }).state;
  assert.equal(state.vars["res_warden"], 0);
  assert.ok(!legalActions(w, state).some((a) => a.kind === "ability" && a.id === "brace"), "empty pool blocks the ability");
});

test("an ability's menu preview says how much of its pool is left, and the number moves as it's spent", () => {
  // Playtest finding: the menu offered "brace for it" / "break them", both
  // spending from a pool of 2, and neither line said so — a Warden learned
  // the pool was empty from an option's absence on the third press, not from
  // being told. oddsHint now reads the cost off the same two places status
  // does (the ability's own `addvar res_warden -1` and `world.resources`),
  // so the price is stated before the turn, like every other cost in this file.
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "east" }).state; // the wolf's room: brace is context "combat"
  const brace = { kind: "ability", id: "brace" } as Action;
  assert.equal(oddsHint(w, state, brace), " (2 of 2 left)");
  state = step(w, state, brace).state;
  assert.equal(oddsHint(w, state, brace), " (1 of 2 left)", "one spent, one shown remaining — matches status's own count");
  state = step(w, state, brace).state;
  assert.equal(state.vars["res_warden"], 0);
  assert.ok(!legalActions(w, state).some((a) => a.kind === "ability" && a.id === "brace"), "empty pool: gone from the menu entirely, not shown at 0");
});

test("a free ability that also spends a pool reads both: no turn, but a real point spent", () => {
  // "free" is the turn, not the price (docs §4) — an ability can be free of
  // one and not the other, and the menu has to say both when both are true.
  const w: World = {
    id: "freecost", title: "x", intro: "x", start: "a", hp: 10, maxScore: 5,
    classes: { warden: { name: "Warden", desc: "warden" } },
    resources: { res_warden: 2 },
    abilities: {
      glance: { label: "take a glance", free: true, if: [["class", "warden"], ["var", "res_warden", ">=", 1]], fx: [["addvar", "res_warden", -1], ["say", "You look."]] },
    },
    rooms: { a: { name: "A", desc: "A." } },
    items: {}, npcs: {}, walkthrough: [],
  };
  const state = pickClass(w, "warden");
  assert.equal(oddsHint(w, state, { kind: "ability", id: "glance" } as Action), " (free; 2 of 2 left)");
});

test("an ability with no resource cost previews no pool hint", () => {
  const w = world();
  const state = pickClass(w, "warden");
  // "bearings" is free and spends nothing — no pool to name
  assert.equal(oddsHint(w, state, { kind: "ability", id: "bearings" } as Action), " (free)");
});

test("a rest (a room action's positive hp) refreshes every resource pool to full", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "east" }).state;
  state = step(w, state, { kind: "ability", id: "brace" }).state;
  state = step(w, state, { kind: "ability", id: "brace" }).state;
  assert.equal(state.vars["res_warden"], 0);
  state = step(w, state, { kind: "go", dir: "west" }).state; // back to room a
  state = step(w, state, { kind: "custom", room: "a", id: "rest_here" }).state;
  assert.equal(state.vars["res_warden"], 2, "refreshed to the full value, not merely topped up");
});

test("a rest sets the pool to full, not adds — a rest taken above zero does not overfill it", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "custom", room: "a", id: "rest_here" }).state;
  assert.equal(state.vars["res_warden"], 2, "still exactly the full value");
});

test("newState starts every resource pool at its full value, before any class is even picked", () => {
  const w = world();
  const { state } = newState(w, 1);
  assert.equal(state.vars["res_warden"], 2);
});

test("once works: the ability fires, sets did_<id>, and then hides itself", () => {
  const w = world();
  const state = pickClass(w, "warden");
  assert.ok(legalActions(w, state).some((a) => a.kind === "ability" && a.id === "shout"));
  const out = step(w, state, { kind: "ability", id: "shout" });
  assert.ok(out.events.includes("You shout."), out.events.join(" | "));
  assert.ok(out.state.flags["did_shout"]);
  assert.ok(!legalActions(w, out.state).some((a) => a.kind === "ability" && a.id === "shout"));
});

test("a free ability costs no turn", () => {
  const w = world();
  const state = pickClass(w, "warden");
  const turnBefore = state.turn;
  const out = step(w, state, { kind: "ability", id: "bearings" });
  assert.equal(out.state.turn, turnBefore);
  assert.ok(out.events.includes("You take stock."), out.events.join(" | "));
});

// ---------- ordering and the menu cap ----------

test("abilities sort after a room's own actions", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "south" }).state; // room d: one room action, plus "bearings" (free, any room)
  const acts = legalActions(w, state);
  const roomIdx = acts.findIndex((a) => a.kind === "custom" && a.id === "d_act");
  const abilityIdx = acts.findIndex((a) => a.kind === "ability");
  assert.ok(roomIdx >= 0 && abilityIdx >= 0, acts.map((a) => a.kind).join(","));
  assert.ok(roomIdx < abilityIdx, "the room's own action reads before the ability");
});

test("the menu cap is respected: a room already at the cap shows no abilities, however many are eligible", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "up" }).state; // cap_room: eleven actions + one exit = 12 already
  const acts = legalActions(w, state);
  assert.equal(acts.length, MENU_CAP);
  assert.ok(!acts.some((a) => a.kind === "ability"), "a full room leaves no seats for an ability");
});

test("the menu cap is respected: an ability still shows when there is room for it", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "south" }).state; // room d: one action, well under the cap
  const acts = legalActions(w, state);
  assert.ok(acts.length <= MENU_CAP);
  assert.ok(acts.some((a) => a.kind === "ability" && a.id === "bearings"));
});

// ---------- the new fx ops abilities lean on ----------

test("harmhostile damages every hostile npc in the room, like harm but with no named target", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "east" }).state;
  const out = step(w, state, { kind: "custom", room: "b", id: "burn_wolf" });
  assert.equal(out.state.npcHp["wolf"], 5);
});

test("condhostile puts a timed condition on every hostile npc in the room", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "east" }).state;
  const out = step(w, state, { kind: "custom", room: "b", id: "hex_wolf" });
  assert.equal(out.state.npcConds["wolf"]?.["winded"], 2, "applied for 3, ticks to 2 this same spent turn");
});

test("calmhostile calms every hostile npc in the room, like calm but with no named target", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "north" }).state; // room c: the wight
  const out = step(w, state, { kind: "custom", room: "c", id: "soothe" });
  assert.ok(out.state.flags["calm_wight"]);
  assert.ok(out.events.includes("The wight stands down."), out.events.join(" | "));
});

test("revive gets a downed party member back up, at half their max hp, without waiting for recoverDowned (no hostile left to force the wait)", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "east" }).state; // room b
  state.npcRoom["wolf"] = null; // isolate revive from the pre-existing strike-rotation: a live aggressive
  // npc striking back the same turn is a real, separate interaction (combat rotation can re-down a
  // companion revived at low hp) — not what this test is proving
  state.party = ["ally"];
  state.flags["down_ally"] = true;
  state.npcHp["ally"] = 1;
  const out = step(w, state, { kind: "custom", room: "b", id: "revive_now" });
  assert.ok(!out.state.flags["down_ally"]);
  assert.equal(out.state.npcHp["ally"], 3); // ceil(6/2)
  assert.ok(out.events.some((e) => e.includes("back on their feet")), out.events.join(" | "));
});

test("sayunvisited names this room's region's landmarks not yet visited", () => {
  const w = world();
  const state = pickClass(w, "warden"); // enters "a" for real, so it counts as visited
  const out = step(w, state, { kind: "custom", room: "a", id: "survey" });
  assert.ok(out.events.some((e) => e.includes("Echo")), out.events.join(" | "));
  assert.ok(!out.events.some((e) => e.includes("Alpha")), "the start room is already visited, and should not list itself");
});

test("sayunvisited says so once every regional landmark has been seen", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "in" }).state; // visit e (Echo)
  state = step(w, state, { kind: "go", dir: "out" }).state; // back to a
  const out = step(w, state, { kind: "custom", room: "a", id: "survey" });
  assert.ok(out.events.some((e) => e.includes("every place marked")), out.events.join(" | "));
});

// ---------- the new cond ops abilities lean on ----------

test("horrorHere and holdsGround: the wight (a non-aggressive pierce hostile) trips both", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "north" }).state;
  assert.ok(condOk(w, state, ["horrorHere"]));
  assert.ok(condOk(w, state, ["holdsGround"]));
});

test("horrorHere is false without a pierce hostile present; holdsGround is false with only an aggressive one", () => {
  const w = world();
  let state = pickClass(w, "warden");
  assert.ok(!condOk(w, state, ["horrorHere"]), "no npc at all in room a");
  state = step(w, state, { kind: "go", dir: "east" }).state; // the wolf: hostile, aggressive, not pierce
  assert.ok(!condOk(w, state, ["horrorHere"]));
  assert.ok(!condOk(w, state, ["holdsGround"]));
});

test("companionDown reads the down_<id> flag across the whole party", () => {
  const w = world();
  const { state } = newState(w, 1);
  assert.ok(!condOk(w, state, ["companionDown"]));
  state.party = ["ally"];
  state.flags["down_ally"] = true;
  assert.ok(condOk(w, state, ["companionDown"]));
});

test("lowHp is true at half hp or less, the same threshold the disengage gate uses", () => {
  const w = world();
  const state = pickClass(w, "warden"); // classpick heals to full: 30/30
  assert.ok(!condOk(w, state, ["lowHp"]));
  state.hp = 16;
  assert.ok(!condOk(w, state, ["lowHp"]), "above half");
  state.hp = 15;
  assert.ok(condOk(w, state, ["lowHp"]), "exactly half counts");
  state.hp = 1;
  assert.ok(condOk(w, state, ["lowHp"]));
});

test("checkHere is true only where a currently-visible action previews a check of that skill at dc >= n", () => {
  const w = world();
  let state = pickClass(w, "warden");
  assert.ok(!condOk(w, state, ["checkHere", "wits", 11]), "room a has no such action");
  state = step(w, state, { kind: "go", dir: "down" }).state; // check_room: a visible wits-11 check
  assert.ok(condOk(w, state, ["checkHere", "wits", 11]));
  assert.ok(!condOk(w, state, ["checkHere", "wits", 12]), "the check previews dc 11, not 12+");
  assert.ok(!condOk(w, state, ["checkHere", "will", 11]), "right dc, wrong skill");
});

// ---------- disengage: leave, relaxed to an aggressive npc ----------

test("a non-aggressive hostile's leave is unchanged: free, no strike, wide berth", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "north" }).state; // the wight, hostile but not aggressive
  const hpBefore = state.hp;
  const turnBefore = state.turn;
  const out = step(w, state, { kind: "leave", npc: "wight" });
  assert.equal(out.state.turn, turnBefore, "leave costs no turn");
  assert.equal(out.state.hp, hpBefore, "no strike");
  assert.ok(out.state.flags["left_wight"]);
  assert.ok(out.events.some((e) => e.includes("wide berth")), out.events.join(" | "));
});

test("leave is not offered against an aggressive npc while the fight is not going badly", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "east" }).state; // the wolf, at full hp
  assert.ok(!legalActions(w, state).some((a) => a.kind === "leave"));
});

test("leave against an aggressive npc, once the fight is going badly, costs one strike and then does not immediately resume", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "east" }).state;
  state.hp = 10; // <= half of 30: the fight is going badly
  assert.ok(legalActions(w, state).some((a) => a.kind === "leave" && a.npc === "wolf"));
  const afterLeave = step(w, state, { kind: "leave", npc: "wolf" });
  assert.equal(afterLeave.state.turn, state.turn, "leave still costs no turn of its own");
  assert.ok(afterLeave.state.hp < state.hp, "the parting strike landed");
  assert.ok((afterLeave.state.npcConds["wolf"]?.["disengaged"] ?? 0) > 0, "a suppression is now on the wolf");
  // stay in the room and spend a turn: the wolf should not strike again while disengaged holds
  const hpAfterLeave = afterLeave.state.hp;
  const waited = step(w, afterLeave.state, { kind: "custom", room: "b", id: "burn_wolf" });
  assert.equal(waited.state.hp, hpAfterLeave, "no second strike the very next turn");
});

test("disengaged eventually wears off and the wolf strikes again", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "east" }).state;
  state.hp = 10;
  state = step(w, state, { kind: "leave", npc: "wolf" }).state;
  const hpAfterLeave = state.hp;
  // burn_wolf is a plain custom action (spends a turn), which ticks the suppression down each time
  state = step(w, state, { kind: "custom", room: "b", id: "burn_wolf" }).state; // disengaged 2 -> 1
  state = step(w, state, { kind: "custom", room: "b", id: "hex_wolf" }).state; // disengaged 1 -> 0, expires
  assert.ok(!state.npcConds["wolf"]?.["disengaged"]);
  const afterExpiry = step(w, state, { kind: "custom", room: "b", id: "hex_wolf" }); // a plain spent turn: aggressivePass runs
  assert.ok(afterExpiry.state.hp < state.hp, "the wolf strikes again once the suppression has worn off");
});

test('the menu states the price before it is taken: "(a strike)" once hp is low enough to offer it', () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "east" }).state;
  state.hp = 10;
  const leaveAction = legalActions(w, state).find((a) => a.kind === "leave") as Extract<Action, { kind: "leave" }> | undefined;
  assert.ok(leaveAction);
  assert.equal(oddsHint(w, state, leaveAction!), " (a strike)");
});

test("a non-aggressive hostile's leave hint is still just \"(free)\", unchanged", () => {
  const w = world();
  let state = pickClass(w, "warden");
  state = step(w, state, { kind: "go", dir: "north" }).state;
  const leaveAction = legalActions(w, state).find((a) => a.kind === "leave") as Extract<Action, { kind: "leave" }>;
  assert.equal(oddsHint(w, state, leaveAction), " (free)");
});

test("a Scout with res_scout to spend breaks away from an aggressive npc for free — no strike, still suppressed", () => {
  const w = world();
  w.resources!["res_scout"] = 1;
  let state = pickClass(w, "scout");
  state = step(w, state, { kind: "go", dir: "east" }).state;
  state.hp = 10;
  assert.equal(state.vars["res_scout"], 1);
  const leaveAction = legalActions(w, state).find((a) => a.kind === "leave") as Extract<Action, { kind: "leave" }>;
  assert.equal(oddsHint(w, state, leaveAction), " (free: slip away)");
  const out = step(w, state, { kind: "leave", npc: "wolf" });
  assert.equal(out.state.hp, state.hp, "no strike lands");
  assert.equal(out.state.vars["res_scout"], 0, "the point is spent instead");
  assert.ok((out.state.npcConds["wolf"]?.["disengaged"] ?? 0) > 0, "still suppressed, same as the costly route");
});

// ---------- determinism ----------

test("determinism: same seed and actions (an ability among them) replay to a byte-identical receipt", () => {
  const w = world();
  const actions: Action[] = [
    { kind: "classpick", id: "warden" },
    { kind: "go", dir: "east" },
    { kind: "ability", id: "brace" },
    { kind: "custom", room: "b", id: "burn_wolf" },
    { kind: "go", dir: "west" },
    { kind: "custom", room: "a", id: "win" },
  ];
  const run = () => {
    let { state } = newState(w, 9);
    for (const a of actions) state = step(w, state, a).state;
    return { receipt: receipt(w, state), hash: hashState(state) };
  };
  const r1 = run();
  const r2 = run();
  assert.equal(r1.hash, r2.hash);
  assert.equal(r1.receipt, r2.receipt);
  assert.ok(r1.receipt.includes(".done."), r1.receipt);
});

// ---------- actionLabel ----------

test("actionLabel for an ability is its authored label", () => {
  const w = world();
  const { state } = newState(w, 1);
  assert.equal(actionLabel(w, { kind: "ability", id: "brace" }, state), "brace for it");
});

// ---------- validator: closed DSL ----------

test("validator: an ability with an unknown key is rejected", () => {
  const w = world();
  (w.abilities as Record<string, AbilityDef>)["bad"] = { label: "x", fx: [["say", "hi"]], bogus: 1 } as unknown as AbilityDef;
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("ability bad") && e.includes("unknown field bogus")), errs.join("\n"));
});

test("validator: an ability missing required fields is rejected", () => {
  const w = world();
  (w.abilities as Record<string, AbilityDef>)["bad"] = { fx: [["say", "hi"]] } as unknown as AbilityDef; // no label
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes('missing or non-string "label"')), errs.join("\n"));
});

test("validator: an ability with a bad context is rejected", () => {
  const w = world();
  (w.abilities as Record<string, AbilityDef>)["bad"] = { label: "x", context: "somewhere" as unknown as "combat", fx: [["say", "hi"]] };
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("ability bad") && e.includes("context must be")), errs.join("\n"));
});

test("validator: an ability naming an unknown condition is rejected", () => {
  const w = world();
  (w.abilities as Record<string, AbilityDef>)["bad"] = { label: "x", fx: [["cond", "no_such_condition", 2]] };
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("ability bad") && e.includes("unknown condition no_such_condition")), errs.join("\n"));
});

test("validator: an ability naming an unknown condition through condhostile is rejected too", () => {
  const w = world();
  (w.abilities as Record<string, AbilityDef>)["bad"] = { label: "x", fx: [["condhostile", "no_such_condition", 2]] };
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("unknown condition no_such_condition")), errs.join("\n"));
});

test("validator: harmhostile and condhostile with a bad shape are rejected", () => {
  const w = world();
  (w.abilities as Record<string, AbilityDef>)["bad1"] = { label: "x", fx: [["harmhostile", "lots" as unknown as number]] };
  (w.abilities as Record<string, AbilityDef>)["bad2"] = { label: "y", fx: [["condhostile", "winded", "long" as unknown as number]] };
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("harmhostile amount must be a number")), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("condhostile turns must be a number")), errs.join("\n"));
});

test("validator: a resources entry that is not a positive number is rejected", () => {
  for (const bad of [0, -1, "two"]) {
    const w = world();
    (w.resources as Record<string, number>)["res_bad"] = bad as unknown as number;
    const errs = validateWorld(w);
    assert.ok(errs.some((e) => e.includes("resources res_bad") && e.includes("must be a positive number")), `${bad}: ${errs.join("\n")}`);
  }
});

test("a part file carrying `abilities` is a load error, like any other root-only field", () => {
  const rootPath = fileURLToPath(new URL("./fixtures/.tmp_ability_include_root.json", import.meta.url));
  const partPath = fileURLToPath(new URL("./fixtures/.tmp_ability_include_part.json", import.meta.url));
  const root = {
    id: "ar", title: "AR", intro: "x", start: "a", hp: 10, maxScore: 5,
    include: [".tmp_ability_include_part.json"],
    rooms: { a: { name: "A", desc: "A.", actions: [{ id: "win", label: "win", fx: [["score", 5], ["end", "win", "done", "Done."]] }] } },
    items: {}, npcs: {}, walkthrough: ["win"],
  };
  const part = { abilities: { x: { label: "x", fx: [["say", "hi"]] } } };
  writeFileSync(rootPath, JSON.stringify(root));
  writeFileSync(partPath, JSON.stringify(part));
  try {
    assert.throws(() => loadWorld(rootPath), /"abilities" belongs in the root world file/);
  } finally {
    unlinkSync(rootPath);
    unlinkSync(partPath);
  }
});

test("a part file carrying `resources` is a load error, like any other root-only field", () => {
  const rootPath = fileURLToPath(new URL("./fixtures/.tmp_resources_include_root.json", import.meta.url));
  const partPath = fileURLToPath(new URL("./fixtures/.tmp_resources_include_part.json", import.meta.url));
  const root = {
    id: "rr", title: "RR", intro: "x", start: "a", hp: 10, maxScore: 5,
    include: [".tmp_resources_include_part.json"],
    rooms: { a: { name: "A", desc: "A.", actions: [{ id: "win", label: "win", fx: [["score", 5], ["end", "win", "done", "Done."]] }] } },
    items: {}, npcs: {}, walkthrough: ["win"],
  };
  const part = { resources: { res_x: 2 } };
  writeFileSync(rootPath, JSON.stringify(root));
  writeFileSync(partPath, JSON.stringify(part));
  try {
    assert.throws(() => loadWorld(rootPath), /"resources" belongs in the root world file/);
  } finally {
    unlinkSync(rootPath);
    unlinkSync(partPath);
  }
});
