/**
 * The depth layer: conversation mode, companions, aggressive enemies, and the
 * chance effect. Small in-memory worlds so each rule is tested alone.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { actionByLabel, actionLabel, inTalkMode, legalActions, newState, step } from "../src/engine.ts";
import { render, renderStatus } from "../src/format.ts";
import { validateWorld } from "../src/validate.ts";
import type { Action, State, World } from "../src/types.ts";

const mini = (over: Partial<World> = {}): World => ({
  id: "mini",
  title: "Mini",
  intro: "A test.",
  start: "a",
  hp: 10,
  maxScore: 10,
  rooms: {
    a: { name: "A", desc: "Room A.", exits: { east: { to: "b" } } },
    b: { name: "B", desc: "Room B.", exits: { west: { to: "a" } } },
  },
  items: {},
  npcs: {},
  walkthrough: [],
  ...over,
});

const labels = (world: World, s: State) => legalActions(world, s).map((a) => actionLabel(world, a, s));
const doLabel = (world: World, s: State, label: string): State => {
  const a = actionByLabel(world, s, label);
  assert.ok(a, `legal action "${label}" at ${s.room}; menu: ${labels(world, s).join(" | ")}`);
  return step(world, s, a).state;
};

// ---------- conversation mode ----------
const talker = (): World =>
  mini({
    npcs: {
      elder: {
        name: "elder",
        room: "a",
        dialogue: true,
        topics: [
          { id: "hello", label: "greet", say: "Hm.", once: true },
          { id: "vale", label: "the vale", say: "Old.", once: true },
          { id: "bye", label: "take your leave", say: "Go well.", end: true },
        ],
      },
      guard: {
        name: "guard",
        room: "a",
        topics: [{ id: "pass", label: "the gate", say: "Closed." }],
      },
    },
  });

test("a dialogue npc folds its topics behind one 'talk to' entry; inline npcs are unchanged", () => {
  const world = talker();
  const { state } = newState(world, 1);
  const menu = labels(world, state);
  assert.ok(menu.includes("talk to elder"), menu.join(" | "));
  assert.ok(!menu.some((l) => l.startsWith("ask elder:")), "elder's topics stay behind the door");
  assert.ok(menu.includes("ask guard: the gate"), "an inline npc still lists topics directly");
});

test("talking opens a menu of that npc's topics plus 'end conversation', and hides the room", () => {
  const world = talker();
  let { state } = newState(world, 1);
  state = doLabel(world, state, "talk to elder");
  assert.ok(inTalkMode(world, state));
  assert.deepEqual(labels(world, state), ["greet", "the vale", "take your leave", "end conversation"]);
  const shown = render(world, state, []).text;
  assert.match(shown, /talking with elder/);
  assert.doesNotMatch(shown, /Room A\./);
  assert.doesNotMatch(shown, /exits:/);
  // a line spoken inside the conversation is attributed as usual
  const out = step(world, state, actionByLabel(world, state, "greet")!);
  assert.match(out.events.join(" "), /elder: "Hm\."/);
  state = out.state;
  assert.ok(inTalkMode(world, state), "still talking after an ordinary line");
  assert.ok(!labels(world, state).includes("greet"), "a once topic is gone after it is said");
});

test("a topic marked end closes the conversation; so does 'end conversation'; so does running out of things to say", () => {
  const world = talker();
  let { state } = newState(world, 1);
  state = doLabel(world, state, "talk to elder");
  state = doLabel(world, state, "take your leave");
  assert.equal(state.talking, null);
  assert.ok(labels(world, state).includes("talk to elder"), "back in the room");

  state = doLabel(world, state, "talk to elder");
  state = doLabel(world, state, "end conversation");
  assert.equal(state.talking, null);

  // exhaust the once topics: the last line closes it on its own
  state = doLabel(world, state, "talk to elder");
  state = doLabel(world, state, "greet");
  state = doLabel(world, state, "the vale");
  assert.ok(inTalkMode(world, state), "one topic (the farewell) is still on offer");
  state = doLabel(world, state, "take your leave");
  assert.equal(state.talking, null);
  // with only the farewell left, 'talk to' still appears (it has a visible topic)
  assert.ok(labels(world, state).includes("talk to elder"));
});

test("a conversation whose npc walks off (npcgo in a topic) closes and returns the room menu", () => {
  const world = mini({
    npcs: {
      wisp: {
        name: "wisp",
        room: "a",
        dialogue: true,
        topics: [{ id: "go", label: "shoo it", say: "...", fx: [["npcgo", "wisp", "b"]] }],
      },
    },
  });
  let { state } = newState(world, 1);
  state = doLabel(world, state, "talk to wisp");
  state = doLabel(world, state, "shoo it");
  assert.equal(state.talking, null);
  assert.ok(labels(world, state).includes("go east"));
});

test("walkthroughs can drive a conversation by label", () => {
  const world = talker();
  world.rooms["a"]!.actions = [{ id: "win", label: "win", fx: [["score", 10], ["end", "win", "done", "Done."]] }];
  world.walkthrough = ["talk to elder", "greet", "end conversation", "win"];
  assert.deepEqual(validateWorld(world), []);
});

// ---------- party ----------
const company = (): World =>
  mini({
    items: { sword: { name: "sword", loc: "inv", hit: 0, dmg: 2 } },
    npcs: {
      lys: {
        name: "Lys",
        room: "a",
        hp: 6,
        companion: {
          hit: 2,
          dmg: 2,
          remarks: [
            { id: "b_room", if: [["flag", "in_b"]], say: "Cold in here." },
            { id: "joined", say: "Lead on." },
          ],
        },
        topics: [{ id: "join", label: "come with me", say: "Fine.", fx: [["party", "lys", "join"]], once: true }],
      },
      troll: { name: "troll", room: "b", hostile: true, hp: 1000, atk: 3, df: 1 }, // df 1: every roll hits
    },
  });

test("a companion who joins follows the player room to room, is listed as 'with you', and is not a target", () => {
  const world = company();
  world.rooms["b"]!.onEnter = [["set", "in_b"]];
  let { state } = newState(world, 1);
  assert.ok(labels(world, state).includes("attack Lys with sword"), "a stranger with hp can be attacked");
  const out = step(world, state, actionByLabel(world, state, "ask Lys: come with me")!);
  state = out.state;
  assert.deepEqual(state.party, ["lys"]);
  assert.match(out.events.join(" "), /Lys joins you\./);
  assert.match(out.events.join(" "), /Lys: "Lead on\."/, "the unconditional remark fires the turn she joins");
  assert.ok(!labels(world, state).includes("attack Lys with sword"), "companions are not targets");
  assert.match(render(world, state, []).text, /with you: Lys/);
  assert.doesNotMatch(render(world, state, []).text, /Lys is here/);

  const moved = step(world, state, actionByLabel(world, state, "go east")!);
  state = moved.state;
  assert.equal(state.npcRoom["lys"], "b", "she arrives with the player");
  assert.match(moved.events.join(" "), /Lys: "Cold in here\."/, "a conditional remark fires once its flag is set");
  // remarks are once: going back and forth does not repeat them
  state = doLabel(world, state, "go west");
  const again = step(world, state, actionByLabel(world, state, "go east")!);
  assert.doesNotMatch(again.events.join(" "), /Cold in here/);
  assert.match(renderStatus(world, again.state), /Party: Lys/);
});

test("companions roll their own attacks after the player's, and a leaving companion stays behind", () => {
  const world = company();
  let { state } = newState(world, 1);
  state = doLabel(world, state, "ask Lys: come with me");
  state = doLabel(world, state, "go east");
  const hpBefore = state.npcHp["troll"]!;
  const out = step(world, state, actionByLabel(world, state, "attack troll with sword")!);
  // df 1: both the player (2 dmg) and Lys (2 dmg) land every time
  assert.equal(hpBefore - out.state.npcHp["troll"]!, 4);
  assert.match(out.events.join(" "), /Lys hits the troll/);
  // the troll strikes back exactly once, at the player
  assert.equal(out.events.filter((e) => /strikes back/.test(e)).length, 1);
  state = out.state;
  // leave: she stays in b while the player walks west
  const left = step(world, { ...state }, { kind: "go", dir: "west" }).state;
  assert.equal(left.npcRoom["lys"], "a", "still in the party, so she follows");
  world.rooms["a"]!.actions = [{ id: "part", label: "part ways", fx: [["party", "lys", "leave"]] }];
  let s2 = doLabel(world, left, "part ways");
  assert.deepEqual(s2.party, []);
  s2 = doLabel(world, s2, "go east");
  assert.equal(s2.npcRoom["lys"], "a", "a dismissed companion does not follow");
});

test("inParty conditions gate content", () => {
  const world = company();
  world.rooms["a"]!.actions = [
    { id: "duet", label: "sing a duet", if: [["inParty", "lys"]], fx: [["say", "la"]] },
    { id: "solo", label: "sing alone", if: [["!inParty", "lys"]], fx: [["say", "la"]] },
  ];
  let { state } = newState(world, 1);
  assert.ok(labels(world, state).includes("sing alone"));
  assert.ok(!labels(world, state).includes("sing a duet"));
  state = doLabel(world, state, "ask Lys: come with me");
  assert.ok(labels(world, state).includes("sing a duet"));
  assert.ok(!labels(world, state).includes("sing alone"));
});

// ---------- aggressive ----------
test("an aggressive npc strikes at the end of every turn spent in its room, and not when the player has left", () => {
  const world = mini({
    items: { mail: { name: "mail", loc: "inv", armor: 1 } },
    npcs: { wolf: { name: "wolf", room: "b", aggressive: true, hp: 100, atk: 3, df: 30 } }, // df 30: unkillable here
  });
  let { state } = newState(world, 1);
  const enter = step(world, state, { kind: "go", dir: "east" });
  // 3 atk - 1 armor = 2 taken, on the very turn of arrival
  assert.equal(enter.state.hp, 8);
  assert.match(enter.events.join(" "), /The wolf attacks — your armor takes 1 of it\./);
  state = enter.state;
  // attacking it: it strikes back once, but does not ALSO take its aggressive turn
  const fight = step(world, state, actionByLabel(world, state, "attack wolf with bare hands")!);
  assert.equal(fight.state.hp, 6);
  assert.equal(fight.events.filter((e) => /wolf (attacks|strikes back)/.test(e)).length, 1);
  state = fight.state;
  // leaving costs nothing more
  const flee = step(world, state, { kind: "go", dir: "west" });
  assert.equal(flee.state.hp, 6);
  assert.doesNotMatch(flee.events.join(" "), /wolf/);
  // rendered as hostile, with hp, even without the display-only `hostile` flag
  assert.match(render(world, enter.state, []).text, /wolf \(hostile, hp100\/100\)/);
});

test("an aggressive npc can kill: the dead ending is the engine's, as always", () => {
  const world = mini({
    npcs: { wolf: { name: "wolf", room: "b", aggressive: true, hp: 100, atk: 20, df: 30 } },
  });
  const { state } = newState(world, 1);
  const out = step(world, state, { kind: "go", dir: "east" });
  assert.equal(out.state.ended?.id, "dead");
});

// ---------- chance ----------
test("chance is deterministic per seed and honors its edges", () => {
  const world = mini({
    rooms: {
      a: {
        name: "A",
        desc: "A.",
        actions: [
          { id: "sure", label: "sure thing", fx: [["chance", 100, [["set", "won"]], [["set", "lost"]]]] },
          { id: "never", label: "no chance", fx: [["chance", 0, [["set", "won"]], [["set", "lost"]]]] },
          { id: "coin", label: "coin", fx: [["chance", 50, [["say", "heads"]], [["say", "tails"]]]] },
        ],
      },
    },
  });
  let { state } = newState(world, 1);
  assert.ok(step(world, state, { kind: "custom", room: "a", id: "sure" }).state.flags["won"]);
  assert.ok(step(world, state, { kind: "custom", room: "a", id: "never" }).state.flags["lost"]);
  const a = step(world, state, { kind: "custom", room: "a", id: "coin" });
  const b = step(world, state, { kind: "custom", room: "a", id: "coin" });
  assert.deepEqual(a.events, b.events, "same state, same roll");
  assert.notEqual(a.state.rngA, state.rngA, "the cursor advanced");
  // across many seeds a 50% chance lands both ways
  const seen = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) {
    const s = newState(world, seed).state;
    seen.add(step(world, s, { kind: "custom", room: "a", id: "coin" }).events[0]!);
  }
  assert.deepEqual([...seen].sort(), ["heads", "tails"]);
});

// ---------- validator ----------
test("validator: party needs a companion npc, chance stays in 0..100, aggressive needs teeth, dialogue needs topics", () => {
  const world = mini({
    npcs: {
      mute: { name: "mute", room: "a", dialogue: true },
      soft: { name: "soft", room: "a", aggressive: true, hp: 3 },
      plain: { name: "plain", room: "a" },
    },
    rooms: {
      a: {
        name: "A",
        desc: "A.",
        actions: [
          { id: "x", label: "x", fx: [["party", "plain", "join"], ["party", "ghost", "join"], ["chance", 150, [], []]] },
          { id: "win", label: "win", fx: [["score", 10], ["end", "win", "done", "Done."]] },
        ],
      },
    },
    walkthrough: ["win"],
  });
  const errs = validateWorld(world);
  assert.ok(errs.some((e) => e.includes("npc plain has no companion block")), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("unknown npc ghost")), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("chance must be 0..100")), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("npc soft: aggressive needs both hp and atk")), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("npc mute: dialogue set but no topics")), errs.join("\n"));
});

test("the perk and class menus still take precedence over an open conversation", () => {
  const world = mini({
    classes: { sage: { name: "Sage", desc: "wise" } },
    perks: { tough: { name: "Tough", desc: "+3 max hp", bonus: { maxhp: 3 } } },
    npcs: {
      elder: {
        name: "elder",
        room: "a",
        dialogue: true,
        topics: [
          { id: "teach", label: "teach me", say: "Listen.", fx: [["xp", 10]] },
          { id: "more", label: "more", say: "Later." },
        ],
      },
    },
  });
  let { state } = newState(world, 1);
  assert.ok(legalActions(world, state).every((a: Action) => a.kind === "classpick"));
  state = doLabel(world, state, "be a Sage — wise");
  state = doLabel(world, state, "talk to elder");
  state = doLabel(world, state, "teach me");
  assert.ok(legalActions(world, state).every((a: Action) => a.kind === "perkpick"), "level-up interrupts the talk");
  state = doLabel(world, state, "perk: Tough (+3 max hp)");
  assert.ok(inTalkMode(world, state), "and the conversation resumes afterwards");
});
