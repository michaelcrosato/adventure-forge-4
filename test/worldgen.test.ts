/**
 * Worldgen: regions expand deterministically, stitch to authored rooms, pass
 * the same validator as authored content — and the generator scales far past
 * any hand-authored map without breaking the load-and-validate budget.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { condOk, newState, step, wildBearing } from "../src/engine.ts";
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

// ---------- the way back to a place you know ----------
/**
 * Three playtest reports asked for a breadcrumb: the realm's bearings are hop
 * counts ("From Stilt-Shadow: the drowned nave, two stands west") and
 * following one meant counting in your head.
 *
 * The first version answered with the coordinate offset to the nearest
 * landmark — "two south and one east of the north lane" — and a player in the
 * next wave said those directions "don't always match actual movement
 * outcomes 1:1". They were right: the grids have walls, so 466 of 2,056
 * cell-to-landmark offsets in the realm (23%) cannot be walked in a straight
 * line at all. A line that reads as a route and is not one is worse than no
 * line, so it is a real path now, breadth-first through the actual exits.
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

/** Follow the line as written and say where it actually lands. */
const follow = (w: World, from: string, line: string): string => {
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const legs = /^.*?: (.*)$/.exec(line)![1]!.split(", then ");
  let at = from;
  for (const leg of legs) {
    const [, n, dir] = /^(\w+) (north|south|east|west)$/.exec(leg.trim())!;
    for (let i = 0; i < words[n!]!; i++) {
      const to = w.rooms[at]?.exits?.[dir!]?.to;
      assert.ok(to, `"${line}" cannot be walked: no ${dir} exit from ${at}`);
      at = to!;
    }
  }
  return at;
};

test("a wilderness cell gives the way back to the nearest place you know", () => {
  const w = wilds();
  const cases: [room: string, visited: string[], line: string, lands: string][] = [
    ["wild_3_2", ["wild_0_0"], "the Rope Larder: two north, then three west", "wild_0_0"],
    ["wild_0_4", ["wild_0_0"], "the Rope Larder: four north", "wild_0_0"],
    ["wild_1_0", ["wild_0_0"], "the Rope Larder: one west", "wild_0_0"],
    // a link's landmark on the grid's edge anchors it too, known by the room it leads to
    ["wild_3_5", ["home"], "the mill road: three west", "wild_0_5"],
  ];
  for (const [room, visited, line, lands] of cases) {
    const s = standing(room, visited);
    assert.equal(wildBearing(w, s), line, room);
    assert.equal(follow(w, room, line), lands, `${room}: "${line}" must land on the place it names`);
  }
});

test("every breadcrumb it can print is a path that actually walks", () => {
  const w = wilds();
  const anchors = ["wild_0_0", "wild_5_5", "wild_0_5"];
  let printed = 0;
  for (let y = 0; y < 6; y++)
    for (let x = 0; x < 6; x++) {
      const room = `wild_${x}_${y}`;
      const line = wildBearing(w, standing(room, [room, ...anchors, "home"]));
      if (!line) continue;
      printed++;
      assert.ok(anchors.includes(follow(w, room, line)), `${room}: "${line}"`);
    }
  assert.ok(printed >= 30, `most of a 36-cell grid should get a line, got ${printed}`);
});

test("it says nothing where there is no landmark you have stood in, and nothing standing on one", () => {
  const w = wilds();
  assert.equal(wildBearing(w, standing("wild_3_3", [])), null, "nothing known in this wilderness yet");
  assert.equal(wildBearing(w, standing("wild_0_0", ["wild_0_0"])), null, "standing in the Rope Larder, which the screen already names");
  assert.equal(wildBearing(w, standing("home", ["wild_0_0"])), null, "an authored room is not a wilderness");
  assert.equal(wildBearing(w, standing("wild_3_3", ["wild_2_0"])), null, "Spoil Verge is a named cell but not a landmark — not what a bearing is given from");
});

test("the nearest landmark by walking wins, and only the ones you have stood in count", () => {
  const w = wilds();
  assert.equal(wildBearing(w, standing("wild_4_4", ["wild_0_0", "wild_5_5"])), "Gallows Green: one south, then one east", "two steps to Gallows Green against eight to the Rope Larder");
  assert.equal(wildBearing(w, standing("wild_2_2", ["wild_5_5"])), "Gallows Green: three south, then three east", "with the Rope Larder unvisited, the far anchor is the one there is");
});

/**
 * `inWild` and `unseenHere`: the two conds that tell an ability where it has
 * anything to say.
 *
 * `scout_ground` ("read the ground") was gated on the class alone, so it stood
 * in the menu of a hall, a crypt and a ship's hold, and in regions whose every
 * marked place the player had already stood in it answered "You have found
 * every place marked hereabouts." Both halves of that are the same defect —
 * an option offered where it does nothing — and both halves are a cond now.
 */
test("inWild and unseenHere read the ground the player is standing on", () => {
  const w = expandWorld({
    ...base(),
    regions: { wild: { name: "the Wild" } },
    // the gated reading, and an ungated one to reach the line the gate exists
    // to keep a player from ever seeing
    abilities: {
      read: { label: "read the ground", free: true, if: [["inWild"], ["unseenHere"]], fx: [["sayunvisited"]] },
      readAnyway: { label: "read it regardless", free: true, fx: [["sayunvisited"]] },
    },
    gen: [region({ region: "wild", spots: [{ cell: [3, 2], name: "The Bound-Stone", brief: "The stone.", landmark: "the bound-stone" }] })],
  });
  const { state } = newState(w, 1);

  // the authored room the grid links back to is not ground
  assert.ok(!condOk(w, state, ["inWild"]), "an authored room is not a wilderness cell");
  assert.ok(condOk(w, state, ["!inWild"]));
  const cell: State = { ...state, room: "wild_0_0", visited: ["home", "wild_0_0"] };
  assert.ok(condOk(w, cell, ["inWild"]), "a generated cell is");
  assert.ok(!condOk(w, cell, ["!inWild"]));

  // one marked place in the region, not yet stood in
  assert.ok(condOk(w, cell, ["unseenHere"]));
  assert.ok(!condOk(w, cell, ["!unseenHere"]));
  const after: State = { ...cell, visited: [...cell.visited, "wild_3_2"] };
  assert.ok(!condOk(w, after, ["unseenHere"]), "and once you have stood there, there is nothing left to name");
  assert.ok(condOk(w, after, ["!unseenHere"]));

  // the reading itself: the place, then the walk to it, folded into legs
  const said = step(w, cell, { kind: "ability", id: "read" } as never).events.join(" ");
  assert.match(said, /Not yet seen near here: the bound-stone, two south, then three east\./, said);
  assert.match(step(w, after, { kind: "ability", id: "readAnyway" } as never).events.join(" "), /You have found every place marked hereabouts\./);
});
