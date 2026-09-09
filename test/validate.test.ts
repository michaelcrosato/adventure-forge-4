import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { loadWorld, validateWorld } from "../src/validate.ts";

const fixture = (name: string) =>
  loadWorld(fileURLToPath(new URL(`./fixtures/${name}.json`, import.meta.url)));

test("every shipped world validates clean", () => {
  const dir = fileURLToPath(new URL("../world", import.meta.url));
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 2, "expected at least lighthouse and vale");
  for (const f of files) {
    assert.deepEqual(validateWorld(loadWorld(join(dir, f))), [], f);
  }
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

test("rejects authored records missing a field the engine prints or dispatches on", () => {
  // JSON is not type-checked; a Vale topic once shipped without `say` and
  // played as `elder: "undefined"`.
  const w = twoEndings({ gave_in: ["give in"] });
  w.npcs = { elder: { name: "elder", room: "a", topics: [{ id: "t", label: "talk" } as never] } };
  w.rooms["a"]!.actions!.push({ id: "mute", fx: [["say", "x"]] } as never);
  w.items = { rock: { name: "rock" } as never };
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("npc elder topic t") && e.includes('"say"')), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("action mute") && e.includes('"label"')), errs.join("\n"));
  assert.ok(errs.some((e) => e.includes("item rock") && e.includes('"loc"')), errs.join("\n"));
});

// ---------- ending proofs ----------
import type { World } from "../src/types.ts";

const twoEndings = (proofs?: World["proofs"]): World => ({
  id: "p",
  title: "P",
  intro: "x",
  start: "a",
  hp: 10,
  maxScore: 5,
  rooms: {
    a: {
      name: "A",
      desc: "A.",
      actions: [
        { id: "win", label: "win", fx: [["score", 5], ["end", "win", "main", "Won."]] },
        { id: "quit", label: "give in", fx: [["end", "lose", "gave_in", "Lost."]] },
      ],
    },
  },
  items: {},
  npcs: {},
  walkthrough: ["win"],
  ...(proofs ? { proofs } : {}),
});

test("an ending without a proof is an error", () => {
  const errs = validateWorld(twoEndings());
  assert.ok(errs.some((e) => e.includes("ending gave_in") && e.includes("no proof")));
});

test("a replaying proof clears the ending", () => {
  assert.deepEqual(validateWorld(twoEndings({ gave_in: ["give in"] })), []);
});

test("a proof that reaches the wrong ending is an error", () => {
  const errs = validateWorld(twoEndings({ gave_in: ["win"] }));
  assert.ok(errs.some((e) => e.includes("proofs.gave_in")));
});

test("a proof for an ending the content cannot reach is an error", () => {
  const errs = validateWorld(twoEndings({ gave_in: ["give in"], ghost: ["win"] }));
  assert.ok(errs.some((e) => e.includes("proofs.ghost")));
});

// ---------- reads with no writer ----------
/**
 * A gate whose key the world never cuts. Found for real in the Kingswood: the
 * after-quest's burned branch waited on `said_kw_priest_sv_kw_burned_ask` and
 * the topic is `sv_kw_burn_ask`, so the stage never cleared — a player who
 * burned the Hunt's Stand was told "Father Twyne wonders what becomes of the
 * cleared ground" for the rest of the run, however many times they asked him.
 * One letter, and nothing in the toolchain could see it.
 */
const ok = (): World => twoEndings({ gave_in: ["give in"] });

test("a flag nothing ever sets is an error, wherever it is read", () => {
  for (const [what, put] of [
    ["an action's if", (w: World) => { w.rooms["a"]!.actions![0]!.if = [["flag", "never_set"]]; }],
    ["a quest's start", (w: World) => { w.quests = { q: { name: "Q", start: [["flag", "never_set"]], stages: [{ if: [], text: "go" }] } }; }],
    ["an epilogue line", (w: World) => { w.epilogue = [{ if: [["flag", "never_set"]], text: "x" }]; }],
    ["a clock entry", (w: World) => { w.clock = [{ id: "c", if: [["flag", "never_set"]], fx: [["say", "x"]] }]; }],
    ["a since condition", (w: World) => { w.rooms["a"]!.actions![0]!.if = [["since", "never_set", ">=", 5]]; }],
  ] as [string, (w: World) => void][]) {
    const w = ok();
    put(w);
    const errs = validateWorld(w);
    assert.ok(errs.some((e) => e.includes("never_set") && e.includes("gate with no key")), `${what}: ${errs.join(" | ") || "loaded clean"}`);
  }
});

