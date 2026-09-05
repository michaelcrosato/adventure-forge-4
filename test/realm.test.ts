/**
 * The scale layer: fast travel across regions, rooms that change with the
 * player's choices, the quest journal, epilogue lines, and hud counters.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { actionByLabel, actionLabel, inTravelMode, journal, legalActions, newState, roomView, step, travelAvailable } from "../src/engine.ts";
import { render, renderStatus } from "../src/format.ts";
import { validateWorld } from "../src/validate.ts";
import { EPILOGUE_CAP, MENU_CAP } from "../src/types.ts";
import type { RoomDef, State, World } from "../src/types.ts";

const labels = (world: World, s: State) => legalActions(world, s).map((a) => actionLabel(world, a, s));
const doLabel = (world: World, s: State, label: string): State => {
  const a = actionByLabel(world, s, label);
  assert.ok(a, `legal action "${label}" at ${s.room}; menu: ${labels(world, s).join(" | ")}`);
  return step(world, s, a).state;
};

/** A line of n rooms; every room is a landmark, optionally in a region. */
const line = (n: number, regionOf?: (i: number) => string): World => {
  const rooms: Record<string, RoomDef> = {};
  for (let i = 0; i < n; i++) {
    rooms[`r${i}`] = {
      name: `Room ${i}`,
      desc: `Room ${i}.`,
      landmark: `place ${i}`,
      ...(regionOf ? { region: regionOf(i) } : {}),
      exits: {
        ...(i > 0 ? { west: { to: `r${i - 1}` } } : {}),
        ...(i < n - 1 ? { east: { to: `r${i + 1}` } } : {}),
      },
    };
  }
  return { id: "line", title: "L", intro: "x", start: "r0", hp: 10, maxScore: 5, rooms, items: {}, npcs: {}, walkthrough: [] };
};

// ---------- fast travel ----------
test("travel appears once somewhere is known, lists known places, and moves the player", () => {
  const world = line(4);
  let { state } = newState(world, 1);
  assert.ok(!travelAvailable(world, state), "nowhere known yet");
  assert.ok(!labels(world, state).includes("travel to a known place"));
  state = doLabel(world, state, "go east");
  state = doLabel(world, state, "go east");
  assert.ok(labels(world, state).includes("travel to a known place"));
  state = doLabel(world, state, "travel to a known place");
  assert.ok(inTravelMode(world, state));
  assert.deepEqual(labels(world, state), ["to place 0", "to place 1", "stay here"]);
  const shown = render(world, state, []).text;
  assert.match(shown, /Travel — places you know:/);
  assert.doesNotMatch(shown, /exits:/, "the room waits while the map is open");
  const out = step(world, state, actionByLabel(world, state, "to place 0")!);
  assert.equal(out.state.room, "r0");
  assert.equal(out.state.travelMenu, null);
  assert.match(out.events.join(" "), /You travel to place 0\./);
  // stay here closes the menu without moving
  state = doLabel(world, out.state, "travel to a known place");
  state = doLabel(world, state, "stay here");
  assert.equal(state.room, "r0");
  assert.equal(state.travelMenu, null);
  assert.ok(labels(world, state).includes("go east"));
});

test("travel is offered from an ordinary room too, but never with an aggressive npc at hand", () => {
  const world = line(3);
  delete world.rooms["r1"]!.landmark;
  world.npcs = { wolf: { name: "wolf", room: "r2", aggressive: true, hp: 100, atk: 1, df: 30 } };
  let { state } = newState(world, 1);
  state = doLabel(world, state, "go east"); // r1: no landmark, but r0 is known — the lost can walk back
  assert.ok(labels(world, state).includes("travel to a known place"));
  state = doLabel(world, state, "go east"); // r2: landmark, but a wolf
  assert.ok(!labels(world, state).includes("travel to a known place"));
  state.npcHp["wolf"] = 0;
  assert.ok(labels(world, state).includes("travel to a known place"), "a dead wolf keeps no one from leaving");
  world.rooms["r2"]!.noTravel = true;
  assert.ok(!labels(world, state).includes("travel to a known place"), "a noTravel room is walked out of");
});

