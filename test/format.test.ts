import assert from "node:assert/strict";
import test from "node:test";
import { newState, step } from "../src/engine.ts";
import { matchesMenuLabel, render, renderMenu, renderStatus } from "../src/format.ts";
import type { State, World } from "../src/types.ts";

test("matchesMenuLabel: a rendered menu line is its canonical label, alone or with one trailing display hint", () => {
  // Every hint kind oddsHint can append (see engine.ts), plus labels whose own
  // parentheses must survive — a mock player that only sees rendered text has
  // to recover the canonical label a walkthrough is written in.
  const cases: [line: string, canonical: string, want: boolean][] = [
    ["go east", "go east", true],
    ["go east (toward drowned shrine)", "go east", true], // destination landmark
    ["go north (locked: find the keeper's key)", "go north", true], // locked exit, with clue
    ["go north (locked)", "go north", true],
    ["force it (roll 9+ on the die; +2 might)", "force it", true], // check odds, with modifier
    ["force it (roll 11+ on the die; might)", "force it", true], // check odds, no modifier
    ["attack sea-wight with notched cutlass (roll 6+ on the die)", "attack sea-wight with notched cutlass", true],
    ["use iron crown (turn it over and read the engraving inside the band)", "use iron crown", true], // item-use preview
    ["work out the water verse (wits) (roll 7+ on the die; wits)", "work out the water verse (wits)", true], // canonical parens kept
    ["perk: Fleetfoot (+2 grace checks (locks))", "perk: Fleetfoot (+2 grace checks (locks))", true],
    ["Go East (toward drowned shrine)", "go east", true], // case-insensitive, like actionByLabel
    ["go east now", "go east", false],
    ["go eastward", "go east", false],
    ["use iron crown on hollow king", "use iron crown", false], // a different action, not a hint
    ["go east (toward drowned shrine) extra", "go east", false],
    // and the one place a rendered line is NOT the canonical label plus a hint:
    // renderMenu drops a trailing skill tag the hint beside it already names
    ["swim it (DC 12, +2 grace: roll 10+ on the die)", "swim it (grace)", true],
    ["raise the cup (will, 1hp fail) (DC 11, will: roll 11+ on the die)", "raise the cup (will, 1hp fail)", true], // not a bare tag: kept
    ["swim it (DC 12, +2 might: roll 10+ on the die)", "swim it (grace)", false], // a different skill is a different option
  ];
  for (const [line, canonical, want] of cases)
    assert.equal(matchesMenuLabel(line, canonical), want, `"${line}" vs "${canonical}"`);
});

const stateWithVars = (vars: Record<string, number>, inv: string[] = []) =>
  ({ vars, inv, flags: {} }) as unknown as State;

test("renderStatus: reports every statusTracks entry, falling back to 0", () => {
  const world = {
    statusTracks: [
      { var: "verses_known", label: "Verses", max: 3 },
      { var: "crown_progress", label: "Crown", max: 2 },
    ],
  } as World;
  assert.equal(renderStatus(world, stateWithVars({ verses_known: 2 })), "Verses: 2/3\nCrown: 0/2");
});

test("renderStatus: falls back to the single progress tracker when statusTracks is absent", () => {
  const world = { progress: { var: "verses_known", label: "Verses", max: 3 } } as World;
  assert.equal(renderStatus(world, stateWithVars({ verses_known: 1 })), "Verses: 1/3");
});

test("renderStatus: reports nothing to track when the world has neither", () => {
  const world = {} as World;
  assert.equal(renderStatus(world, stateWithVars({})), "No progress to report.");
});

test("renderStatus: leads with objectives when the world sets them, ahead of tracked paths", () => {
  const world = {
    objectives: "Find the crown or speak the verses.",
    statusTracks: [{ var: "verses_known", label: "Verses", max: 3 }],
  } as World;
  assert.equal(
    renderStatus(world, stateWithVars({ verses_known: 1 })),
    "Find the crown or speak the verses.\nVerses: 1/3",
  );
});

