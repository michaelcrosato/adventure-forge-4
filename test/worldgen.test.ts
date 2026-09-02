/**
 * Worldgen: regions expand deterministically, stitch to authored rooms, pass
 * the same validator as authored content — and the generator scales far past
 * any hand-authored map without breaking the load-and-validate budget.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { validateWorld } from "../src/validate.ts";
import { expandWorld } from "../src/worldgen.ts";
import type { World } from "../src/types.ts";

const base = (): World => ({
  id: "g",
  title: "G",
  intro: "x",
  start: "home",
  hp: 10,
  maxScore: 5,
  rooms: {
    home: {
      name: "Home",
      desc: "Home.",
      actions: [{ id: "win", label: "win", fx: [["score", 5], ["end", "win", "done", "Done."]] }],
    },
  },
  items: {},
  npcs: {},
  walkthrough: ["win"],
});

const region = (over: Record<string, unknown> = {}) => ({
  id: "wild",
  name: "Wild",
  seed: 3,
  w: 4,
  h: 3,
  pools: { descs: ["Grass.", "Rocks.", "Trees."], briefs: ["Open land."] },
  links: [{ cell: [0, 0] as [number, number], dir: "west", to: "home", back: "east" }],
  ...over,
});

test("a region expands into a full grid with correct edges", () => {
  const w = expandWorld({ ...base(), gen: [region()] });
  assert.equal(Object.keys(w.rooms).length, 1 + 4 * 3);
  const corner = w.rooms["wild_0_0"]!;
  assert.equal(corner.exits!["south"]?.to, "wild_0_1");
  assert.equal(corner.exits!["east"]?.to, "wild_1_0");
  assert.equal(corner.exits!["north"], undefined);
  assert.equal(corner.exits!["west"]?.to, "home"); // the link
  assert.equal(w.rooms["home"]!.exits!["east"]?.to, "wild_0_0"); // the back link
  const mid = w.rooms["wild_2_1"]!;
  assert.deepEqual(Object.keys(mid.exits!).sort(), ["east", "north", "south", "west"]);
});

test("a link's landmark carries through to the resulting exit", () => {
  const w = expandWorld({
    ...base(),
    gen: [region({ links: [{ cell: [0, 0], dir: "west", to: "home", back: "east", landmark: "the old mill" }] })],
  });
  assert.equal(w.rooms["wild_0_0"]!.exits!["west"]?.landmark, "the old mill");
});

test("a link's sideTrip carries through to the resulting exit", () => {
  const w = expandWorld({
    ...base(),
    gen: [region({ links: [{ cell: [0, 0], dir: "west", to: "home", back: "east", sideTrip: true }] })],
  });
  assert.equal(w.rooms["wild_0_0"]!.exits!["west"]?.sideTrip, true);
});

test("expansion is deterministic", () => {
  const a = expandWorld({ ...base(), gen: [region()] });
  const b = expandWorld({ ...base(), gen: [region()] });
  assert.deepEqual(a.rooms, b.rooms);
});

test("an expanded world passes the same validator as authored content", () => {
  const w = expandWorld({ ...base(), gen: [region()] });
  assert.deepEqual(validateWorld(w), []);
});

test("spots place items and npcs on exact cells", () => {
  const w0 = base();
  w0.items["coin"] = { name: "old coin", loc: "nowhere", takeable: true };
  w0.npcs["wolf"] = { name: "gray wolf", room: null, hostile: true, hp: 3, atk: 1, df: 8 };
  const w = expandWorld({
    ...w0,
    gen: [region({
      spots: [{ cell: [2, 1], name: "The Cairn", items: ["coin"], npcs: ["wolf"], onEnterOnce: [["xp", 2]] }],
    })],
  });
  assert.equal(w.items["coin"]!.loc, "wild_2_1");
  assert.equal(w.npcs["wolf"]!.room, "wild_2_1");
  assert.equal(w.rooms["wild_2_1"]!.name, "The Cairn");
  assert.deepEqual(w.rooms["wild_2_1"]!.onEnterOnce, [["xp", 2]]);
});

test("malformed gen throws instead of loading a broken world", () => {
  assert.throws(() => expandWorld({ ...base(), gen: [region({ links: [{ cell: [9, 9], dir: "west", to: "home" }] })] }), /out of bounds/);
  assert.throws(() => expandWorld({ ...base(), gen: [region({ pools: { descs: [] } })] }), /descs/);
  assert.throws(() => expandWorld({ ...base(), gen: [region(), region()] }), /already exists/);
});

test("scale: a 25,600-room overworld expands and validates in seconds", () => {
  // 160x160 cells. At 500m a cell that is 6,400 km^2 - Skyrim's map is ~37.
  const t0 = performance.now();
  const w = expandWorld({
    ...base(),
    gen: [region({ w: 160, h: 160, seed: 11 })],
  });
  const errs = validateWorld(w);
  const ms = performance.now() - t0;
  assert.equal(Object.keys(w.rooms).length, 1 + 160 * 160);
  assert.deepEqual(errs, []);
  assert.ok(ms < 5000, `expand+validate took ${ms.toFixed(0)}ms`);
});
