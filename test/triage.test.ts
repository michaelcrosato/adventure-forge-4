/**
 * Triage is deterministic Tier-3: reports in, atomic corroborated issues out.
 * These tests pin the promotion rules so a dev agent cannot quietly loosen them.
 */
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { clusterUnits, triage, unitsFromReport } from "../src/triage.ts";

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

function tempDirs() {
  const root = mkdtempSync(join(tmpdir(), "triage-test-"));
  const reportsDir = join(root, "reports");
  const queueDir = join(root, "queue");
  mkdirSync(reportsDir, { recursive: true });
  mkdirSync(queueDir, { recursive: true });
  return { reportsDir, queueDir };
}

const seedIssue = (dir: string, file: string, over: Record<string, unknown>) =>
  writeFileSync(
    join(dir, file),
    JSON.stringify({
      schema: 1, kind: "issue", priority: "P2", unit_kind: "suggestion", corroboration: 1,
      verified_reports: 0, evidence: [], builds: [], created: "2026-01-01T00:00:00.000Z", ...over,
    }),
  );

test("a differently-worded suggestion is not re-filed once a near-duplicate is already queued", () => {
  const { reportsDir, queueDir } = tempDirs();
  seedIssue(queueDir, "P2-issue-aaaaaaaa.json", {
    id: "aaaaaaaa",
    title: "hint that the spiral stair needs a lit lantern",
  });
  writeFileSync(
    join(reportsDir, "r1.json"),
    JSON.stringify({
      kind: "playtest", seed: 2, model: "m", verified: true, bugs: [], confusions: [],
      suggestions: ["the stair should hint that it needs the lantern lit"],
    }),
  );
  const result = triage({ reportsDir, queueDir, dedupeDirs: [queueDir] });
  assert.equal(result.filed.length, 0);
  assert.equal(result.skipped, 1);
});

test("a recurring bug still files even when worded like an already-queued bug (bugs skip fuzzy dedupe)", () => {
  const { reportsDir, queueDir } = tempDirs();
  seedIssue(queueDir, "P1-issue-bbbbbbbb.json", {
    id: "bbbbbbbb",
    priority: "P1",
    unit_kind: "bug",
    title: "crash when attacking twice in the oil store",
  });
  writeFileSync(
    join(reportsDir, "r1.json"),
    JSON.stringify({
      kind: "playtest", seed: 3, model: "m", verified: true, confusions: [], suggestions: [],
      bugs: [{ sev: "P1", what: "attacking twice in the oil store crashes the game", where: "oil_store" }],
    }),
  );
  const result = triage({ reportsDir, queueDir, dedupeDirs: [queueDir] });
  assert.equal(result.filed.length, 1);
  assert.equal(result.skipped, 0);
});