test("with more known landmarks than the menu holds, travel groups them by region, and 'back' steps out", () => {
  const n = MENU_CAP + 4;
  const world = line(n, (i) => (i < 6 ? "west" : "east"));
  world.regions = { west: { name: "the West" }, east: { name: "the East" } };
  let { state } = newState(world, 1);
  for (let i = 0; i < n - 1; i++) state = doLabel(world, state, "go east");
  state = doLabel(world, state, "travel to a known place");
  assert.deepEqual(labels(world, state), ["toward the West", "toward the East", "stay here"]);
  state = doLabel(world, state, "toward the West");
  assert.deepEqual(labels(world, state), ["to place 0", "to place 1", "to place 2", "to place 3", "to place 4", "to place 5", "back"]);
  state = doLabel(world, state, "back");
  assert.equal(state.travelMenu, "", "back returns to the region list");
  state = doLabel(world, state, "toward the East");
  assert.ok(!labels(world, state).includes(`to place ${n - 1}`), "the room you stand in is not a destination");
  state = doLabel(world, state, "to place 7");
  assert.equal(state.room, "r7");
  assert.ok(legalActions(world, state).length <= MENU_CAP);
});

test("validator: travel menus must always fit, regions must exist, landmarks need a region once regions exist", () => {
  const big = line(MENU_CAP + 1);
  big.rooms["r0"]!.actions = [{ id: "win", label: "win", fx: [["score", 5], ["end", "win", "done", "Done."]] }];
  big.walkthrough = ["win"];
  let errs = validateWorld(big);
  assert.ok(errs.some((e) => e.includes("define regions to group them")), errs.join("\n"));

  const grouped = line(MENU_CAP + 1, () => "one");
  grouped.regions = { one: { name: "One" } };
  grouped.rooms["r0"]!.actions = big.rooms["r0"]!.actions;
  grouped.walkthrough = ["win"];
  errs = validateWorld(grouped);
  assert.ok(errs.some((e) => e.includes("region one has")), errs.join("\n"));

  const bad = line(2);
  bad.regions = { a: { name: "A" } };
  bad.rooms["r0"]!.region = "nowhere";
  bad.rooms["r0"]!.actions = big.rooms["r0"]!.actions;
  bad.walkthrough = ["win"];
  errs = validateWorld(bad);
  assert.ok(errs.some((e) => e.includes("unknown region nowhere")), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("room r1: a landmark needs a region")), errs.join("\n"));
});

test("travel steps replay from a walkthrough by label", () => {
  const world = line(3);
  world.rooms["r0"]!.actions = [{ id: "win", label: "win", fx: [["score", 5], ["end", "win", "done", "Done."]] }];
  world.walkthrough = ["go east", "go east", "travel to a known place", "to place 0", "win"];
  assert.deepEqual(validateWorld(world), []);
});

// ---------- variants ----------
test("a room's first matching variant overrides its name, desc, and brief; the header follows", () => {
  const world: World = {
    id: "v", title: "V", intro: "x", start: "a", hp: 10, maxScore: 5,
    rooms: {
      a: {
        name: "Millbrook",
        desc: "A quiet mill town.",
        brief: "The mill turns.",
        variants: [
          { if: [["flag", "burned"], ["flag", "rebuilt"]], name: "Millbrook, rebuilt", desc: "New timber everywhere." },
          { if: [["flag", "burned"]], name: "Millbrook, ashes", desc: "The mill is a black stump.", brief: "Ash and silence." },
        ],
        actions: [
          { id: "burn", label: "burn it", fx: [["set", "burned"]] },
          { id: "build", label: "rebuild", fx: [["set", "rebuilt"]] },
        ],
      },
    },
    items: {}, npcs: {}, walkthrough: [],
  };
  let { state } = newState(world, 1);
  assert.equal(roomView(world, state).desc, "A quiet mill town.");
  assert.match(render(world, state, [], { full: true }).text, /^=Millbrook \|/);
  state = doLabel(world, state, "burn it");
  assert.deepEqual(roomView(world, state), { name: "Millbrook, ashes", desc: "The mill is a black stump.", brief: "Ash and silence." });
  assert.match(render(world, state, []).text, /^=Millbrook, ashes \|/);
  assert.match(render(world, state, []).text, /Ash and silence\./);
  state = doLabel(world, state, "rebuild");
  const v = roomView(world, state);
  assert.equal(v.name, "Millbrook, rebuilt");
  assert.equal(v.brief, "The mill turns.", "a variant without a brief keeps the base brief");
  // a variant that changes nothing is a validator error
  world.rooms["a"]!.variants!.push({ if: [] });
  world.rooms["a"]!.actions!.push({ id: "win", label: "win", fx: [["score", 5], ["end", "win", "done", "Done."]] });
  world.walkthrough = ["win"];
  assert.ok(validateWorld(world).some((e) => e.includes("variant 2: changes nothing")));
});

