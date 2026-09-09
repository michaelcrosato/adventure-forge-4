/**
 * The Gray Reach is held to the authoring guide's style budget as well as the
 * engine's: desc ≤ 260, brief ≤ 70, label ≤ 40, say ≤ 220, epilogue ≤ 140,
 * stage ≤ 120 (scripts/lint-world.ts). The realm's validity, walkthrough,
 * proofs, and token budget are checked with every other shipped world by the
 * world/ glob tests; this is the one bar only the realm is held to.
 */
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { condOk, newState } from "../src/engine.ts";
import { loadWorld } from "../src/validate.ts";

const path = fileURLToPath(new URL("../world/reach.json", import.meta.url));

test("the Gray Reach's text stays inside the style budget (scripts/lint-world.ts)", () => {
  const out = execFileSync(process.execPath, ["--import", "tsx", "scripts/lint-world.ts", path], { encoding: "utf8" });
  assert.match(out, /all text within budget/);
});

/**
 * The Ironbound march is the realm's one autonomous force: set it moving and
 * fourteen holds fall on a schedule unless you reach them. That schedule was
 * written in absolute turns, which made it a trap rather than a clock — a
 * player who set the march moving at turn 470 had already passed ten of its
 * thresholds, and watched ten holds burn in ten consecutive turns with nothing
 * they could have done differently. Measured, before the fix: begun at turn 80,
 * two holds fell in 78 turns; begun at 470, twelve fell in the same 78.
 *
 * The schedule now counts from the march itself (`since`), so the column moves
 * at the same pace whenever it starts.
 */
test("the Ironbound march counts its schedule from the march, not from turn zero", () => {
  const world = loadWorld(path);
  const burns = (world.clock ?? []).filter((e) => e.id.startsWith("iron_march_burn_"));
  assert.ok(burns.length >= 10, `the march should burn a realm's worth of holds, found ${burns.length}`);
  for (const e of burns) {
    assert.ok(
      !(e.if ?? []).some((c) => Array.isArray(c) && c[0] === "turn"),
      `${e.id} gates on an absolute turn: a player who sets the march moving late would watch the holds fall all at once`,
    );
    assert.ok(
      (e.if ?? []).some((c) => Array.isArray(c) && c[0] === "since" && c[1] === "iron_march"),
      `${e.id} must count from ["since","iron_march",...] — that is what makes the schedule the march's own`,
    );
  }
  // and the pace is the same wherever the column starts from
  const delay = (entry: (typeof burns)[number], begunAt: number): number => {
    const { state } = newState(world, 1);
    state.flags["iron_march"] = true;
    state.flagTurn["iron_march"] = begunAt;
    for (let t = begunAt; t <= begunAt + 700; t++) {
      state.turn = t;
      if ((entry.if ?? []).every((c) => condOk(world, state, c))) return t - begunAt;
    }
    return -1;
  };
  for (const e of burns) {
    const early = delay(e, 20);
    assert.ok(early > 0, `${e.id} never comes due`);
    assert.equal(delay(e, 470), early, `${e.id} falls ${early} turns after the column moves — it must not depend on when that was`);
  }
});

/**
 * An ability offered where it cannot do anything is a lie the menu tells.
 *
 * Found in play: a Warden's `brace for it` spends a point for armor +2, and was
 * offered against all eight of the realm's `pierce` hostiles — in rooms whose
 * own text says "armor useless". The rule is general, not a patch on one
 * ability: anything that buys armor must stay off the menu where nothing here
 * can be turned by armor.
 */
test("nothing that buys armor is offered where armor counts for nothing", () => {
  const world = loadWorld(path);
  const armorConds = new Set(
    Object.entries(world.conditions ?? {})
      .filter(([, c]) => (c.armor ?? 0) > 0)
      .map(([id]) => id),
  );
  assert.ok(armorConds.size, "the realm should have at least one condition that buys armor");
  let checked = 0;
  for (const [id, a] of Object.entries(world.abilities ?? {})) {
    if (!(a.fx ?? []).some((f) => f[0] === "cond" && armorConds.has(String(f[1])))) continue;
    checked++;
    assert.ok(
      (a.if ?? []).some((c) => Array.isArray(c) && c[0] === "!horrorHere"),
      `ability ${id} buys armor and must be gated on ["!horrorHere"] — offering it against something that strikes through armor spends the point for nothing`,
    );
  }
  assert.ok(checked, "no ability buys armor — this test has stopped watching anything");
});

/**
 * A grid coordinate is not a name.
 *
 * `worldgen` falls back to `<region> <x>,<y>` for a cell with no spot name, no
 * scene and no leftover from `pools.names`. That fallback is right for a
 * 25,600-room generated overworld and wrong here: the Reach's own standard
 * (docs/authoring.md §9) is that every cell is a distinct named place, and two
 * cells of Marrowgate's Warrens reached players as "the Warrens 1,2" and "the
 * Warrens 2,2" — the same class of leak as "You travel to ir_miners_hall."
 *
 * So the rule lives here, with the realm's other density bars, rather than in
 * the validator where it would fail every minimal fixture.
 */
test("no room in the Reach is named after its grid coordinate", () => {
  const world = loadWorld(path);
  const bad = Object.entries(world.rooms)
    .filter(([, r]) => /\b\d+,\d+$/.test(r.name))
    .map(([id, r]) => `${id}: "${r.name}"`);
  assert.deepEqual(
    bad,
    [],
    `a gen ran out of scenes and names for its open cells — add to its pools.names:\n  ${bad.join("\n  ")}`,
  );
});

/**
 * Two rooms of one region sharing a name is a navigation trap: a travel menu,
 * a bearings line and the visited list all have nothing but the name to tell
 * them apart. Kingswood had two "The East Track" and two "The South Track"
 * before this.
 *
 * Across regions it is only geography — England is full of fords — so this
 * holds the realm to the tighter rule where it matters and leaves the rest.
 */
test("no two rooms of one region share a name", () => {
  const world = loadWorld(path);
  const seen = new Map<string, string[]>();
  for (const [id, r] of Object.entries(world.rooms)) {
    if (!r.region) continue;
    const key = `${r.region}|${r.name.toLowerCase()}`;
    seen.set(key, [...(seen.get(key) ?? []), id]);
  }
  const clashes = [...seen.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => `${key.split("|")[1]} (${key.split("|")[0]}): ${ids.join(", ")}`);
  assert.deepEqual(clashes, [], `one region, one name each:\n  ${clashes.join("\n  ")}`);
});
