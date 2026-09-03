import assert from "node:assert/strict";
import test from "node:test";
import { renderStatus } from "../src/format.ts";
import type { State, World } from "../src/types.ts";

const stateWithVars = (vars: Record<string, number>, inv: string[] = []) =>
  ({ vars, inv, flags: {} }) as unknown as State;

test("renderStatus: reports every statusTracks entry, falling back to 0", () => {
  const world = {
    statusTracks: [
      { var: "verses_known", label: "Verses", max: 3 },
      { var: "crown_progress", label: "Crown", max: 2 },
    ],
  } as World;
  assert.equal(renderStatus(world, stateWithVars({ verses_known: 2 })), "Verses: 2/3\nCrown: 0/2");
});

test("renderStatus: falls back to the single progress tracker when statusTracks is absent", () => {
  const world = { progress: { var: "verses_known", label: "Verses", max: 3 } } as World;
  assert.equal(renderStatus(world, stateWithVars({ verses_known: 1 })), "Verses: 1/3");
});

test("renderStatus: reports nothing to track when the world has neither", () => {
  const world = {} as World;
  assert.equal(renderStatus(world, stateWithVars({})), "No progress to report.");
});

test("renderStatus: leads with objectives when the world sets them, ahead of tracked paths", () => {
  const world = {
    objectives: "Find the crown or speak the verses.",
    statusTracks: [{ var: "verses_known", label: "Verses", max: 3 }],
  } as World;
  assert.equal(
    renderStatus(world, stateWithVars({ verses_known: 1 })),
    "Find the crown or speak the verses.\nVerses: 1/3",
  );
});

test("renderStatus: falls back to intro for the recap when objectives is absent", () => {
  const world = { intro: "A storm is coming." } as World;
  assert.equal(renderStatus(world, stateWithVars({})), "A storm is coming.");
});

test("renderStatus: lists what you're carrying, so it doubles as a pre-decision inventory check", () => {
  const world = {
    objectives: "Find the crown or speak the verses.",
    items: { crown: { name: "the crown" }, dagger: { name: "a rusty dagger" } },
  } as unknown as World;
  assert.equal(
    renderStatus(world, stateWithVars({}, ["crown", "dagger"])),
    "Find the crown or speak the verses.\ncarrying: the crown, a rusty dagger",
  );
});

test("renderStatus: lists visited rooms by name, as a memory aid against repetitive backtracking", () => {
  const world = {
    rooms: { square: { name: "Village Square" }, gate: { name: "Village Gate" } },
  } as unknown as World;
  const state = { vars: {}, inv: [], visited: ["square", "gate"] } as unknown as State;
  assert.equal(renderStatus(world, state), "Visited: Village Square, Village Gate");
});

test("renderStatus: falls back to the room id if a visited room has no name (e.g. a stale id)", () => {
  const world = { rooms: {} } as unknown as World;
  const state = { vars: {}, inv: [], visited: ["ghost_room"] } as unknown as State;
  assert.equal(renderStatus(world, state), "Visited: ghost_room");
});

test("renderStatus: omits the visited line when nothing has been visited yet", () => {
  const world = { objectives: "Find the crown." } as World;
  const state = { vars: {}, inv: [], visited: [] } as unknown as State;
  assert.equal(renderStatus(world, state), "Find the crown.");
});

test("renderStatus: lists held perks with their effects, so a player can recall what each does", () => {
  const world = {
    objectives: "Find the crown.",
    perks: {
      old_lore: { name: "Old Lore", desc: "+1 other wits checks" },
      fleetfoot: { name: "Fleetfoot", desc: "+2 grace checks (locks)" },
    },
  } as unknown as World;
  const state = { vars: {}, inv: [], perks: ["old_lore", "fleetfoot"] } as unknown as State;
  assert.equal(
    renderStatus(world, state),
    "Find the crown.\nPerks: Old Lore (+1 other wits checks), Fleetfoot (+2 grace checks (locks))",
  );
});

test("renderStatus: omits the perks line when the player holds none", () => {
  const world = { objectives: "Find the crown." } as World;
  const state = { vars: {}, inv: [], perks: [] } as unknown as State;
  assert.equal(renderStatus(world, state), "Find the crown.");
});

test("renderStatus: totals check and combat modifiers for worlds with a character system", () => {
  const world = {
    objectives: "Find the crown.",
    classes: { warden: { name: "Warden", desc: "strong" } },
    items: { sword: { name: "sword", dmg: 3, hit: 1 } },
    perks: {
      keen_edge: { name: "Keen Edge", desc: "+1 to hit", bonus: { hit: 1 } },
      old_lore: { name: "Old Lore", desc: "+1 wits", bonus: { check: { wits: 1 } } },
    },
  } as unknown as World;
  const state = {
    vars: {},
    flags: {},
    inv: ["sword"],
    perks: ["keen_edge", "old_lore"],
    attrs: { might: 2, wits: 1 },
  } as unknown as State;
  assert.equal(
    renderStatus(world, state),
    "Find the crown.\ncarrying: sword\nPerks: Keen Edge (+1 to hit), Old Lore (+1 wits)\n" +
      "Checks: might+2 grace+0 wits+2 will+0\nCombat: hit+4 dmg+3 armor+0",
  );
});

test("renderStatus: omits check/combat totals for a classless world", () => {
  const world = { objectives: "Find the crown." } as World;
  const state = stateWithVars({});
  assert.equal(renderStatus(world, state), "Find the crown.");
});

test("renderStatus: reports a statusPaths fallback when no state's conditions match", () => {
  const world = {
    statusPaths: [
      {
        label: "Barrow",
        states: [{ if: [["flag", "promised_seal"]], text: "promised to seal it" }],
        fallback: "undecided",
      },
    ],
  } as unknown as World;
  assert.equal(renderStatus(world, stateWithVars({})), "Barrow: undecided");
});

test("renderStatus: reports the first matching statusPaths state, in order", () => {
  const world = {
    statusPaths: [
      {
        label: "Barrow",
        states: [
          { if: [["flag", "broke_promise"]], text: "promise broken" },
          { if: [["flag", "promised_seal"]], text: "promised to seal it" },
        ],
        fallback: "undecided",
      },
    ],
  } as unknown as World;
  const state = { vars: {}, inv: [], flags: { promised_seal: true } } as unknown as State;
  assert.equal(renderStatus(world, state), "Barrow: promised to seal it");
});

test("renderStatus: omits a statusPaths line when nothing matches and there is no fallback", () => {
  const world = {
    statusPaths: [{ label: "Barrow", states: [{ if: [["flag", "promised_seal"]], text: "promised" }] }],
  } as unknown as World;
  assert.equal(renderStatus(world, stateWithVars({})), "No progress to report.");
});
