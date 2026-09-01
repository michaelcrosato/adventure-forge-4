/**
 * Triage is deterministic Tier-3: reports in, atomic corroborated issues out.
 * These tests pin the promotion rules so a dev agent cannot quietly loosen them.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { clusterUnits, unitsFromReport } from "../src/triage.ts";

const report = (file: string, over: Record<string, unknown>) => ({
  file,
  r: { kind: "playtest", seed: 1, model: "m", verified: true, bugs: [], confusions: [], suggestions: [], ...over },
});

test("two corroborating suggestions from independent reports merge into one P1 issue", () => {
  const a = report("r1.json", { suggestions: ["hint that the spiral stair needs a lit lantern"] });
  const b = report("r2.json", { suggestions: ["the stair should hint that it needs the lantern lit"] });
  const units = [...unitsFromReport(a.file, a.r), ...unitsFromReport(b.file, b.r)];
  const issues = clusterUnits(units);
  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.priority, "P1"); // subjective, but corroborated by 2 reports
  assert.equal(issues[0]?.corroboration, 2);
});

test("an uncorroborated suggestion stays P2; a P0 bug promotes alone", () => {
  const a = report("r1.json", {
    suggestions: ["add more scoring feedback after each quest beat"],
    bugs: [{ sev: "P0", what: "crash when attacking twice", where: "oil_store" }],
  });
  const issues = clusterUnits(unitsFromReport(a.file, a.r));
  assert.equal(issues.length, 2);
  assert.equal(issues[0]?.priority, "P0");
  assert.equal(issues[0]?.unit_kind, "bug");
  assert.equal(issues[1]?.priority, "P2");
});

test("unrelated units do not merge; issue ids are stable across runs", () => {
  const a = report("r1.json", { suggestions: ["brighten the tavern description"] });
  const b = report("r2.json", { suggestions: ["combat damage numbers feel opaque"] });
  const one = clusterUnits([...unitsFromReport(a.file, a.r), ...unitsFromReport(b.file, b.r)]);
  const two = clusterUnits([...unitsFromReport(a.file, a.r), ...unitsFromReport(b.file, b.r)]);
  assert.equal(one.length, 2);
  assert.deepEqual(one.map((i) => i.id), two.map((i) => i.id)); // deterministic
});
