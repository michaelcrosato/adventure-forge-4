import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  actionByLabel,
  condOk,
  hashState,
  legalActions,
  newState,
  receipt,
  step,
} from "../src/engine.ts";
import { replayTrace } from "../src/crawl.ts";
import { loadWorld, replayWalkthrough } from "../src/validate.ts";
import type { Action, State, World } from "../src/types.ts";

const world: World = loadWorld(fileURLToPath(new URL("../world/lighthouse.json", import.meta.url)));

/** Play the walkthrough at a seed, recording canonical actions + hash sequence. */
function playWalkthrough(seed: number): { actions: Action[]; hashes: string[]; state: State } {
  let { state } = newState(world, seed);
  const actions: Action[] = [];
  const hashes: string[] = [hashState(state)];
  const doLabel = (label: string) => {
    const a = actionByLabel(world, state, label);
    assert.ok(a, `legal action "${label}" at ${state.room} t${state.turn}`);
    actions.push(a);
    state = step(world, state, a).state;
    hashes.push(hashState(state));
  };
  for (const w of world.walkthrough) {
    if (typeof w === "string") doLabel(w);
    else {
      let n = 0;
      while (!condOk(world, state, w.until)) {
        assert.ok(n++ < w.max, `repeat "${w.repeat}" within max`);
        assert.ok(!state.ended, `alive inside repeat "${w.repeat}"`);
        doLabel(w.repeat);
      }
    }
    if (state.ended) break;
  }
  return { actions, hashes, state };
}

test("same seed => byte-identical run (hash sequence and receipt)", () => {
  const a = playWalkthrough(1);
  const b = playWalkthrough(1);
  assert.deepEqual(a.hashes, b.hashes);
  assert.equal(receipt(world, a.state), receipt(world, b.state));
});

test("walkthrough wins with full score (ending witness + score economy)", () => {
  const r = replayWalkthrough(world, 1);
  assert.equal(r.error, undefined);
  assert.equal(r.state?.ended?.kind, "win");
  assert.equal(r.state?.score, world.maxScore);
});

test("recorded trace replays to the same receipt", () => {
  const a = playWalkthrough(1);
  const rec = replayTrace(world, { world: world.id, seed: 1, actions: a.actions });
  assert.equal(rec, receipt(world, a.state));
});

test("illegal action leaves state untouched", () => {
  const { state } = newState(world, 1);
  const before = hashState(state);
  const out = step(world, state, { kind: "go", dir: "west" }); // no west exit at cove
  assert.equal(hashState(out.state), before);
  assert.match(out.events.join(" "), /Illegal/);
});

test("locked exit refuses until the key is held", () => {
  let { state } = newState(world, 1);
  // walk to the lighthouse door without the key
  for (const label of ["go north", "go west", "go up"]) {
    const a = actionByLabel(world, state, label);
    assert.ok(a, label);
    state = step(world, state, a).state;
  }
  const inA = actionByLabel(world, state, "go in");
  assert.ok(inA);
  const out = step(world, state, inA);
  assert.equal(out.state.room, "lighthouse_base");
  assert.match(out.events.join(" "), /locked|key/i);
});

test("a flag set by an NPC in a different room clears gated actions on return — no stale menu", () => {
  // Mirrors a triaged confusion report: force-the-doors stayed offered after
  // a blessing (set elsewhere) was supposed to have opened them. legalActions
  // recomputes from current state on every call, so a remotely-set flag must
  // already clear the gated action by the time the player is back in the room.
  const gateWorld: World = {
    id: "gate-flag-test",
    title: "Gate Flag Test",
    intro: "A test.",
    start: "field",
    hp: 10,
    maxScore: 10,
    rooms: {
      field: {
        name: "Field",
        desc: "Sealed doors.",
        exits: { east: { to: "shrine" } },
        actions: [
          {
            id: "force_doors",
            label: "force the doors",
            if: [["!flag", "doors_open"]],
            fx: [["say", "They do not budge."]],
          },
        ],
      },
      shrine: {
        name: "Shrine",
        desc: "A quiet shrine.",
        exits: { west: { to: "field" } },
      },
    },
    items: {},
    npcs: {
      priest: {
        name: "priest",
        room: "shrine",
        topics: [{ id: "blessing", label: "a blessing", say: "Go with my blessing.", fx: [["set", "doors_open"]] }],
      },
    },
    walkthrough: [],
  };
  let { state } = newState(gateWorld, 1);
  assert.ok(legalActions(gateWorld, state).some((a) => a.kind === "custom" && a.id === "force_doors"));
  state = step(gateWorld, state, { kind: "go", dir: "east" }).state;
  state = step(gateWorld, state, { kind: "talk", npc: "priest", topic: "blessing" }).state;
  state = step(gateWorld, state, { kind: "go", dir: "west" }).state;
  assert.ok(!legalActions(gateWorld, state).some((a) => a.kind === "custom" && a.id === "force_doors"));
});

test("dark room exposes only exits until a lit light is carried", () => {
  let { state } = newState(world, 1);
  state = structuredClone(state);
  state.room = "stair"; // teleport straight into the dark for the check
  const kinds = new Set(legalActions(world, state).map((a) => a.kind));
  assert.deepEqual([...kinds], ["go"]);
  state.inv.push("lantern");
  state.itemLoc["lantern"] = "inv";
  state.flags["lantern_lit"] = true;
  assert.ok(legalActions(world, state).length > 0);
});

test("hp reaching 0 ends the game as a loss", () => {
  let { state } = newState(world, 1);
  state = structuredClone(state);
  state.room = "oil_store";
  state.inv.push("lantern");
  state.itemLoc["lantern"] = "inv";
  state.flags["lantern_lit"] = true;
  state.hp = 1;
  // the wight (6 hp) cannot die to one bare-hand blow, so it always strikes
  // back for 2 — at hp 1 a single attack deterministically kills the player
  const a = actionByLabel(world, state, "attack sea-wight with bare hands");
  assert.ok(a, "attack is on the menu");
  state = step(world, state, a).state;
  assert.equal(state.ended?.kind, "lose");
  assert.equal(state.ended?.id, "dead");
  assert.equal(state.hp, 0);
});

test("healing reports its actual effect, same as damage and score do", () => {
  const mini: World = {
    id: "mini", title: "M", intro: "x", start: "a", hp: 10, maxScore: 5,
    rooms: { a: { name: "A", desc: "A.", actions: [{ id: "heal", label: "heal", fx: [["hp", 3]] }] } },
    items: {}, npcs: {}, walkthrough: [],
  };
  let { state } = newState(mini, 1);
  state.hp = 5;
  const healed = step(mini, state, { kind: "custom", room: "a", id: "heal" });
  assert.match(healed.events.join(" "), /\(hp\+3\)/);
  // already at full hp: the same heal has nothing left to report
  state = healed.state;
  state.hp = state.maxHp;
  const noop = step(mini, state, { kind: "custom", room: "a", id: "heal" });
  assert.doesNotMatch(noop.events.join(" "), /\(hp/);
});

test("score is clamped to maxScore", () => {
  const a = playWalkthrough(1);
  assert.ok(a.state.score <= world.maxScore);
});
