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

const path = fileURLToPath(new URL("../world/reach.json", import.meta.url));

test("the Gray Reach's text stays inside the style budget (scripts/lint-world.ts)", () => {
  const out = execFileSync(process.execPath, ["--import", "tsx", "scripts/lint-world.ts", path], { encoding: "utf8" });
  assert.match(out, /all text within budget/);
});
