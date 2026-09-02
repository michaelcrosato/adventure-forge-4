import assert from "node:assert/strict";
import test from "node:test";
import { renderStatus } from "../src/format.ts";
import type { State, World } from "../src/types.ts";

const stateWithVars = (vars: Record<string, number>) => ({ vars }) as unknown as State;

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
