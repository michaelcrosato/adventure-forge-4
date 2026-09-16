/**
 * A room with more to do than the menu holds.
 *
 * MENU_CAP is 12 — the most options a screen may offer, so a turn stays a
 * choice rather than a search. A long conversation and a long travel list have
 * always turned pages against it; a room never did. It dropped whatever came
 * last instead, which was always the class abilities, silently: a Warden could
 * stand in a crowded room with a full pool and simply not be offered the thing
 * they had earned, with nothing on the screen to say so.
 *
 * Rooms turn pages now. The exits stay on every one of them.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { actionByLabel, actionByNumber, actionLabel, allActions, legalActions, menuLoad, menuNumbers, newState, step } from "../src/engine.ts";
import { render } from "../src/format.ts";
import { MENU_CAP } from "../src/types.ts";
import type { Action, State, World } from "../src/types.ts";

/** A room with `n` things to do in it, two ways out, and a second room to walk to. */
const crowded = (n: number): World =>
  ({
    id: "crowd",
    title: "crowd",
    intro: "A room with too much in it.",
    start: "hall",
    hp: 10,
    maxScore: 1,
    rooms: {
      hall: {
        name: "The Hall",
        desc: "Too much to do.",
        exits: { north: { to: "yard" }, south: { to: "yard" } },
        actions: Array.from({ length: n }, (_, i) => ({ id: `a${i}`, label: `thing ${i}`, fx: [["say", `thing ${i}`]] })),
      },
      yard: { name: "The Yard", desc: "Quiet.", exits: { north: { to: "hall" } } },
    },
    items: {},
    npcs: {},
    walkthrough: [],
  }) as unknown as World;

const labels = (w: World, s: State): string[] => legalActions(w, s).map((a) => actionLabel(w, a, s));
const pick = (w: World, s: State, label: string): Action => {
  const a = legalActions(w, s).find((x) => actionLabel(w, x, s) === label);
  assert.ok(a, `"${label}" should be on the menu, saw: ${labels(w, s).join(" | ")}`);
  return a;
};

test("a room within the cap does not page", () => {
  const world = crowded(5);
  const { state } = newState(world, 1);
  const menu = labels(world, state);
  assert.equal(menu.length, 7, "two exits and five things");
  assert.ok(!menu.includes("more in this room"), "nothing is hidden, so nothing offers to show it");
});

test("a crowded room turns pages, and never hides the way out", () => {
  const world = crowded(30);
  const { state } = newState(world, 1);
  let s = state;
  const seen = new Set<string>();
  for (let page = 0; page < 4; page++) {
    const menu = labels(world, s);
    assert.ok(menu.length <= MENU_CAP, `page ${page} stays within the cap, saw ${menu.length}`);
    assert.ok(menu.includes("go north") && menu.includes("go south"), `page ${page} still shows both ways out`);
    assert.equal(menu[menu.length - 1], "more in this room", `page ${page} ends with the way to the next`);
    for (const l of menu) if (l.startsWith("thing ")) seen.add(l);
    s = step(world, s, pick(world, s, "more in this room")).state;
  }
  assert.equal(seen.size, 30, `every one of the room's thirty things is reachable, saw ${seen.size}`);
  // and the pages that are not the last one are full: paging does not waste the screen
  const { state: fresh } = newState(world, 1);
  assert.equal(labels(world, fresh).length, MENU_CAP, "the first page fills the menu");
});

test("turning a page is free — it is browsing, not a turn", () => {
  const world = crowded(30);
  const { state } = newState(world, 1);
  const after = step(world, state, pick(world, state, "more in this room")).state;
  assert.equal(after.turn, state.turn, "no time passes looking at the rest of a room");
});

test("the pages wrap, so a player can never be stranded past the end", () => {
  const world = crowded(30);
  const { state } = newState(world, 1);
  const first = labels(world, state);
  let s = state;
  for (let i = 0; i < 4; i++) s = step(world, s, pick(world, s, "more in this room")).state;
  assert.deepEqual(labels(world, s), first, "four pages of thirty things comes back to the first");
});

test("walking into a room opens it on its first page", () => {
  const world = crowded(30);
  const { state } = newState(world, 1);
  let s = step(world, state, pick(world, state, "more in this room")).state;
  assert.equal(s.roomPage, 1);
  s = step(world, s, pick(world, s, "go north")).state; // to the yard
  s = step(world, s, pick(world, s, "go north")).state; // and back
  assert.equal(s.roomPage, 0, "the hall opens where it opened the first time");
  assert.ok(labels(world, s).includes("thing 0"), "on its first page");
});