test("renderStatus: falls back to intro for the recap when objectives is absent", () => {
  const world = { intro: "A storm is coming." } as World;
  assert.equal(renderStatus(world, stateWithVars({})), "A storm is coming.");
});

test("renderStatus: lists what you're carrying, so it doubles as a pre-decision inventory check", () => {
  const world = {
    objectives: "Find the crown or speak the verses.",
    items: { crown: { name: "the crown" }, dagger: { name: "a rusty dagger" } },
  } as unknown as World;
  assert.equal(
    renderStatus(world, stateWithVars({}, ["crown", "dagger"])),
    "Find the crown or speak the verses.\ncarrying: the crown, a rusty dagger",
  );
});

test("renderStatus: lists visited rooms by name, as a memory aid against repetitive backtracking", () => {
  const world = {
    rooms: { square: { name: "Village Square" }, gate: { name: "Village Gate" } },
  } as unknown as World;
  const state = { vars: {}, inv: [], visited: ["square", "gate"] } as unknown as State;
  assert.equal(renderStatus(world, state), "Visited: Village Square, Village Gate");
});

test("renderStatus: falls back to the room id if a visited room has no name (e.g. a stale id)", () => {
  const world = { rooms: {} } as unknown as World;
  const state = { vars: {}, inv: [], visited: ["ghost_room"] } as unknown as State;
  assert.equal(renderStatus(world, state), "Visited: ghost_room");
});

test("renderStatus: past a dozen visited places, shows the count and the latest few instead of every name", () => {
  const ids = Array.from({ length: 20 }, (_, i) => `r${i}`);
  const world = { rooms: Object.fromEntries(ids.map((id) => [id, { name: `Room ${id.slice(1)}` }])) } as unknown as World;
  const state = { vars: {}, inv: [], visited: ids } as unknown as State;
  assert.equal(renderStatus(world, state), "Visited: 20 places (lately: Room 15, Room 16, Room 17, Room 18, Room 19)");
});

test("renderStatus: omits the visited line when nothing has been visited yet", () => {
  const world = { objectives: "Find the crown." } as World;
  const state = { vars: {}, inv: [], visited: [] } as unknown as State;
  assert.equal(renderStatus(world, state), "Find the crown.");
});

test("renderStatus: lists held perks with their effects, so a player can recall what each does", () => {
  const world = {
    objectives: "Find the crown.",
    perks: {
      old_lore: { name: "Old Lore", desc: "+1 other wits checks" },
      fleetfoot: { name: "Fleetfoot", desc: "+2 grace checks (locks)" },
    },
  } as unknown as World;
  const state = { vars: {}, inv: [], perks: ["old_lore", "fleetfoot"] } as unknown as State;
  assert.equal(
    renderStatus(world, state),
    "Find the crown.\nPerks: Old Lore (+1 other wits checks), Fleetfoot (+2 grace checks (locks))",
  );
});

test("renderStatus: omits the perks line when the player holds none", () => {
  const world = { objectives: "Find the crown." } as World;
  const state = { vars: {}, inv: [], perks: [] } as unknown as State;
  assert.equal(renderStatus(world, state), "Find the crown.");
});

test("renderStatus: totals check and combat modifiers for worlds with a character system", () => {
  const world = {
    objectives: "Find the crown.",
    classes: { warden: { name: "Warden", desc: "strong" } },
    items: { sword: { name: "sword", dmg: 3, hit: 1 } },
    perks: {
      keen_edge: { name: "Keen Edge", desc: "+1 to hit", bonus: { hit: 1 } },
      old_lore: { name: "Old Lore", desc: "+1 wits", bonus: { check: { wits: 1 } } },
    },
  } as unknown as World;
  const state = {
    vars: {},
    flags: {},
    inv: ["sword"],
    perks: ["keen_edge", "old_lore"],
    attrs: { might: 2, wits: 1 },
    conds: {},
  } as unknown as State;
  assert.equal(
    renderStatus(world, state),
    "Find the crown.\ncarrying: sword\nPerks: Keen Edge (+1 to hit), Old Lore (+1 wits)\n" +
      "Checks: might+2 grace+0 wits+2 (+1 base, +1 Old Lore) will+0\nCombat: hit+4 dmg+3 (sword) armor+0",
  );
});