test("a var nothing ever writes is an error, including one only status prints", () => {
  for (const [what, put] of [
    ["a hud entry", (w: World) => { w.hud = [{ label: "gold", var: "never_written" }]; }],
    ["a statusTracks entry", (w: World) => { w.statusTracks = [{ label: "names", var: "never_written", max: 3 }]; }],
    ["an action's if", (w: World) => { w.rooms["a"]!.actions![0]!.if = [["var", "never_written", ">=", 1]]; }],
  ] as [string, (w: World) => void][]) {
    const w = ok();
    put(w);
    const errs = validateWorld(w);
    assert.ok(errs.some((e) => e.includes("never_written") && e.includes("always be zero")), `${what}: ${errs.join(" | ") || "loaded clean"}`);
  }
});

test("the flags and vars the engine writes itself are not the author's to set", () => {
  const w = ok();
  w.npcs = { lys: { name: "Lys", desc: "grim", room: "a", companion: {} } as never };
  w.rooms["a"]!.actions![0]!.once = true;
  w.rooms["a"]!.actions!.push({ id: "read", label: "read the sign", if: [
    ["flag", "_seenTravel"],          // an engine notice
    ["flag", "did_win"],              // a `once` action's own auto-flag
    ["flag", "calm_lys"],             // set when content calms an npc
    ["flag", "lys_left"],             // set when a companion parts ways
    ["var", "thefts_with_lys", ">=", 1], // counted by the engine on a theft
  ], fx: [["say", "x"]] });
  assert.deepEqual(validateWorld(w), []);
});

test("an engine-shaped flag naming something that does not exist is still a typo", () => {
  const w = ok();
  w.rooms["a"]!.actions!.push({ id: "read", label: "read the sign", if: [["flag", "did_no_such_action"]], fx: [["say", "x"]] });
  const errs = validateWorld(w);
  assert.ok(errs.some((e) => e.includes("did_no_such_action")), errs.join(" | ") || "loaded clean");
});

// ---------- an ability's pool must be declared ----------
/**
 * An ability's price is an ordinary var by design, but only `world.resources`
 * makes it a *pool*: that is where the menu reads it to say what pressing the
 * option costs, where status reads it for "Ready to spend", and what a rest
 * refills. Undeclared, a cost spends a counter that never comes back and a
 * gate keeps the ability off the menu for the whole game.
 */
test("an ability may not spend or gate on a pool world.resources does not declare", () => {
  const spends = ok();
  spends.abilities = { shove: { label: "shove", fx: [["addvar", "res_nope", -1], ["say", "Oof."]] } };
  assert.ok(validateWorld(spends).some((e) => e.includes("res_nope") && e.includes("never refill")), validateWorld(spends).join(" | ") || "loaded clean");

  const gates = ok();
  gates.abilities = { shove: { label: "shove", if: [["var", "res_nope", ">=", 1]], fx: [["say", "Oof."]] } };
  assert.ok(validateWorld(gates).some((e) => e.includes("res_nope") && e.includes("never be offered")), validateWorld(gates).join(" | ") || "loaded clean");

  const declared = ok();
  declared.resources = { res_yes: 2 };
  declared.abilities = { shove: { label: "shove", if: [["var", "res_yes", ">=", 1]], fx: [["addvar", "res_yes", -1], ["say", "Oof."]] } };
  assert.deepEqual(validateWorld(declared), []);
});

/**
 * `onEnter` runs on every entry; `onEnterOnce` runs once. A companion's
 * reaction belongs in the second, or behind a flag it sets. Three lines in
 * Coldpass were in the first with neither, so Vell praised the scriptorium's
 * rite-texts afresh every time the player walked back through — found by an
 * agent sent to fix a different wall of companion text, and worth a rule
 * because nothing else would ever have said it out loud.
 */