test("the screen says which page it is showing, and how much of the room is waiting", () => {
  const world = crowded(30);
  const { state } = newState(world, 1);
  const menu = legalActions(world, state);
  assert.equal(menu.filter((a) => a.kind === "custom").length, MENU_CAP - 3, "two exits, one way to the next page, the rest of the page is the room");
  assert.match(actionLabel(world, pick(world, state, "more in this room"), state), /more in this room/);
  // the header carries the page, so a number remembered from the page before is
  // visibly stale — a playtester picked one and walked out of the Barrow Crypt
  const header = (st: State) => render(world, st, []).text.split("\n")[0]!;
  assert.match(header(state), / p1\/4\b/, header(state));
  const turned = step(world, state, pick(world, state, "more in this room")).state;
  assert.match(header(turned), / p2\/4\b/, header(turned));
  // a room within the cap says nothing about pages
  const small = crowded(5);
  assert.doesNotMatch(render(small, newState(small, 1).state, []).text.split("\n")[0]!, / p\d+\/\d+/);
});

/**
 * The defect paging was built for. A room full to the cap used to drop the
 * class abilities off the end of the menu, silently — a Warden could stand in a
 * crowded room with a full pool and simply not be offered `brace for it`, with
 * nothing on the screen to say an option existed. Three rooms in the Reach sat
 * one over the cap this way, and the crawler could not see them either: it was
 * counting the menu the engine had already trimmed.
 */
const withAbilities = (n: number): World =>
  ({
    id: "abil",
    title: "abil",
    intro: "A crowded room and a thing you have earned.",
    start: "hall",
    hp: 10,
    maxScore: 1,
    resources: { pool: 2 },
    abilities: {
      shout: { label: "shout them down", if: [["var", "pool", ">=", 1]], fx: [["addvar", "pool", -1], ["say", "They flinch."]] },
    },
    rooms: {
      hall: {
        name: "The Hall",
        desc: "Too much to do.",
        exits: { north: { to: "yard" } },
        actions: Array.from({ length: n }, (_, i) => ({ id: `a${i}`, label: `thing ${i}`, fx: [["say", `thing ${i}`]] })),
      },
      yard: { name: "The Yard", desc: "Quiet.", exits: { north: { to: "hall" } } },
    },
    items: {},
    npcs: {},
    walkthrough: [],
  }) as unknown as World;

test("an ability is never dropped off the end of a crowded room's menu", () => {
  const world = withAbilities(12); // the room's own content, full to the cap
  const { state } = newState(world, 1);
  let s = state;
  const seen = new Set(labels(world, s));
  let turns = 0;
  while (!seen.has("shout them down") && turns < 6) {
    s = step(world, s, pick(world, s, "more in this room")).state;
    for (const l of labels(world, s)) seen.add(l);
    turns++;
  }
  assert.ok(seen.has("shout them down"), `the ability is reachable, saw: ${[...seen].join(" | ")}`);
  assert.ok(turns > 0, "and it took a page turn to get to it — the room really was full");
});

test("the cap holds the room's own content, and does not tax it for the abilities", () => {
  // the author answers for what they wrote; a class's abilities ride on top of
  // every room in the realm and are what paging is for
  const world = withAbilities(12);
  const { state } = newState(world, 1);
  assert.equal(menuLoad(world, state), 13, "one exit and twelve things — abilities not counted");
  assert.equal(allActions(world, state).filter((a) => a.kind === "ability").length, 1, "the ability is legal all the same");
});

/**
 * A number means one thing per room.
 *
 * Two blind players in one wave took actions they had not meant to. "'use
 * dried herbs' silently consumed the item on a page where I meant to pick a
 * different numbered option." "'use a sealed letter' occupied the same
 * numbered slot a movement option had held on a previous page." Numbering each
 * page from 1 meant a number stood for two things in one room, and a player
 * who had just pressed 7 pressed 7 again.
 */
test("an option keeps its number on whatever page it is showing", () => {
  const world = crowded(24);
  const numbered = (s: State) => {
    const acts = legalActions(world, s), nums = menuNumbers(world, s);
    return new Map(acts.map((a, i) => [actionLabel(world, a, s), nums[i]!]));
  };
  let s = newState(world, 1).state;
  const pages = [numbered(s)];
  for (let p = 0; p < 2; p++) {
    s = step(world, s, pick(world, s, "more in this room")).state;
    pages.push(numbered(s));
  }
  // the ways out keep 1 and 2 wherever you are: they are first in the whole list too
  for (const [i, page] of pages.entries()) {
    assert.equal(page.get("go north"), 1, `page ${i + 1}`);
    assert.equal(page.get("go south"), 2, `page ${i + 1}`);
    assert.equal(page.get("more in this room"), 27, `page ${i + 1}: the way on is one past everything`);
  }
  // and no label ever carries two different numbers, nor two labels one number
  const seen = new Map<string, number>();
  for (const page of pages)
    for (const [label, n] of page) {
      const had = seen.get(label);
      if (had !== undefined) assert.equal(n, had, `"${label}" carried ${had} and then ${n}`);
      seen.set(label, n);
    }
  const byNumber = new Map<number, string>();
  for (const [label, n] of seen) {
    const had = byNumber.get(n);
    assert.ok(had === undefined || had === label, `number ${n} meant "${had}" and also "${label}"`);
    byNumber.set(n, label);
  }
  // page two picks up where page one stopped, rather than starting again at 1
  assert.equal(pages[0]!.get("thing 8"), 11);
  assert.equal(pages[1]!.get("thing 9"), 12);
});