// ---------- journal ----------
const questWorld = (): World => ({
  id: "q", title: "Q", intro: "x", start: "a", hp: 10, maxScore: 5,
  rooms: {
    a: {
      name: "A",
      desc: "A.",
      actions: [
        { id: "hear", label: "hear the plea", fx: [["set", "heard"]] },
        { id: "find", label: "find the ring", fx: [["set", "ring"]] },
        { id: "give", label: "give the ring", fx: [["set", "given"]] },
        { id: "sell", label: "sell the ring", fx: [["set", "sold"]] },
      ],
    },
  },
  items: {}, npcs: {}, walkthrough: [],
  quests: {
    ring: {
      name: "The Widow's Ring",
      start: [["flag", "heard"]],
      done: [["flag", "given"]],
      failed: [["flag", "sold"]],
      stages: [
        { if: [["flag", "ring"]], text: "Bring the ring back to the widow." },
        { if: [], text: "Find the ring the widow lost in the mill." },
      ],
    },
    always: { name: "Go home", stages: [{ if: [], text: "Walk home." }] },
  },
});

test("the journal starts, advances, completes, or fails on conditions — and every change prints the turn it happens", () => {
  const world = questWorld();
  let { state } = newState(world, 1);
  assert.deepEqual(journal(world, state).map((q) => q.id), ["always"], "an unstarted quest is not listed");
  const heard = step(world, state, actionByLabel(world, state, "hear the plea")!);
  assert.match(heard.events.join(" "), /Quest — The Widow's Ring: Find the ring the widow lost in the mill\./);
  state = heard.state;
  const found = step(world, state, actionByLabel(world, state, "find the ring")!);
  assert.match(found.events.join(" "), /Quest — The Widow's Ring: Bring the ring back to the widow\./);
  state = found.state;
  assert.match(renderStatus(world, state), /Quests:\n- The Widow's Ring: Bring the ring back to the widow\.\n- Go home: Walk home\./);
  const given = step(world, state, actionByLabel(world, state, "give the ring")!);
  assert.match(given.events.join(" "), /Quest done: The Widow's Ring\./);
  assert.match(renderStatus(world, given.state), /Done: The Widow's Ring/);
  // a quiet turn prints nothing about the journal
  const quiet = step(world, given.state, actionByLabel(world, given.state, "hear the plea")!);
  assert.doesNotMatch(quiet.events.join(" "), /Quest/);
  // the other branch fails it
  const sold = step(world, state, actionByLabel(world, state, "sell the ring")!);
  assert.match(sold.events.join(" "), /Quest failed: The Widow's Ring\./);
  assert.match(renderStatus(world, sold.state), /Failed: The Widow's Ring/);
});

test("validator: quests need stages with conditions and text", () => {
  const world = questWorld();
  world.quests!["empty"] = { name: "Empty", stages: [] };
  world.quests!["bad"] = { name: "Bad", stages: [{ if: [["flag", "x"]] } as never] };
  world.rooms["a"]!.actions!.push({ id: "win", label: "win", fx: [["score", 5], ["end", "win", "done", "Done."]] });
  world.walkthrough = ["win"];
  const errs = validateWorld(world);
  assert.ok(errs.some((e) => e.includes("quest empty: needs at least one stage")), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("quest bad stage 0") && e.includes('"text"')), errs.join("\n"));
});

// ---------- epilogue and hud ----------
test("an ending appends every matching epilogue line in order, capped, and the hud rides the status line", () => {
  const world: World = {
    id: "e", title: "E", intro: "x", start: "a", hp: 10, maxScore: 5,
    hud: [{ var: "gold", label: "gold" }],
    rooms: {
      a: {
        name: "A",
        desc: "A.",
        actions: [
          { id: "earn", label: "earn", fx: [["addvar", "gold", 7], ["set", "rich"]] },
          { id: "win", label: "win", fx: [["score", 5], ["end", "win", "done", "Done."]] },
        ],
      },
    },
    items: {}, npcs: {}, walkthrough: [],
    epilogue: [
      { if: [["flag", "rich"]], text: "You died wealthy." },
      { if: [["!flag", "rich"]], text: "You died poor." },
      ...Array.from({ length: EPILOGUE_CAP + 3 }, (_, i) => ({ if: [] as never[], text: `Line ${i}.` })),
    ],
  };
  let { state } = newState(world, 1);
  assert.match(render(world, state, []).text, /t0 gold0$/m);
  state = doLabel(world, state, "earn");
  assert.match(render(world, state, []).text, /t1 gold7$/m);
  assert.match(renderStatus(world, state), /gold: 7/);
  const end = step(world, state, actionByLabel(world, state, "win")!);
  const text = render(world, end.state, end.events).text;
  assert.match(text, /Done\.\nYou died wealthy\.\nLine 0\./);
  assert.doesNotMatch(text, /You died poor/);
  const lines = text.split("\n").filter((l) => /^(You died|Line \d)/.test(l));
  assert.equal(lines.length, EPILOGUE_CAP, "capped");
  assert.match(text, /receipt:/);
});

test("epilogue weight decides which true lines survive the cap; survivors read in file order", () => {
  const world: World = {
    id: "w", title: "W", intro: "x", start: "a", hp: 10, maxScore: 1,
    rooms: { a: { name: "A", desc: "A.", actions: [{ id: "win", label: "win", fx: [["score", 1], ["end", "win", "done", "Done."]] }] } },
    items: {}, npcs: {}, walkthrough: [],
    epilogue: [
      ...Array.from({ length: EPILOGUE_CAP }, (_, i) => ({ if: [] as never[], text: `Filler ${i}.` })),
      { if: [], text: "The capital fell quiet.", weight: 3 },
      { if: [], text: "The hold burned.", weight: 2 },
    ],
  };
  const { state } = newState(world, 1);
  const end = step(world, state, actionByLabel(world, state, "win")!);
  const text = render(world, end.state, end.events).text;
  // the two weighted lines take places from the last fillers, and print where the file put them
  assert.match(text, /Filler 3\.\nThe capital fell quiet\.\nThe hold burned\./);
  assert.doesNotMatch(text, /Filler 4\./);
  assert.doesNotMatch(text, /Filler 5\./);
  assert.equal(text.split("\n").filter((l) => /^(Filler \d|The )/.test(l)).length, EPILOGUE_CAP);
  const bad = validateWorld({ ...world, epilogue: [{ if: [], text: "x", weight: "heavy" as never }] });
  assert.equal(bad.filter((e) => /weight must be a number/.test(e)).length, 1);
});

test("an item's hint follows its variants: a 'show it to X' goes quiet once shown", () => {
  const world: World = {
    id: "h", title: "H", intro: "x", start: "a", hp: 10, maxScore: 1,
    rooms: { a: { name: "A", desc: "A.", actions: [{ id: "show", label: "show it", fx: [["set", "shown"]] }] } },
    items: {
      pelt: { name: "pelt", loc: "a", takeable: true, hint: "the hunter might want to see it", variants: [{ if: [["flag", "shown"]], hint: "" }] },
      note: { name: "note", loc: "inv", hint: "read it at the stone", use: [{ fx: [["say", "Read."]] }], variants: [{ if: [["flag", "shown"]], hint: "read, and kept" }] },
    },
    npcs: {}, walkthrough: [],
  };
  assert.deepEqual(validateWorld(world).filter((e) => !/^walkthrough/.test(e)), []);
  let { state } = newState(world, 1);
  const took = step(world, state, actionByLabel(world, state, "take pelt")!);
  assert.match(took.events.join(" "), /taken\. \(the hunter might want to see it\)/);
  state = took.state;
  assert.match(renderStatus(world, state), /carrying: note \(read it at the stone\), pelt \(the hunter might want to see it\)/);
  assert.match(render(world, state, [], { full: true }).text, /use note \(read it at the stone\)/);
  state = doLabel(world, state, "show it");
  assert.match(renderStatus(world, state), /carrying: note \(read, and kept\), pelt$/m);
  assert.match(render(world, state, [], { full: true }).text, /use note \(read, and kept\)/);
  const bad = validateWorld({ ...world, items: { ...world.items, pelt: { ...world.items.pelt!, variants: [{ hint: "x" } as never] } } });
  assert.ok(bad.some((e) => /item pelt variant 0/.test(e)));
});

test("a quest that first appears already done says nothing; one the player carried announces its end", () => {
  const world: World = {
    id: "j", title: "J", intro: "x", start: "a", hp: 10, maxScore: 1,
    rooms: { a: { name: "A", desc: "A.", actions: [
      { id: "writ", label: "earn the writ", fx: [["set", "writ"]] },
      { id: "enter", label: "enter the downs", fx: [["set", "downs"]] },
      { id: "ask", label: "hear the ask", fx: [["set", "asked"]] },
    ] } },
    items: {}, npcs: {}, walkthrough: [],
    quests: {
      late: { name: "The Writ", start: [["flag", "downs"]], done: [["flag", "writ"]], stages: [{ if: [], text: "Earn the writ." }] },
      carried: { name: "The Ask", start: [["flag", "asked"]], done: [["flag", "downs"]], stages: [{ if: [], text: "Do it." }] },
    },
  };
  let { state } = newState(world, 1);
  state = step(world, state, actionByLabel(world, state, "earn the writ")!).state;
  const ask = step(world, state, actionByLabel(world, state, "hear the ask")!);
  assert.match(ask.events.join(" "), /Quest — The Ask: Do it\./);
  state = ask.state;
  const enter = step(world, state, actionByLabel(world, state, "enter the downs")!);
  const said = enter.events.join(" ");
  assert.match(said, /Quest done: The Ask\./, "a carried quest announces its end");
  assert.doesNotMatch(said, /The Writ/, "a quest born already done is not announced");
  assert.match(renderStatus(world, enter.state), /Done: .*The Writ/, "it still counts as done in the journal");
});

test("staged objectives follow the story, and after the end status tells every epilogue line", () => {
  const world: World = {
    id: "o", title: "O", intro: "x", start: "a", hp: 10, maxScore: 1,
    objectives: [{ if: [["flag", "late"]], text: "Act 2: finish it." }, { if: [], text: "Act 1: begin." }],
    rooms: { a: { name: "A", desc: "A.", actions: [
      { id: "on", label: "go on", fx: [["set", "late"]] },
      { id: "win", label: "win", fx: [["score", 1], ["end", "win", "done", "Done."]] },
    ] } },
    items: {}, npcs: {}, walkthrough: [],
    epilogue: Array.from({ length: EPILOGUE_CAP + 2 }, (_, i) => ({ if: [] as never[], text: `Line ${i}.` })),
  };
  assert.deepEqual(validateWorld(world).filter((e) => !/walkthrough|no proof/.test(e)), []);
  let { state } = newState(world, 1);
  assert.match(renderStatus(world, state), /^Act 1: begin\./);
  state = doLabel(world, state, "go on");
  assert.match(renderStatus(world, state), /^Act 2: finish it\./);
  const end = step(world, state, actionByLabel(world, state, "win")!);
  const shown = render(world, end.state, end.events).text;
  assert.equal(shown.split("\n").filter((l) => /^Line \d/.test(l)).length, EPILOGUE_CAP, "the ending screen keeps its cap");
  assert.match(shown, /status tells the rest/);
  const after = renderStatus(world, end.state);
  assert.match(after, /How the realm remembers you:/);
  assert.equal(after.split("\n").filter((l) => /^- Line \d/.test(l)).length, EPILOGUE_CAP + 2, "status tells them all");
  const bad = validateWorld({ ...world, objectives: [{ text: "no if" } as never] });
  assert.ok(bad.some((e) => /objectives 0/.test(e)));
});

test("the first time fast travel is on the menu, one hint says so — and never again", () => {
  const world = line(3);
  let { state } = newState(world, 1);
  const first = step(world, state, actionByLabel(world, state, "go east")!);
  assert.match(first.events.join(" "), /travel to a known place/);
  state = first.state;
  const second = step(world, state, actionByLabel(world, state, "go east")!);
  assert.doesNotMatch(second.events.join(" "), /travel to a known place/);
  assert.ok(state.flags["_seenTravel"]);
});

test("the first unexplored side-trip exit earns a one-time legend for the * marker", () => {
  const world = line(3);
  world.rooms["r1"]!.exits!["north"] = { to: "r2", sideTrip: true };
  let { state } = newState(world, 1);
  const first = step(world, state, actionByLabel(world, state, "go east")!);
  assert.match(first.events.join(" "), /\* marks an optional side path not yet visited/);
  state = first.state;
  state = doLabel(world, state, "go west");
  const again = step(world, state, actionByLabel(world, state, "go east")!);
  assert.doesNotMatch(again.events.join(" "), /side path/);
});