test("renderStatus: omits check/combat totals for a classless world", () => {
  const world = { objectives: "Find the crown." } as World;
  const state = stateWithVars({});
  assert.equal(renderStatus(world, state), "Find the crown.");
});

// Playtest finding: an ability spends a pool of 2 (`res_warden`), and nothing
// anywhere said how much was left in it — not the menu, not status. A Warden
// could press an ability twice and learn the pool was empty from its absence
// on the third turn. `status` now carries "Ready to spend: <class> n/max", so
// there is somewhere to check before spending the last point — and only the
// player's own class's pool, since a Scholar has no use for the Warden's.
const poolWorld = {
  classes: { warden: { name: "Warden", desc: "strong" }, scholar: { name: "Scholar", desc: "wise" } },
  resources: { res_warden: 2 },
  abilities: {
    brace: { label: "brace for it", if: [["class", "warden"], ["var", "res_warden", ">=", 1]], fx: [["addvar", "res_warden", -1]] },
  },
} as unknown as World;

test("renderStatus: names an ability pool the player's own class can spend from", () => {
  const state = { vars: { res_warden: 1 }, flags: {}, inv: [], perks: [], attrs: {}, conds: {}, classId: "warden" } as unknown as State;
  assert.match(renderStatus(poolWorld, state), /Ready to spend: Warden 1\/2 \(a rest fills it\)/);
});

test("renderStatus: says nothing about a pool the player's class cannot spend from", () => {
  const state = { vars: { res_warden: 1 }, flags: {}, inv: [], perks: [], attrs: {}, conds: {}, classId: "scholar" } as unknown as State;
  assert.doesNotMatch(renderStatus(poolWorld, state), /Ready to spend/);
});

test("renderStatus: reports a statusPaths fallback when no state's conditions match", () => {
  const world = {
    statusPaths: [
      {
        label: "Barrow",
        states: [{ if: [["flag", "promised_seal"]], text: "promised to seal it" }],
        fallback: "undecided",
      },
    ],
  } as unknown as World;
  assert.equal(renderStatus(world, stateWithVars({})), "Barrow: undecided");
});

test("renderStatus: reports the first matching statusPaths state, in order", () => {
  const world = {
    statusPaths: [
      {
        label: "Barrow",
        states: [
          { if: [["flag", "broke_promise"]], text: "promise broken" },
          { if: [["flag", "promised_seal"]], text: "promised to seal it" },
        ],
        fallback: "undecided",
      },
    ],
  } as unknown as World;
  const state = { vars: {}, inv: [], flags: { promised_seal: true } } as unknown as State;
  assert.equal(renderStatus(world, state), "Barrow: promised to seal it");
});

test("renderStatus: omits a statusPaths line when nothing matches and there is no fallback", () => {
  const world = {
    statusPaths: [{ label: "Barrow", states: [{ if: [["flag", "promised_seal"]], text: "promised" }] }],
  } as unknown as World;
  assert.equal(renderStatus(world, stateWithVars({})), "No progress to report.");
});

/**
 * A turn's numbers fold onto one line, and add up.
 *
 * One action can earn score twice and xp twice, and each pushes its own event.
 * Once every event got its own line — which is what made four companions
 * answering a hold's arrival legible — that read as "(+5)", "(+3xp)",
 * "(+5xp)", "(+5)" straight down the screen: four lines to say two numbers.
 */
const noticeWorld = (): World =>
  ({
    id: "n",
    title: "N",
    intro: "x",
    start: "a",
    hp: 10,
    maxScore: 5,
    rooms: { a: { name: "A", desc: "A room.", actions: [{ id: "win", label: "win", fx: [["score", 5], ["end", "win", "done", "Done."]] }] } },
    items: {},
    npcs: {},
    walkthrough: ["win"],
  }) as unknown as World;