/**
 * The other half of numbering off the whole list: a number keeps working after
 * the page turns. Two wave-six players read a number, turned the page, typed
 * it, and got "No action N" — the engine had always allowed it (`step` judges
 * against `allActions`), and only the number-to-action lookup in front of it
 * was resolving against the page instead of the list.
 */
test("a number read on one page still names the same thing from another", () => {
  const world = crowded(24);
  const numbered = (s: State) =>
    new Map(legalActions(world, s).map((a, i) => [actionLabel(world, a, s), menuNumbers(world, s)[i]!]));
  let s: State = newState(world, 1).state;
  const onPageOne = numbered(s);
  const thing0 = onPageOne.get("thing 0")!;
  s = step(world, s, pick(world, s, "more in this room")).state;
  const shown = numbered(s);
  assert.ok(!shown.has("thing 0"), "sanity: page two is not showing it");

  const a = actionByNumber(world, s, thing0);
  assert.ok(a, `number ${thing0} still names something from page two`);
  assert.equal(actionLabel(world, a!, s), "thing 0");
  const out = step(world, s, a!);
  assert.match(out.events.join(" "), /thing 0/, "and pressing it does the thing, not an illegal-action line");

  // a number past the end is still nothing, and so is a nonsense one
  assert.equal(actionByNumber(world, s, allActions(world, s).length + 1), undefined);
  assert.equal(actionByNumber(world, s, 0), undefined);
  assert.equal(actionByNumber(world, s, -3), undefined);
  assert.equal(actionByNumber(world, s, 1.5), undefined);
});

test("the first crowded room says once that the numbers hold across its pages", () => {
  const world = crowded(24);
  const first = step(world, newState(world, 1).state, pick(world, newState(world, 1).state, "go north"));
  assert.ok(
    !first.events.some((e) => e.includes("turns the page")),
    "the yard is not crowded, so there is nothing to explain there",
  );
  // walking back into the crowded hall is where it lands, and only the once
  const back = step(world, first.state, pick(world, first.state, "go north"));
  assert.ok(back.events.some((e) => e.includes("turns the page")), back.events.join(" | "));
  const again = step(world, back.state, pick(world, back.state, "more in this room"));
  assert.ok(!again.events.some((e) => e.includes("turns the page")), "said once, not on every page turn");
});

/**
 * A conversation with more topics than the menu holds — the talk-mode twin of
 * "an option keeps its number on whatever page it is showing" above.
 *
 * queue/P1-issue-4839330e.json ("a page-2 option list caused an unintended
 * [wrong pick] instead of the intended dialogue pick"): unlike a room, a
 * conversation still pages *itself* inside `roomMenu`, and `allActions` used
 * to fall through to that same paged result for talk mode — so a page-2
 * conversation numbered its own topics from 1, and a number that meant one
 * topic on page 1 silently meant a different one on page 2. `talkList` gives
 * conversations the same whole-list numbering rooms and travel already have.
 */
const chatty = (n: number): World =>
  ({
    id: "chat",
    title: "chat",
    intro: "An elder with a great deal to say.",
    start: "hall",
    hp: 10,
    maxScore: 1,
    rooms: { hall: { name: "The Hall", desc: "An elder waits.", exits: {} } },
    items: {},
    npcs: {
      elder: {
        name: "elder",
        room: "hall",
        dialogue: true,
        topics: [
          ...Array.from({ length: n }, (_, i) => ({ id: `t${i}`, label: `topic ${i}`, say: `About topic ${i}.` })),
          { id: "bye", label: "farewell", say: "Go well.", end: true },
        ],
      },
    },
    walkthrough: [],
  }) as unknown as World;

