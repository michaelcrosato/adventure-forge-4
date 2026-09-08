/**
 * Worldgen: regions expand deterministically, stitch to authored rooms, pass
 * the same validator as authored content — and the generator scales far past
 * any hand-authored map without breaking the load-and-validate budget.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { newState, wildBearing } from "../src/engine.ts";
import { validateWorld } from "../src/validate.ts";
import { expandWorld } from "../src/worldgen.ts";
import type { State, World } from "../src/types.ts";

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

// ---------- where you stand in a wilderness ----------
/**
 * Three playtest reports asked for the same thing in three different words: a
 * breadcrumb while following a multi-hop direction, a mini-map for the
 * hex-crawl regions, and help reaching named sub-locations. The bearings a
 * wilderness npc gives are right — every one of the realm's 322 legs was
 * recomputed — but they are given as hop counts ("From Stilt-Shadow: the
 * drowned nave, two stands west"), and following one meant counting in your
 * head. Losing count meant starting over.
 *
 * The anchor is a landmark, which is what those bearings are given from and
 * about, and only one the player has already stood in.
 */
const wilds = (): World =>
  expandWorld({
    ...base(),
    gen: [
      region({
        w: 6,
        h: 6,
        spots: [
          { cell: [0, 0], name: "The Rope Larder", landmark: "the Rope Larder", brief: "Rope and grease." },
          { cell: [5, 5], name: "Gallows Green", landmark: "Gallows Green", brief: "A bare patch." },
          { cell: [2, 0], name: "Spoil Verge", brief: "Spoil-dust." },
        ],
        links: [{ cell: [0, 5] as [number, number], dir: "west", to: "home", back: "east", landmark: "the mill road" }],
      }),
    ],
  });

const standing = (room: string, visited: string[]): State => {
  const w = wilds();
  const { state } = newState(w, 1);
  state.room = room;
  state.visited = visited;
  return state;
};

test("a wilderness cell says where it stands, counted from the last landmark you passed", () => {
  const w = wilds();
  assert.equal(wildBearing(w, standing("wild_3_2", ["wild_0_0"])), "two south and three east of the Rope Larder");
  assert.equal(wildBearing(w, standing("wild_0_4", ["wild_0_0"])), "four south of the Rope Larder", "one axis alone reads as one leg");
  assert.equal(wildBearing(w, standing("wild_3_5", ["home"])), "three east of the mill road", "a link's landmark anchors it too, known by the room it leads to");
  // and one hop out is worth saying: it is the count, not the distance, that a
  // player following "two stands west" has lost
  assert.equal(wildBearing(w, standing("wild_1_0", ["wild_0_0"])), "one east of the Rope Larder");
});

test("it says nothing where there is no landmark you have stood in, and nothing standing on one", () => {
  const w = wilds();
  assert.equal(wildBearing(w, standing("wild_3_3", [])), null, "nothing known in this wilderness yet");
  assert.equal(wildBearing(w, standing("wild_0_0", ["wild_0_0"])), null, "standing in the Rope Larder, which the screen already names");
  assert.equal(wildBearing(w, standing("home", ["wild_0_0"])), null, "an authored room is not a wilderness");
  assert.equal(wildBearing(w, standing("wild_3_3", ["wild_2_0"])), null, "Spoil Verge is a named cell but not a landmark — not what a bearing is given from");
});

test("the nearest landmark wins, and only the ones you have stood in count", () => {
  const w = wilds();
  const both = standing("wild_4_4", ["wild_0_0", "wild_5_5"]);
  assert.equal(wildBearing(w, both), "one north and one west of Gallows Green", "Gallows Green at 5,5 is two hops; the Rope Larder is eight");
  const onlyFar = standing("wild_4_4", ["wild_0_0"]);
  assert.equal(wildBearing(w, onlyFar), "four south and four east of the Rope Larder", "with Gallows Green unvisited, the far anchor is the one there is");
});
