/**
 * The crawler's invariants, pinned on tiny worlds so each one is tested alone
 * rather than trusted to show up in a random walk.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { crawl } from "../src/crawl.ts";
import { loadWorld } from "../src/validate.ts";
import type { TopicDef, World } from "../src/types.ts";

test("crawl flags a template hole: a topic authored without `say` prints \"undefined\" to the player", () => {
  // Found live in the Vale by a fuzz run: `elder: "undefined"`. The
  // validator now rejects the shape too; the crawler is the safety net for
  // whatever shape check does not yet exist.
  const world: World = {
    id: "hole", title: "H", intro: "x", start: "a", hp: 5, maxScore: 0,
    rooms: { a: { name: "A", desc: "A." } },
    items: {},
    npcs: { elder: { name: "elder", room: "a", topics: [{ id: "t", label: "talk" } as TopicDef] } },
    walkthrough: [],
  };
  const r = crawl(world, 1, 3);
  assert.ok(r.findings.some((f) => f.startsWith("HOLE") && f.includes('"undefined"')), r.findings.join("\n"));
});

test("crawl is clean on the regression world", () => {
  const world = loadWorld(fileURLToPath(new URL("../world/lighthouse.json", import.meta.url)));
  const r = crawl(world, 20, 60);
  assert.deepEqual(r.findings, []);
  assert.ok(r.steps > 0);
});