test("a conversation topic keeps its number on whatever page it is showing", () => {
  const world = chatty(24); // 24 topics + farewell, well past MENU_CAP
  let { state } = newState(world, 1);
  state = step(world, state, actionByLabel(world, state, "talk to elder")!).state;
  const numbered = (s: State) => {
    const acts = legalActions(world, s), nums = menuNumbers(world, s);
    return new Map(acts.map((a, i) => [actionLabel(world, a, s), nums[i]!]));
  };
  const page1 = numbered(state);
  assert.equal(page1.get("farewell"), 26, "the farewell sits one past every topic, not just this page's");
  const talkmoreLabel = [...page1.keys()].find((l) => l !== "farewell" && !l.startsWith("topic"));
  assert.equal(page1.get(talkmoreLabel!), 25, "\"more to ask\" sits right after every real topic");

  state = step(world, state, actionByLabel(world, state, talkmoreLabel!)!).state;
  const page2 = numbered(state);
  assert.equal(page2.get("farewell"), 26, "the farewell keeps its number on page 2 too");
  assert.equal(page2.get(talkmoreLabel!), 25, "so does \"more to ask\"");

  // no label ever carries two different numbers, nor two labels one number
  const seen = new Map<string, number>();
  for (const page of [page1, page2])
    for (const [label, n] of page) {
      const had = seen.get(label);
      if (had !== undefined) assert.equal(n, had, `"${label}" carried ${had} and then ${n}`);
      seen.set(label, n);
    }
  const byNumber = new Map<number, string>();
  for (const [label, n] of seen) {
    const had = byNumber.get(n);
    assert.ok(had === undefined || had === label, `number ${n} meant "${had}" and also "${label}"`);
    byNumber.set(n, label);
  }
});

test("a conversation number read on one page still names the same topic from another", () => {
  const world = chatty(24);
  let { state } = newState(world, 1);
  state = step(world, state, actionByLabel(world, state, "talk to elder")!).state;
  const onPageOne = new Map(legalActions(world, state).map((a, i) => [actionLabel(world, a, state), menuNumbers(world, state)[i]!]));
  const topic0Number = onPageOne.get("topic 0")!;
  const talkmoreLabel = [...onPageOne.keys()].find((l) => l !== "farewell" && !l.startsWith("topic"))!;

  state = step(world, state, actionByLabel(world, state, talkmoreLabel)!).state;
  assert.ok(!legalActions(world, state).some((a) => actionLabel(world, a, state) === "topic 0"), "sanity: page two is not showing it");

  const a = actionByNumber(world, state, topic0Number);
  assert.ok(a, `number ${topic0Number} still names something from page one`);
  assert.equal(actionLabel(world, a!, state), "topic 0");
  const out = step(world, state, a!);
  assert.match(out.events.join(" "), /About topic 0\./, "and pressing it asks that topic, not a different one");
});

/**
 * What `step` will judge legal and what the screen shows are the same list, in
 * every menu. `roomMenu` reaches its travel branch only after `ended`, the
 * class phase, a pending perk and an open conversation have each had their
 * turn; `allActions` used to check travel ahead of all of them, so a perk
 * pending while the travel menu was open made the two disagree — the screen
 * offering a perk that `actionByNumber` could not name, and every number it
 * did name illegal. Unreachable through today's grammar (travel spends no
 * turn, so no level lands mid-menu), which is exactly why it wanted a test:
 * nothing else would notice if a later clock entry made it reachable.
 */
test("a perk pending while the travel menu is open: what step judges legal is what the screen shows", () => {
  const world = {
    id: "trav", title: "trav", intro: "Two known places.", start: "a", hp: 10, maxScore: 1,
    regions: { vale: { name: "the Vale" } },
    perks: { keen: { name: "Keen", desc: "A sharp eye." } },
    rooms: {
      a: { name: "A", desc: "A.", landmark: "the A", region: "vale", exits: { east: { to: "b" } } },
      b: { name: "B", desc: "B.", landmark: "the B", region: "vale", exits: { west: { to: "a" } } },
    },
    items: {}, npcs: {}, walkthrough: [],
  } as unknown as World;
  let { state } = newState(world, 1);
  state = step(world, state, actionByLabel(world, state, "go east")!).state;
  const open = actionByLabel(world, state, "travel to a known place");
  assert.ok(open, `travel is offered once somewhere else is known, saw: ${legalActions(world, state).map((a) => actionLabel(world, a, state)).join(" | ")}`);
  state = step(world, state, open!).state;
  assert.ok(state.travelMenu !== null, "sanity: the travel menu is open");

  const pending: State = { ...state, perkPicks: 1 };
  const shown = legalActions(world, pending).map((a) => actionLabel(world, a, pending));
  const judged = allActions(world, pending).map((a) => actionLabel(world, a, pending));
  assert.deepEqual(judged, shown, "allActions and legalActions agree on what is on offer");
  for (const n of menuNumbers(world, pending)) assert.ok(n >= 1, `every number offered is pressable, got ${n}`);
});
