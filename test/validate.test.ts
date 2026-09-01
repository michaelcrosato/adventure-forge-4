import assert from "node:assert/strict";
import test from "node:test";
import { loadWorld, validateWorld } from "../src/validate.ts";

const fixture = (name: string) =>
  loadWorld(new URL(`./fixtures/${name}.json`, import.meta.url).pathname);

test("shipped world validates clean", () => {
  const world = loadWorld(new URL("../world/lighthouse.json", import.meta.url).pathname);
  assert.deepEqual(validateWorld(world), []);
});

test("rejects unknown room and item references", () => {
  const errs = validateWorld(fixture("bad_ref"));
  assert.ok(errs.some((e) => e.includes("no_such_room")));
  assert.ok(errs.some((e) => e.includes("no_such_item")));
});

test("rejects a world whose walkthrough does not prove a win", () => {
  const errs = validateWorld(fixture("unwinnable"));
  assert.ok(errs.some((e) => e.includes("walkthrough")));
});

test("rejects unknown effect ops (closed DSL)", () => {
  const errs = validateWorld(fixture("bad_fx"));
  assert.ok(errs.some((e) => e.includes("unknown fx op")));
});