test("a named voice cannot say the same thing on every entry", () => {
  const world = {
    id: "m",
    title: "M",
    intro: "x",
    start: "a",
    hp: 10,
    maxScore: 5,
    rooms: { a: { name: "A", desc: "A." } },
    items: {},
    npcs: { vell: { name: "Vell", room: "a", companion: {} } },
    walkthrough: [],
  } as unknown as World;
  world.rooms["a"]!.onEnter = [["if", [["inParty", "vell"]], [["say", 'Vell: "Rite-texts, under a monastery roof."']], []]];
  assert.ok(
    validateWorld(world).some((e) => e.includes("nothing to stop it repeating")),
    validateWorld(world).join("\n"),
  );

  // the two ways to say it properly
  world.rooms["a"]!.onEnter = [
    ["if", [["inParty", "vell"], ["!flag", "said_it"]], [["set", "said_it"], ["say", 'Vell: "Rite-texts."']], []],
  ];
  assert.deepEqual(validateWorld(world).filter((e) => /repeating/.test(e)), []);
  world.rooms["a"]!.onEnter = undefined;
  world.rooms["a"]!.onEnterOnce = [["if", [["inParty", "vell"]], [["say", 'Vell: "Rite-texts."']], []]];
  assert.deepEqual(validateWorld(world).filter((e) => /repeating/.test(e)), []);

  // and weather is not a person: an unguarded onEnter line nobody speaks is fine
  world.rooms["a"]!.onEnterOnce = undefined;
  world.rooms["a"]!.onEnter = [["say", "The wind picks up off the spine."]];
  assert.deepEqual(validateWorld(world).filter((e) => /repeating/.test(e)), []);
});

// ---------- five gaps a review found in the closed DSL ----------
/**
 * Each of these passed validation before, and each let content ship that could
 * never work. They are grouped because they share one shape: a check written
 * for one spelling of an op, while the DSL grew a second.
 */
test("clearing a flag is not the same as ever setting it", () => {
  const w = ok();
  // reads `opened`, and only ever clears it — so the gate is false forever
  w.rooms["a"]!.actions![0]!.if = [["flag", "opened"]];
  w.rooms["a"]!.actions![1]!.fx = [["clear", "opened"], ["end", "lose", "gave_in", "Lost."]];
  const errs = validateWorld(w);
  assert.ok(
    errs.some((e) => e.includes("opened")),
    `a flag only ever cleared is a gate with no key:\n${errs.join("\n")}`,
  );
});

test("a negated checkHere validates its skill and dc like the positive one", () => {
  const w = ok();
  w.abilities = { a: { label: "x", context: "combat", if: [["!checkHere", "mgiht", 11]], fx: [["say", "x"]] } };
  const errs = validateWorld(w);
  assert.ok(
    errs.some((e) => e.includes("mgiht")),
    `a misspelled skill reads true everywhere in the negated form:\n${errs.join("\n")}`,
  );
});

test("turn and since validate their comparator and their threshold", () => {
  for (const [what, cond] of [
    ["turn's threshold", ["turn", ">=", "60"]],
    ["since's comparator", ["since", "gave_in", "=>", 60]],
    ["since's threshold", ["since", "gave_in", ">=", "60"]],
  ] as const) {
    const w = ok();
    w.rooms["a"]!.actions![0]!.if = [cond as never];
    const errs = validateWorld(w);
    assert.ok(errs.length > 0, `${what} should not load clean: ${JSON.stringify(cond)}`);
  }
});

test("a chance's success branch is searched for a line that repeats forever", () => {
  const w = ok();
  w.npcs = { friend: { name: "Friend", room: "a", companion: { leaves: [] } } };
  // ["chance", pct, okFx, failFx] — the repeating line sits in okFx, one index
  // left of where a check keeps its branches
  w.rooms["a"]!.onEnter = [
    ["chance", 50, [["if", [["inParty", "friend"]], [["say", "Friend says the same thing every time."]], []]], []],
  ];
  const errs = validateWorld(w);
  assert.ok(
    errs.some((e) => e.includes("onEnter")),
    `a repeating companion line inside a chance's success branch must be caught:\n${errs.join("\n")}`,
  );
});

test("a labelled proof is coverage for its own ending", () => {
  // the only witness for `gave_in` carries a label; it is still a proof of it
  assert.deepEqual(validateWorld(twoEndings({ "gave_in#slow": ["give in"] })), []);
});
