/**
 * The Gray Reach is held to the authoring guide's style budget as well as the
 * engine's: desc ≤ 260, brief ≤ 70, label ≤ 40, say ≤ 220, epilogue ≤ 140,
 * stage ≤ 120 (scripts/lint-world.ts). The realm's validity, walkthrough,
 * proofs, and token budget are checked with every other shipped world by the
 * world/ glob tests; this is the one bar only the realm is held to.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { condOk, newState } from "../src/engine.ts";
import { loadWorld } from "../src/validate.ts";

const path = fileURLToPath(new URL("../world/reach.json", import.meta.url));

test("the Gray Reach's text stays inside the style budget (scripts/lint-world.ts)", () => {
  const out = execFileSync(process.execPath, ["--import", "tsx", "scripts/lint-world.ts", path], { encoding: "utf8" });
  assert.match(out, /all text within budget/);
});

/**
 * The Ironbound march is the realm's one autonomous force: set it moving and
 * fourteen holds fall on a schedule unless you reach them. That schedule was
 * written in absolute turns, which made it a trap rather than a clock — a
 * player who set the march moving at turn 470 had already passed ten of its
 * thresholds, and watched ten holds burn in ten consecutive turns with nothing
 * they could have done differently. Measured, before the fix: begun at turn 80,
 * two holds fell in 78 turns; begun at 470, twelve fell in the same 78.
 *
 * The schedule now counts from the march itself (`since`), so the column moves
 * at the same pace whenever it starts.
 */
test("the Ironbound march counts its schedule from the march, not from turn zero", () => {
  const world = loadWorld(path);
  const burns = (world.clock ?? []).filter((e) => e.id.startsWith("iron_march_burn_"));
  assert.ok(burns.length >= 10, `the march should burn a realm's worth of holds, found ${burns.length}`);
  for (const e of burns) {
    assert.ok(
      !(e.if ?? []).some((c) => Array.isArray(c) && c[0] === "turn"),
      `${e.id} gates on an absolute turn: a player who sets the march moving late would watch the holds fall all at once`,
    );
    assert.ok(
      (e.if ?? []).some((c) => Array.isArray(c) && c[0] === "since" && c[1] === "iron_march"),
      `${e.id} must count from ["since","iron_march",...] — that is what makes the schedule the march's own`,
    );
  }
  // and the pace is the same wherever the column starts from
  const delay = (entry: (typeof burns)[number], begunAt: number): number => {
    const { state } = newState(world, 1);
    state.flags["iron_march"] = true;
    state.flagTurn["iron_march"] = begunAt;
    for (let t = begunAt; t <= begunAt + 700; t++) {
      state.turn = t;
      if ((entry.if ?? []).every((c) => condOk(world, state, c))) return t - begunAt;
    }
    return -1;
  };
  for (const e of burns) {
    const early = delay(e, 20);
    assert.ok(early > 0, `${e.id} never comes due`);
    assert.equal(delay(e, 470), early, `${e.id} falls ${early} turns after the column moves — it must not depend on when that was`);
  }
});
