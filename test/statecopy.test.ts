/**
 * How a turn copies, compares and hashes its state.
 *
 * Three pieces of machinery no player ever sees, and all three are load-bearing:
 * `step` copies the state so the caller keeps the one it handed in, the crawler
 * compares two copies to catch nondeterminism, and `receipt` hashes one so a
 * playtester's reported outcome can be checked against a replay. Each was made
 * faster (the Reach's per-turn cost was walking every npc, every item and every
 * quest in the realm, and serializing the whole state twice a step); these are
 * the tests that say the speed cost nothing.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { hashState, legalActions, newState, sameState, step } from "../src/engine.ts";
import { loadWorld } from "../src/validate.ts";
import type { State, World } from "../src/types.ts";

const lighthouse = loadWorld("world/lighthouse.json");

/** A State with every field filled in — hand-built, so no world's content can move it. */
const sample = (): State => ({
  seed: 3,
  rngA: 91,
  turn: 12,
  room: "cliff",
  hp: 7,
  maxHp: 10,
  score: 40,
  classId: "scout",
  attrs: { might: 2, wits: 3 },
  perks: ["sure_footed"],
  xp: 5,
  level: 2,
  perkPicks: 1,
  inv: ["lamp", "rope"],
  flags: { lit_the_lamp: true, 'said "yes"': true },
  vars: { res_scout: 2 },
  itemLoc: { lamp: "inv", key: "cliff" },
  npcHp: { wight: 3 },
  npcRoom: { wight: "cliff", ghost: null },
  conds: { soaked: 2 },
  npcConds: { wight: { dazed: 1 } },
  checkAttempts: { "act:force_door": 2 },
  flagTurn: { lit_the_lamp: 9 },
  visited: ["shore", "cliff"],
  party: ["tamsin"],
  talking: null,
  travelMenu: null,
  companyMenu: false,
  talkPage: 0,
  roomPage: 0,
  travelPage: 0,
  ended: null,
});

/**
 * The receipt format, pinned.
 *
 * A receipt is a promise that a reported ending can be replayed and checked
 * (src/player.ts verifies one against a fresh replay). Change how a state
 * canonicalizes and every receipt ever quoted in a report stops verifying —
 * so if this hash changes, that was a decision, not a refactor. It has changed
 * once on purpose since it was pinned: State gained `roomPage` when crowded
 * rooms learned to turn pages, and a field the game needs is worth the receipts
 * quoted in older reports no longer replaying. The value is computed under both
 * the canonicalizer in src/engine.ts and the one it replaced, so it pins the
 * format and not merely itself.
 */
test("a state hashes to the same eight characters it always has", () => {
  assert.equal(hashState(sample()), "3166cbba");
});

/**
 * The comparison the crawler's determinism check runs. It walks the state
 * object itself rather than a list of fields, and this test proves it: every
 * field, whatever is added later, has to matter to it.
 */
test("sameState sees a change in every single field of State", () => {
  const base = sample();
  assert.ok(sameState(base, sample()), "two states built the same way compare equal");
  for (const key of Object.keys(base) as (keyof State)[]) {
    const moved = sample();
    const v = moved[key];
    if (typeof v === "number") (moved[key] as number) = v + 1;
    else if (typeof v === "string") (moved[key] as string) = `${v}_moved`;
    else if (typeof v === "boolean") (moved[key] as boolean) = !v;
    else if (v === null) (moved[key] as unknown) = "no longer null";
    else if (Array.isArray(v)) v.push("added" as never);
    else (v as Record<string, unknown>)["added"] = 1;
    assert.ok(!sameState(base, moved), `a change to State.${key} must not compare equal`);
  }
});

test("sameState ignores the order keys went in, and counts them", () => {
  const a = sample();
  const b = sample();
  b.flags = { 'said "yes"': true, lit_the_lamp: true }; // same pairs, other order
  assert.ok(sameState(a, b));
  b.flags["one_more"] = true;
  assert.ok(!sameState(a, b));
});

/** Nothing mutable may be shared between the state a step was handed and the one it returns. */
test("a step's state shares no mutable object with the state before it", () => {
  let { state } = newState(lighthouse, 1);
  for (let i = 0; i < 6; i++) {
    const menu = legalActions(lighthouse, state);
    const out = step(lighthouse, state, menu[0]!);
    shareNothing(state, out.state, "state");
    state = out.state;
  }
});

function shareNothing(a: unknown, b: unknown, path: string): void {
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return;
  assert.notEqual(a, b, `${path} is the same object in both states — a later turn would rewrite an earlier one`);
  for (const k of Object.keys(a as Record<string, unknown>))
    shareNothing((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`);
}

/**
 * legalActions remembers who is standing here while it builds one menu — dozens
 * of conditions ask. The memory must not outlive the call: the world moves
 * between menus, and a remembered answer would be a lie.
 */
test("the menu's memory of a room does not survive the state changing under it", () => {
  const world: World = {
    id: "memo",
    title: "memo",
    intro: "x",
    start: "a",
    hp: 10,
    maxScore: 1,
    rooms: {
      a: { name: "A", desc: "a room", exits: {} },
      b: { name: "B", desc: "elsewhere", exits: {} },
    },
    items: { coin: { name: "a coin", desc: "round", room: "b", takeable: true } },
    npcs: { thug: { name: "a thug", desc: "grim", room: "b", hp: 3, atk: 1, hostile: true } },
    walkthrough: [],
  } as unknown as World;
  const { state } = newState(world, 1);
  const before = legalActions(world, state);
  assert.ok(!before.some((x) => x.kind === "attack"), "nothing to fight in A yet");
  assert.ok(!before.some((x) => x.kind === "take"), "nothing to pick up in A yet");
  // the same state, moved on the way step moves it
  state.npcRoom["thug"] = "a";
  state.itemLoc["coin"] = "a";
  const after = legalActions(world, state);
  assert.ok(after.some((x) => x.kind === "attack"), "the thug walked in and the menu says so");
  assert.ok(after.some((x) => x.kind === "take"), "the coin is here and the menu says so");
});
