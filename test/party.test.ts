/**
 * The depth layer: conversation mode, companions, aggressive enemies, and the
 * chance effect. Small in-memory worlds so each rule is tested alone.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { actionByLabel, actionLabel, inTalkMode, legalActions, newState, step } from "../src/engine.ts";
import { render, renderMenu, renderStatus } from "../src/format.ts";
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
  // the farewell topic is the way out, so no separate "end conversation" appears
  assert.deepEqual(labels(world, state), ["greet", "the vale", "take your leave"]);
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

  // an npc without a farewell topic gets the plain "end conversation"
  const plain = mini({ npcs: { guard: { name: "guard", room: "a", dialogue: true, topics: [{ id: "pass", label: "the gate", say: "Closed." }] } } });
  let g = doLabel(plain, newState(plain, 1).state, "talk to guard");
  assert.deepEqual(labels(plain, g), ["the gate", "end conversation"]);
  g = doLabel(plain, g, "end conversation");
  assert.equal(g.talking, null);

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
  world.walkthrough = ["talk to elder", "greet", "take your leave", "win"];
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

test("in a conversation, a line that sends a companion away is listed last, never where the talk was carried on", () => {
  const world = mini({
    npcs: {
      lys: {
        name: "Lys",
        room: "a",
        hp: 6,
        dialogue: true,
        companion: {},
        topics: [
          { id: "dismiss", label: "wait here (leaves the party for now)", if: [["inParty", "lys"]], say: "I'll be here.", fx: [["party", "lys", "leave"]] },
          { id: "join", label: "come with me", if: [["!inParty", "lys"]], say: "Fine.", fx: [["party", "lys", "join"]], once: true },
          { id: "trees", label: "the trees", say: "Old, and older under that." },
        ],
      },
    },
  });
  let { state } = newState(world, 1);
  state = doLabel(world, state, labels(world, state).find((l) => /talk/.test(l) && /Lys/.test(l))!);
  state = doLabel(world, state, "come with me");
  assert.deepEqual(state.party, ["lys"]);
  assert.ok(inTalkMode(world, state), "the conversation stays open after she joins");
  const menu = labels(world, state);
  assert.equal(menu[0], "the trees", "the talk carries on from the top slot");
  assert.equal(menu.indexOf("wait here (leaves the party for now)"), menu.length - 2, "sending her away sits last, just before the way out");
});

test("a free room action costs no turn and says so; a scripted end reads 'at rest', not 'dead'; the score ceiling lives in status", () => {
  const world = mini({
    items: { sword: { name: "sword", loc: "inv", hit: 0, dmg: 2 }, coat: { name: "tarred coat", loc: "inv", armor: 2 }, mail: { name: "mail shirt", loc: "inv", armor: 1 } },
    npcs: { saint: { name: "St. Mara", room: "a", hp: 3, desc: "A figure at the altar." } },
  });
  world.rooms["a"]!.actions = [
    { id: "bear", label: "get your bearings", free: true, fx: [["say", "Hills to the north."]] },
    { id: "plaque", label: "read the vigil-plaque", fx: [["slay", "saint"]] },
  ];
  let { state } = newState(world, 1);
  const header = render(world, state, []).text.split("\n")[0]!;
  assert.match(header, /score0 t0/, "the turn header shows the tally without a ceiling");
  assert.doesNotMatch(header, /score0\//);
  assert.match(renderStatus(world, state), /Score: 0\/\d+ \(a bonus tally/, "status names the ceiling and what the score is");
  assert.ok(labels(world, state).includes("attack St. Mara with sword"));
  const menu = renderMenu(world, state).text;
  assert.match(menu, /get your bearings \(free\)/);
  const out = step(world, state, actionByLabel(world, state, "get your bearings")!);
  assert.equal(out.state.turn, state.turn, "bearings cost no turn");
  assert.match(out.events.join(" "), /Hills to the north/);
  state = out.state;
  state = doLabel(world, state, "read the vigil-plaque");
  assert.match(render(world, state, []).text, /St\. Mara \(at rest\)/);
  assert.doesNotMatch(render(world, state, []).text, /\(dead\)/);
  assert.ok(!labels(world, state).includes("attack St. Mara with sword"), "the laid to rest are not targets");
  if (world.classes) assert.match(renderStatus(world, state), /armor\+2 \(tarred coat\)/);
});

test("attacking someone who has drawn no blade is the last thing on the menu; a hostile is listed in place", () => {
  const world = mini({
    items: { sword: { name: "sword", loc: "inv", hit: 0, dmg: 2 }, bread: { name: "bread", loc: "inv", use: [{ fx: [["hp", 1]] }] } },
    npcs: {
      novice: { name: "novice", room: "a", hp: 4, topics: [{ id: "hi", label: "the chapel", say: "Swept." }] },
      wolf: { name: "wolf", room: "a", hostile: true, hp: 5, atk: 2, df: 8 },
    },
  });
  const { state } = newState(world, 1);
  const menu = labels(world, state);
  assert.equal(menu[menu.length - 1], "attack novice with sword");
  assert.ok(menu.indexOf("attack wolf with sword") < menu.indexOf("use bread"), "the hostile stays where the room lists it");
  assert.ok(menu.indexOf("ask novice: the chapel") < menu.indexOf("attack novice with sword"));
});

test("a piercing npc's strike ignores armor and says so; the room line warns of it", () => {
  const world = mini({
    items: { sword: { name: "sword", loc: "inv", hit: 0, dmg: 2 }, mail: { name: "mail shirt", loc: "inv", armor: 2 } },
    npcs: {
      wight: { name: "barrow-wight", room: "a", aggressive: true, pierce: true, hp: 50, atk: 3, df: 30 },
      boar: { name: "boar", room: "b", aggressive: true, hp: 50, atk: 3, df: 30 },
    },
  });
  let { state } = newState(world, 1);
  assert.match(render(world, state, []).text, /barrow-wight \(hostile, attacks on sight, hp50\/50, armor useless\)/);
  const hp = state.hp;
  const out = step(world, state, actionByLabel(world, state, "attack barrow-wight with sword")!);
  assert.equal(hp - out.state.hp, 3, "all three points land through the mail");
  assert.match(out.events.join(" "), /armor means nothing to it/);
  state = doLabel(world, { ...state }, "go east");
  const hp2 = state.hp;
  const out2 = step(world, state, actionByLabel(world, state, "attack boar with sword")!);
  assert.equal(hp2 - out2.state.hp, 1, "the boar's three is soaked to one by the mail");
  assert.match(out2.events.join(" "), /your armor takes 2 of it/);
});

test("a hostile who will still talk says so; a room that holds an ending warns once on entry", () => {
  const world = mini({
    items: { sword: { name: "sword", loc: "inv", hit: 0, dmg: 2 } },
    npcs: {
      toll: { name: "toll-man", room: "a", hostile: true, hp: 6, atk: 2, df: 9, topics: [{ id: "pay", label: "pay the toll", say: "Go on, then." }] },
      wolf: { name: "wolf", room: "a", hostile: true, hp: 5, atk: 2, df: 8 },
    },
  });
  world.rooms["b"]!.actions = [{ id: "kneel", label: "kneel to the seat", fx: [["end", "lose", "knelt", "You kneel."]] }];
  let { state } = newState(world, 1);
  const scene = render(world, state, []).text;
  assert.match(scene, /toll-man \(hostile, holds its ground, hp6\/6, will hear you out\)/);
  assert.match(scene, /wolf \(hostile, holds its ground, hp5\/5\)/);
  const out = step(world, state, actionByLabel(world, state, "go east")!);
  assert.match(out.events.join(" "), /An ending waits in this room/);
  state = doLabel(world, out.state, "go west");
  const back = step(world, state, actionByLabel(world, state, "go east")!);
  assert.doesNotMatch(back.events.join(" "), /An ending waits/, "the warning is given once per room");
});

test("taking an owned thing under its owner's eyes is seen and counted; coin moves are tagged; status names regard and, after the end, what was left undone", () => {
  const world = mini({
    items: {
      purse: { name: "purse", loc: "a", takeable: true, owner: "keeper" },
      rope: { name: "rope", loc: "b", takeable: true, owner: "keeper" },
    },
    npcs: {
      keeper: { name: "shopkeeper", room: "a", topics: [{ id: "buy", label: "buy nothing", say: "Suit yourself.", fx: [["addvar", "gold", 3]] }] },
      lys: { name: "Lys", room: "a", hp: 6, companion: {}, topics: [{ id: "join", label: "come with me", say: "Fine.", fx: [["party", "lys", "join"], ["addvar", "appr_lys", 2]], once: true }] },
    },
  });
  world.rooms["b"]!.actions = [{ id: "kneel", label: "kneel to the seat", fx: [["end", "lose", "knelt", "You kneel."]] }];
  let { state } = newState(world, 1);
  assert.match(renderMenu(world, state).text, /take purse \(shopkeeper is watching: taking it is theft\)/);
  const out = step(world, state, actionByLabel(world, state, "take purse")!);
  assert.match(out.events.join(" "), /The shopkeeper sees you take it\./);
  assert.equal(out.state.flags["stole_purse"], true);
  assert.equal(out.state.vars["thefts"], 1);
  state = out.state;
  const paid = step(world, state, actionByLabel(world, state, "ask shopkeeper: buy nothing")!);
  assert.match(paid.events.join(" "), /\(\+3 gold\)/);
  state = doLabel(world, paid.state, "ask Lys: come with me");
  assert.match(renderStatus(world, state), /Party: Lys \(regard \+2, hp 6\/6\)/);
  state = doLabel(world, state, "go east");
  assert.doesNotMatch(renderMenu(world, state).text, /is watching/, "the owner is a room away");
  const took = step(world, state, actionByLabel(world, state, "take rope")!);
  assert.equal(took.state.vars["thefts"], 1, "unseen, it is nobody's business");
  state = doLabel(world, took.state, "kneel to the seat");
  assert.ok(state.ended);
  assert.match(renderStatus(world, state), /The tale is told\./);
});

test("a remark gated on npcHere fires only while that npc stands alive in the room", () => {
  const world = mini({
    items: { sword: { name: "sword", loc: "inv", hit: 0, dmg: 5 } },
    npcs: {
      lys: { name: "Lys", room: "a", hp: 6, companion: { remarks: [{ id: "wolf", if: [["npcHere", "wolf"], ["!npcDead", "wolf"]], say: "Leave it." }] }, topics: [{ id: "join", label: "come with me", say: "Fine.", fx: [["party", "lys", "join"]], once: true }] },
      wolf: { name: "wolf", room: "b", hostile: true, hp: 1, atk: 1, df: 1 },
    },
  });
  let { state } = newState(world, 1);
  const joined = step(world, state, actionByLabel(world, state, "ask Lys: come with me")!);
  assert.doesNotMatch(joined.events.join(" "), /Leave it/, "the wolf is a room away");
  const east = step(world, joined.state, actionByLabel(world, joined.state, "go east")!);
  assert.match(east.events.join(" "), /Lys: "Leave it\."/, "she speaks the turn the wolf is in front of you");
});

test("the menu says when an action settles a hold's grief or a miss costs standing; regard moved out of sight is still told", () => {
  const world = mini({
    npcs: {
      lys: { name: "Lys", room: "b", hp: 6, companion: {} },
    },
  });
  world.rooms["a"]!.actions = [
    { id: "rite", label: "speak the rite", fx: [["set", "x_rested"], ["addvar", "hollows_rested", 1]] },
    { id: "press", label: "press the prior (will)", fx: [["check", "will", 10, [["say", "He yields."]], [["if", [["!flag", "press_missed"]], [["set", "press_missed"], ["addvar", "rep_church", -1], ["say", "He hears the lie."]], [["say", "No."]]]]]] },
    { id: "snub", label: "snub the hunter", fx: [["addvar", "appr_lys", -1]] },
  ];
  const { state } = newState(world, 1);
  const menu = renderMenu(world, state).text;
  assert.match(menu, /speak the rite \(settles this hold's grief\)/);
  assert.match(menu, /press the prior \(will\) \(DC 10, will: roll 10\+ on the die; a miss costs standing\)/);
  const out = step(world, state, actionByLabel(world, state, "snub the hunter")!);
  assert.match(out.events.join(" "), /\(Lys -1, when word reaches them\)/, "she is a room away, and still the move is told");
});

test("blows rotate onto standing companions; one struck to nothing falls back, sits out the fight, and gets up after it", () => {
  const world = company();
  world.npcs["lys"]!.hp = 4;
  let { state } = newState(world, 1);
  state = doLabel(world, state, "ask Lys: come with me");
  state = doLabel(world, state, "go east");
  const hp0 = state.hp;
  let out = step(world, state, actionByLabel(world, state, "attack troll with sword")!);
  assert.equal(hp0 - out.state.hp, 3, "the first blow lands on the player");
  out = step(world, out.state, actionByLabel(world, out.state, "attack troll with sword")!);
  assert.match(out.events.join(" "), /The troll strikes back at Lys \(-3hp\) — Lys staggers, 1\/4 left\./);
  assert.equal(out.state.npcHp["lys"], 1);
  out = step(world, out.state, actionByLabel(world, out.state, "attack troll with sword")!); // the player again
  out = step(world, out.state, actionByLabel(world, out.state, "attack troll with sword")!);
  assert.match(out.events.join(" "), /Lys goes down, and crawls clear of the fight/);
  assert.equal(out.state.flags["down_lys"], true);
  assert.equal(out.state.flags["fell_lys"], true, "the fall is remembered after she is back up");
  assert.match(renderStatus(world, out.state), /Party: Lys \(regard 0, hp 1\/4, down\)/);
  const idle = step(world, out.state, actionByLabel(world, out.state, "attack troll with sword")!);
  assert.doesNotMatch(idle.events.join(" "), /Lys (hits|misses)/, "a downed companion takes no part");
  const back = step(world, idle.state, actionByLabel(world, idle.state, "go west")!);
  assert.match(back.events.join(" "), /Lys is back on their feet, shaken\./);
  assert.equal(back.state.npcHp["lys"], 2, "up again at half strength");
  assert.ok(!back.state.flags["down_lys"]);
});

test("a remark can carry effects: a companion who speaks their mind can also think less of you", () => {
  const world = mini({
    items: { purse: { name: "purse", loc: "a", takeable: true, owner: "keeper" } },
    npcs: {
      keeper: { name: "shopkeeper", room: "a" },
      lys: { name: "Lys", room: "a", hp: 6, companion: { remarks: [{ id: "theft", if: [["var", "thefts", ">=", 1]], say: "That's a habit.", fx: [["addvar", "appr_lys", -1]] }] }, topics: [{ id: "join", label: "come with me", say: "Fine.", fx: [["party", "lys", "join"]], once: true }] },
    },
  });
  let { state } = newState(world, 1);
  state = doLabel(world, state, "ask Lys: come with me");
  const out = step(world, state, actionByLabel(world, state, "take purse")!);
  assert.match(out.events.join(" "), /Lys: "That's a habit\." Lys disapproves\./);
  assert.equal(out.state.vars["appr_lys"], -1);
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
  assert.match(render(world, enter.state, []).text, /wolf \(hostile, attacks on sight, hp100\/100\)/);
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

test("a companion with a matching `leaves` entry walks out after the turn, sets <npc>_left, and stops following", () => {
  const world = company();
  world.npcs["lys"]!.companion!.leaves = [{ if: [["var", "appr_lys", "<=", -2]], say: "I've seen enough of you." }];
  world.rooms["a"]!.actions = [{ id: "kick", label: "kick a dog", fx: [["addvar", "appr_lys", -1]] }];
  let { state } = newState(world, 1);
  state = doLabel(world, state, "ask Lys: come with me");
  state = doLabel(world, state, "kick a dog");
  assert.deepEqual(state.party, ["lys"], "one strike is not enough");
  const out = step(world, state, actionByLabel(world, state, "kick a dog")!);
  assert.match(out.events.join(" "), /Lys: "I've seen enough of you\." Lys leaves your company\./);
  assert.deepEqual(out.state.party, []);
  assert.ok(out.state.flags["lys_left"]);
  const moved = doLabel(world, out.state, "go east");
  assert.equal(moved.npcRoom["lys"], "a", "she stays where she quit");
});

test("combat text does not double an article an npc name already carries", () => {
  const world = mini({
    npcs: { wyrm: { name: "the Wyrm", room: "a", hostile: true, hp: 100, atk: 1, df: 1 }, husk: { name: "gray husk", room: "a", hostile: true, hp: 100, atk: 1, df: 1 } },
  });
  const { state } = newState(world, 1);
  const a = step(world, state, { kind: "attack", npc: "wyrm" }).events.join(" ");
  assert.match(a, /You hit the Wyrm/);
  assert.doesNotMatch(a, /the the/);
  assert.match(a, /The Wyrm strikes back/);
  const b = step(world, state, { kind: "attack", npc: "husk" }).events.join(" ");
  assert.match(b, /You hit the gray husk/);
  assert.match(b, /The gray husk strikes back/);
});

test("a proper name (authored with a capital) takes no article in combat text", () => {
  const named = mini({ npcs: { lys: { name: "Lys", room: "a", hp: 100, atk: 1, df: 1 } } });
  const c = step(named, newState(named, 1).state, { kind: "attack", npc: "lys" }).events.join(" ");
  assert.match(c, /You hit Lys /);
  assert.match(c, /Lys strikes back/);
  assert.doesNotMatch(c, /the Lys/);
});

test("an npc's desc shows on the full view and not on the brief one", () => {
  const world = mini({ npcs: { reeve: { name: "reeve", room: "a", desc: "Gray at the temples." } } });
  const { state } = newState(world, 1);
  assert.match(render(world, state, [], { full: true }).text, /reeve is here — Gray at the temples\./);
  assert.match(render(world, state, []).text, /reeve is here$/m);
  assert.doesNotMatch(render(world, state, []).text, /Gray at the temples/);
});

test("approval and named-faction changes print the turn they happen — companions only when at hand", () => {
  const world = company();
  world.factions = { rep_watch: "the Watch" };
  world.rooms["a"]!.actions = [
    { id: "kind", label: "be kind", fx: [["addvar", "appr_lys", 1], ["addvar", "rep_watch", -2]] },
    { id: "cruel", label: "be cruel", fx: [["addvar", "appr_lys", -2]] },
  ];
  let { state } = newState(world, 1);
  // Lys stands in the room: her reaction shows even before she joins
  let out = step(world, state, actionByLabel(world, state, "be kind")!);
  assert.match(out.events.join(" "), /Lys approves\./);
  assert.match(out.events.join(" "), /\(the Watch -2\)/);
  out = step(world, out.state, actionByLabel(world, out.state, "be cruel")!);
  assert.match(out.events.join(" "), /Lys strongly disapproves\./);
  // far away and not in the party: silent
  state = out.state;
  state = doLabel(world, state, "go east");
  const far = step(world, state, { kind: "go", dir: "west" });
  assert.doesNotMatch(far.events.join(" "), /Lys/);
  state.npcRoom["lys"] = "b";
  const away = step(world, { ...state, room: "a" }, actionByLabel(world, { ...state, room: "a" }, "be kind")!);
  assert.doesNotMatch(away.events.join(" "), /Lys approves/);
  assert.match(away.events.join(" "), /\(the Watch -2\)/, "a faction's standing always prints");
});

// ---------- the company list ----------
const companions = (n: number): World["npcs"] => {
  const names = ["Lys", "Osk", "Tamsin", "Vell"].slice(0, n);
  return Object.fromEntries(
    names.map((name) => [
      name.toLowerCase(),
      {
        name,
        room: "a",
        dialogue: true,
        hp: 8,
        companion: { hit: 1, dmg: 1 },
        topics: [
          { id: "how", label: "how are you holding up", say: "Well enough." },
          { id: "bye", label: "walk on", say: "After you.", end: true },
        ],
      },
    ]),
  );
};

test("two or more companions fold into one 'speak with the company' entry that opens a free list of them", () => {
  const world = mini({
    npcs: { ...companions(3), elder: { name: "elder", room: "a", dialogue: true, topics: [{ id: "hi", label: "greet", say: "Hm." }] } },
  });
  let { state } = newState(world, 1);
  state.party = ["lys", "osk", "tamsin"];
  const menu = labels(world, state);
  assert.equal(menu.filter((l) => l === "speak with the company").length, 1, menu.join(" | "));
  assert.ok(!menu.some((l) => /^talk to (Lys|Osk|Tamsin)$/.test(l)), "companions' own entries are folded");
  assert.ok(menu.includes("talk to elder"), "a local npc keeps their own entry");
  const hinted = renderMenu(world, state).text;
  assert.match(hinted, /speak with the company \(Lys, Osk, Tamsin\)/);
  const turn = state.turn;
  state = doLabel(world, state, "speak with the company");
  assert.equal(state.turn, turn, "browsing the company costs no turn");
  assert.deepEqual(labels(world, state), ["talk to Lys", "talk to Osk", "talk to Tamsin", "back"]);
  assert.match(render(world, state, []).text, /Your company:/);
  const back = doLabel(world, state, "back");
  assert.equal(back.turn, turn);
  assert.ok(labels(world, back).includes("speak with the company"), "back returns to the room");
  state = doLabel(world, state, "talk to Osk");
  assert.ok(inTalkMode(world, state));
  assert.equal(state.companyMenu, false, "a conversation replaces the list");
  state = doLabel(world, state, "walk on");
  assert.ok(!inTalkMode(world, state));
  assert.ok(labels(world, state).includes("speak with the company"), "ending the talk returns to the room menu");
});

test("one companion keeps their own 'talk to' entry, so single-companion walkthroughs replay unchanged", () => {
  const world = mini({ npcs: companions(2) });
  const { state } = newState(world, 1);
  state.party = ["lys"];
  const menu = labels(world, state);
  assert.ok(menu.includes("talk to Lys"), menu.join(" | "));
  assert.ok(!menu.includes("speak with the company"));
  // a companion who has walked ahead is not in the list
  const both = newState(world, 1).state;
  both.party = ["lys", "osk"];
  both.npcRoom["osk"] = "b";
  assert.ok(labels(world, both).includes("talk to Lys") && !labels(world, both).includes("speak with the company"));
});

// ---------- the company rests ----------
test("a room action that heals — a rest — heals the companions standing here too; an item heals only the player", () => {
  const world = mini({
    rooms: {
      a: { name: "A", desc: "Room A.", exits: { east: { to: "b" } }, actions: [{ id: "rest", label: "rest by the fire", fx: [["hp", 5], ["say", "Warm."]] }] },
      b: { name: "B", desc: "Room B.", exits: { west: { to: "a" } } },
    },
    items: { herbs: { name: "herbs", loc: "inv", use: [{ fx: [["hp", 3], ["move", "herbs", "nowhere"]] }] } },
    npcs: {
      ...companions(2),
    },
  });
  let { state } = newState(world, 1);
  state.party = ["lys", "osk"];
  state.hp = 4;
  state.npcHp["lys"] = 3;
  state.npcHp["osk"] = 8; // already whole
  state.npcRoom["osk"] = "b"; // walked ahead: not here, not healed
  state.npcHp["osk"] = 2;
  let out = step(world, state, actionByLabel(world, state, "rest by the fire")!);
  state = out.state;
  assert.equal(state.hp, 9);
  assert.equal(state.npcHp["lys"], 8, "Lys heals with the player, capped at her full hp");
  assert.equal(state.npcHp["osk"], 2, "a companion elsewhere is not healed");
  assert.ok(out.events.some((e) => /\(Lys hp\+5, 8\/8\)/.test(e)), out.events.join(" | "));
  state.hp = 4;
  state.npcHp["lys"] = 3;
  out = step(world, state, actionByLabel(world, state, "use herbs")!);
  assert.equal(out.state.hp, 7);
  assert.equal(out.state.npcHp["lys"], 3, "an item's use heals only whoever takes it");
});

// ---------- armor-piercing foes announce themselves once ----------
test("the first time something that strikes through armor stands in the room, the game says so once", () => {
  const world = mini({
    npcs: { wight: { name: "barrow-wight", room: "b", hp: 6, atk: 3, hostile: true, pierce: true } },
  });
  let { state } = newState(world, 1);
  let out = step(world, state, actionByLabel(world, state, "go east")!);
  assert.ok(out.events.some((e) => /strikes through armor/.test(e)), out.events.join(" | "));
  state = out.state;
  out = step(world, state, actionByLabel(world, state, "go west")!);
  out = step(world, out.state, actionByLabel(world, out.state, "go east")!);
  assert.ok(!out.events.some((e) => /strikes through armor/.test(e)), "said once");
});

// ---------- long conversations turn pages ----------
test("a conversation that runs past the menu cap turns pages: 'more to ask' is free, the farewell stays on every page", () => {
  const topics = Array.from({ length: 15 }, (_, i) => ({ id: `t${i}`, label: `topic ${i}`, say: `Answer ${i}.` }));
  const world = mini({ npcs: { sage: { name: "sage", room: "a", dialogue: true, topics: [...topics, { id: "bye", label: "take your leave", say: "Go.", end: true }] } } });
  let { state } = newState(world, 1);
  state = doLabel(world, state, "talk to sage");
  let menu = labels(world, state);
  assert.equal(menu.length, 12, menu.join(" | "));
  assert.equal(menu[10], "more to ask");
  assert.equal(menu[11], "take your leave");
  assert.match(renderMenu(world, state).text, /more to ask \(5 more\)/);
  const turn = state.turn;
  state = doLabel(world, state, "more to ask");
  assert.equal(state.turn, turn, "turning the page costs no turn");
  menu = labels(world, state);
  assert.deepEqual(menu, ["topic 10", "topic 11", "topic 12", "topic 13", "topic 14", "more to ask", "take your leave"]);
  state = doLabel(world, state, "more to ask");
  assert.equal(labels(world, state)[0], "topic 0", "the pages wrap");
  // a short conversation never pages
  const small = mini({ npcs: { sage: { name: "sage", room: "a", dialogue: true, topics: topics.slice(0, 11) } } });
  let { state: s2 } = newState(small, 1);
  s2 = doLabel(small, s2, "talk to sage");
  assert.ok(!labels(small, s2).includes("more to ask"));
  assert.equal(labels(small, s2).length, 12);
});
