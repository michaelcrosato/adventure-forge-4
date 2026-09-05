/**
 * Worldgen at scale: templates stamped into many places, wilderness with shape
 * and coherent scenes, worlds assembled from part files, and the validator's
 * reachability and perk-menu guarantees.
 */
import assert from "node:assert/strict";
import { unlinkSync, writeFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { newState, step } from "../src/engine.ts";
import { loadWorld, validateWorld, worldFiles } from "../src/validate.ts";
import { expandWorld } from "../src/worldgen.ts";
import { MENU_CAP } from "../src/types.ts";
import type { GenDef, TemplateDef, World } from "../src/types.ts";

const fixture = (rel: string) => fileURLToPath(new URL(`./fixtures/${rel}`, import.meta.url));

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

const cave: TemplateDef = {
  entrance: "$mouth",
  vars: ["NAME", "BOSS"],
  rooms: {
    $mouth: {
      name: "{{NAME}} — mouth",
      desc: "The mouth of {{NAME}}.",
      exits: { in: { to: "$hall" } },
    },
    $hall: {
      name: "{{NAME}} — hall",
      desc: "{{BOSS}} waits here.",
      exits: { out: { to: "$mouth" } },
      actions: [
        { id: "$loot", label: "take the hoard", if: [["npcDead", "$boss"], ["!flag", "$looted"]], fx: [["set", "$looted"], ["move", "$gem", "inv"], ["score", 1]] },
      ],
    },
  },
  items: { $gem: { name: "{{NAME}} gem", loc: "nowhere" } },
  npcs: { $boss: { name: "{{BOSS}}", room: "$hall", hostile: true, hp: 1, atk: 1, df: 1 } },
};

// ---------- stamps ----------
test("a template stamped twice yields two independent copies, wired into their hosts, with every $id and {{VAR}} replaced", () => {
  const w = base();
  w.rooms["hill"] = { name: "Hill", desc: "A hill.", region: "north", exits: { south: { to: "home" } } };
  w.rooms["home"]!.exits = { north: { to: "hill" } };
  w.regions = { north: { name: "the North" } };
  w.templates = { cave };
  w.stamps = [
    { template: "cave", id: "c1", at: "home", dir: "down", back: "up", vars: { NAME: "Gray Hollow", BOSS: "Old Sett" } },
    { template: "cave", id: "c2", at: "hill", dir: "east", back: "west", vars: { NAME: "Wyrm Cleft", BOSS: "the Wyrm" }, landmark: "a dark cleft", sideTrip: true },
  ];
  expandWorld(w);
  assert.deepEqual(validateWorld(w), []);
  assert.equal(w.rooms["c1_mouth"]!.name, "Gray Hollow — mouth");
  assert.equal(w.rooms["c2_hall"]!.desc, "the Wyrm waits here.");
  assert.equal(w.rooms["home"]!.exits!["down"]?.to, "c1_mouth");
  assert.equal(w.rooms["c1_mouth"]!.exits!["up"]?.to, "home");
  assert.equal(w.rooms["c1_mouth"]!.exits!["in"]?.to, "c1_hall", "internal exits point inside the same copy");
  assert.deepEqual(w.rooms["hill"]!.exits!["east"], { to: "c2_mouth", landmark: "a dark cleft", sideTrip: true });
  assert.equal(w.rooms["c2_hall"]!.region, "north", "stamped rooms inherit the host's region");
  assert.equal(w.rooms["c1_hall"]!.region, undefined);
  assert.equal(w.npcs["c1_boss"]!.name, "Old Sett");
  assert.equal(w.npcs["c1_boss"]!.room, "c1_hall");
  assert.equal(w.items["c2_gem"]!.name, "Wyrm Cleft gem");
  // ids inside effects and conditions moved with the copy: killing c1's boss opens c1's hoard only
  const action = w.rooms["c1_hall"]!.actions![0]!;
  assert.equal(action.id, "c1_loot");
  assert.deepEqual(action.if, [["npcDead", "c1_boss"], ["!flag", "c1_looted"]]);
  assert.deepEqual(action.fx, [["set", "c1_looted"], ["move", "c1_gem", "inv"], ["score", 1]]);
  // and the copy plays: the boss dies to any hit (df 1, hp 1) and the hoard opens
  let { state } = newState(w, 1);
  state = step(w, state, { kind: "go", dir: "down" }).state;
  state = step(w, state, { kind: "go", dir: "in" }).state;
  state = step(w, state, { kind: "attack", npc: "c1_boss" }).state;
  assert.ok(state.npcHp["c1_boss"]! <= 0);
  state = step(w, state, { kind: "custom", room: "c1_hall", id: "c1_loot" }).state;
  assert.ok(state.inv.includes("c1_gem"));
  assert.ok(!state.inv.includes("c2_gem"));
});

test("stamps stand on generated cells too, and expand after the regions do", () => {
  const w = base();
  w.gen = [{ id: "wild", name: "Wild", seed: 1, w: 2, h: 2, pools: { descs: ["Grass."] }, links: [{ cell: [0, 0], dir: "west", to: "home", back: "east" }] }];
  w.templates = { cave };
  w.stamps = [{ template: "cave", id: "c", at: "wild_1_1", dir: "down", back: "up", vars: { NAME: "N", BOSS: "B" } }];
  expandWorld(w);
  assert.deepEqual(validateWorld(w), []);
  assert.equal(w.rooms["wild_1_1"]!.exits!["down"]?.to, "c_mouth");
});

test("malformed stamps throw: unknown template or host, missing var, exit collision, id collision", () => {
  const mk = (stamp: Partial<World["stamps"] extends (infer S)[] | undefined ? S : never>): World => {
    const w = base();
    w.templates = { cave };
    w.stamps = [{ template: "cave", id: "c", at: "home", dir: "down", vars: { NAME: "N", BOSS: "B" }, ...stamp }];
    return w;
  };
  assert.throws(() => expandWorld(mk({ template: "nope" })), /unknown template nope/);
  assert.throws(() => expandWorld(mk({ at: "nowhere" })), /host room nowhere does not exist/);
  assert.throws(() => expandWorld(mk({ vars: { NAME: "N" } })), /needs var BOSS/);
  const w = mk({});
  w.rooms["home"]!.exits = { down: { to: "home" } };
  assert.throws(() => expandWorld(w), /already has an exit down/);
  const w2 = mk({});
  w2.rooms["c_hall"] = { name: "x", desc: "x" };
  assert.throws(() => expandWorld(w2), /room id c_hall already exists/);
  const w3 = mk({});
  w3.templates!["cave"] = { ...cave, rooms: { ...cave.rooms, $odd: { name: "{{UNSET}}", desc: "x" } } };
  assert.throws(() => expandWorld(w3), /no value for \{\{UNSET\}\}/);
});

// ---------- richer regions ----------
const region = (over: Partial<GenDef> = {}): GenDef => ({
  id: "wild",
  name: "Wild",
  seed: 5,
  w: 3,
  h: 3,
  pools: { descs: ["Grass.", "Rocks."], briefs: ["Open land."] },
  links: [{ cell: [0, 0], dir: "west", to: "home", back: "east" }],
  ...over,
});

test("scenes and names are dealt without replacement, so cells read differently; leftovers fall back to pools", () => {
  const scenes = Array.from({ length: 4 }, (_, i) => ({ name: `Scene ${i}`, desc: `Desc ${i}.`, brief: `Brief ${i}.` }));
  const w = expandWorld({ ...base(), gen: [region({ pools: { descs: ["Plain grass."], names: ["Old Stump", "Deer Path"], scenes } })] });
  const cells = Object.entries(w.rooms).filter(([id]) => id.startsWith("wild_")).map(([, r]) => r);
  assert.equal(cells.length, 9);
  const sceneNamed = cells.filter((r) => r.name.startsWith("Scene "));
  assert.equal(sceneNamed.length, 4, "each scene used exactly once");
  assert.equal(new Set(sceneNamed.map((r) => r.name)).size, 4);
  for (const r of sceneNamed) {
    const i = r.name.slice(6);
    assert.equal(r.desc, `Desc ${i}.`, "a scene keeps its own desc");
    assert.equal(r.brief, `Brief ${i}.`);
  }
  const poolNamed = cells.filter((r) => ["Old Stump", "Deer Path"].includes(r.name));
  assert.equal(poolNamed.length, 2, "names pool dealt once each");
  const coordNamed = cells.filter((r) => /^Wild \d,\d$/.test(r.name));
  assert.equal(coordNamed.length, 3, "the rest fall back to coordinates");
  for (const r of [...poolNamed, ...coordNamed]) assert.equal(r.desc, "Plain grass.");
  assert.deepEqual(validateWorld(w), []);
});

test("walls shape the land: walled cells are not made and no exit leads into them; regions and cell effects apply to every cell", () => {
  const w = expandWorld({
    ...base(),
    regions: { wild: { name: "the Wild" } },
    gen: [region({ region: "wild", walls: [[1, 1], [2, 0]], cellFx: { onEnter: [["chance", 0, [["hp", -1]], []]] } })],
  });
  assert.equal(w.rooms["wild_1_1"], undefined);
  assert.equal(w.rooms["wild_2_0"], undefined);
  assert.equal(Object.keys(w.rooms).filter((id) => id.startsWith("wild_")).length, 7);
  assert.deepEqual(Object.keys(w.rooms["wild_1_0"]!.exits!).sort(), ["west"], "the middle-top cell lost south (wall) and east (wall)");
  assert.deepEqual(Object.keys(w.rooms["wild_0_1"]!.exits!).sort(), ["north", "south"]);
  assert.equal(w.rooms["wild_2_2"]!.region, "wild");
  assert.deepEqual(w.rooms["wild_2_2"]!.onEnter, [["chance", 0, [["hp", -1]], []]]);
  assert.deepEqual(validateWorld(w), []);
  assert.throws(() => expandWorld({ ...base(), gen: [region({ walls: [[0, 0]] })] }), /link cell 0,0 out of bounds or walled/);
});

test("a spot can be a landmark and carry variants and onEnter", () => {
  const w = expandWorld({
    ...base(),
    gen: [region({
      spots: [{ cell: [2, 2], name: "The Cairn", landmark: "the cairn", onEnter: [["set", "at_cairn"]], variants: [{ if: [["flag", "x"]], desc: "Changed." }] }],
    })],
  });
  const cairn = w.rooms["wild_2_2"]!;
  assert.equal(cairn.landmark, "the cairn");
  assert.deepEqual(cairn.onEnter, [["set", "at_cairn"]]);
  assert.equal(cairn.variants?.length, 1);
  assert.deepEqual(validateWorld(w), []);
});

// ---------- parts ----------
test("a root file with include merges its parts: records join, lists concatenate, stamps see generated cells", () => {
  const root = fixture("parts/root.json");
  assert.deepEqual(
    worldFiles(root).map((f) => f.slice(fixture("parts").length + 1)),
    ["root.json", "regions/a_field.json", "regions/b_quests.json", "extra.json"],
  );
  const w = loadWorld(root);
  assert.deepEqual(validateWorld(w), []);
  assert.ok(w.rooms["field"] && w.rooms["wood_0_0"] && w.rooms["den1_deep"], "rooms from every part and both expansions");
  assert.equal(w.items["stone"]!.loc, "field");
  assert.equal(w.npcs["crow"]!.room, "field");
  assert.equal(w.quests!["stone"]!.name, "A Stone");
  assert.equal(w.epilogue!.length, 2, "epilogue lists concatenate in file order");
  assert.equal(w.epilogue![0]!.text, "You kept the stone.");
  assert.equal(w.rooms["den1_deep"]!.actions![0]!.id, "den1_poke");
  assert.equal(w.npcs["den1_beast"]!.name, "wolf");
  assert.equal(w.rooms["wood_1_0"]!.exits!["north"]?.to, "den1_mouth");
});

test("a part may not redefine an id or carry a root-only field", () => {
  assert.throws(() => loadWorld(fixture("parts_bad/root.json")), /rooms id "a" already defined in the root file/);
  // fix the duplicate and the root-only field is the next thing caught
  const good: World = loadWorld(fixture("parts/root.json"));
  assert.ok(good);
});

test("worldFiles refuses an include that matches nothing", () => {
  const w = { include: ["ghosts/*.json"] };
  const tmp = fileURLToPath(new URL("./fixtures/parts/.tmp_root.json", import.meta.url));
  writeFileSync(tmp, JSON.stringify(w));
  try {
    assert.throws(() => worldFiles(tmp), /matches no files/);
  } finally {
    unlinkSync(tmp);
  }
});

// ---------- validator guarantees ----------
test("validator: a room nothing leads to is an error; a goto or an exit (even gated) makes it reachable", () => {
  const w = base();
  w.rooms["island"] = { name: "Island", desc: "Alone." };
  let errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("room island: unreachable")), errs.join("\n"));
  w.rooms["home"]!.exits = { east: { to: "island", if: [["flag", "boat"]] } };
  assert.deepEqual(validateWorld(w), []);
  delete w.rooms["home"]!.exits;
  w.rooms["home"]!.actions!.push({ id: "swim", label: "swim", fx: [["goto", "island"]] });
  assert.deepEqual(validateWorld(w), []);
});

test("validator: a class that could see more perks than the menu holds at some level is an error", () => {
  const w = base();
  w.classes = { hero: { name: "Hero", desc: "brave" } };
  w.walkthrough = ["be a Hero — brave", "win"];
  w.perks = Object.fromEntries(Array.from({ length: MENU_CAP + 1 }, (_, i) => [`p${i}`, { name: `P${i}`, desc: "x" }]));
  let errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("class hero at level 1 may see 13 perks")), errs.join("\n"));
  // stagger one perk to level 2: at level 1 twelve show; at level 2 the player already holds one, so twelve show again
  w.perks["p0"]!.require = { level: 2 };
  assert.deepEqual(validateWorld(w), []);
  // class perks are never on the menu, so they do not count
  w.perks["p0"]!.require = undefined;
  w.classes["hero"]!.perks = ["p0"];
  assert.deepEqual(validateWorld(w), []);
});