test("a run of bare notices reads as one line, with score and xp summed", () => {
  const world = noticeWorld();
  const line = (events: string[]) => render(world, newState(world, 1).state, events).text.split("\n")[1]!;
  assert.equal(line(["(+5)", "(+3xp)", "(+5xp)", "(+5)"]), "[(+10, +8xp)]");
  assert.equal(line(["(+5)"]), "[(+5)]", "one notice reads exactly as it always did");
  assert.equal(
    line(["(+5)", "(+4xp)", "(the Gray Church -2)", "(the Crown +1)"]),
    "[(+5, +4xp, the Gray Church -2, the Crown +1)]",
    "anything that names its subject keeps its own words, in the order it was pushed",
  );
});

test("prose between two notices keeps them apart — a number belongs to what earned it", () => {
  const world = noticeWorld();
  const text = render(world, newState(world, 1).state, ["(+5)", "The stair lets out behind the guards.", "(+3xp)", "(+2)"]).text;
  const block = text.split("\n").slice(1, 4);
  // and the sums read in a fixed order — score, then xp, then whatever names
  // its own subject — however the effects happened to push them
  assert.deepEqual(block, ["[(+5)", "The stair lets out behind the guards.", "(+2, +3xp)]"], text);
});

/**
 * The realm tags a check option with its skill — "slip past him along the bough
 * (grace)" — and then the hint beside it says "+2 grace" a foot away. 513
 * option lines across the proven roads said it twice, 1.5 characters a screen,
 * on every road including the four with about one character of slack left.
 *
 * The canonical label does not move: it is what `actionByLabel` matches and
 * what all nine proofs and the walkthrough name their steps by.
 */
test("renderMenu drops a skill tag the hint already names, and only that", () => {
  const world = {
    id: "m",
    title: "M",
    intro: "x",
    start: "a",
    hp: 10,
    maxScore: 5,
    rooms: {
      a: {
        name: "A",
        desc: "A.",
        actions: [
          { id: "swim", label: "swim it (grace)", fx: [["check", "grace", 12, [["say", "ok"]], [["say", "no"]]]] },
          // the hint names a different skill, so the tag is telling the player something
          { id: "odd", label: "heave it (might)", fx: [["check", "grace", 12, [["say", "ok"]], [["say", "no"]]]] },
          // not a bare tag: it says what the hint does not
          { id: "cup", label: "raise the cup (will, 1hp fail)", fx: [["check", "will", 11, [["say", "ok"]], [["hp", -1]]]] },
          // no hint at all to double up with
          { id: "plain", label: "wait a while (wits)", fx: [["say", "You wait."]] },
        ],
      },
    },
    items: {},
    npcs: {},
    walkthrough: [],
  } as unknown as World;
  const { state } = newState(world, 1);
  const lines = renderMenu(world, state).text.split("\n");
  const line = (frag: string) => lines.find((l) => l.includes(frag))!;

  assert.match(line("swim it"), /^\d+ swim it \(DC 12, grace: roll 12\+ on the die\)$/, line("swim it"));
  assert.match(line("heave it"), /^\d+ heave it \(might\) \(DC 12, grace: /, line("heave it"));
  assert.match(line("raise the cup"), /^\d+ raise the cup \(will, 1hp fail\) \(DC 11, will: /, line("raise the cup"));
  assert.equal(line("wait a while"), lines.find((l) => l.endsWith("wait a while (wits)")), "no hint, nothing to fold into");

  // and the canonical label is untouched, so a walkthrough step still resolves
  const out = step(world, state, { kind: "custom", room: "a", id: "swim" });
  assert.notEqual(out.state, state, "sanity: the action ran");
  assert.ok(matchesMenuLabel(line("swim it").replace(/^\d+ /, ""), "swim it (grace)"));
});
