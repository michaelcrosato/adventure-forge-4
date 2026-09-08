/**
 * Content rules the shipped worlds must keep — checked against the real world
 * files, so a dev-loop content change cannot quietly reintroduce them.
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { actionByLabel, newState, step } from "../src/engine.ts";
import { loadWorld } from "../src/validate.ts";
import type { Fx, World } from "../src/types.ts";

const dir = fileURLToPath(new URL("../world", import.meta.url));
const worlds: World[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => loadWorld(join(dir, f)));

/** Every check in an fx list, including those nested in other checks' branches. */
function checks(fxs: Fx[] | undefined): Extract<Fx, [op: "check", ...rest: unknown[]]>[] {
  const out: Extract<Fx, [op: "check", ...rest: unknown[]]>[] = [];
  for (const fx of fxs ?? []) {
    if (fx[0] === "if") out.push(...checks(fx[2]), ...checks(fx[3]));
    if (fx[0] === "chance") out.push(...checks(fx[2]), ...checks(fx[3]));
    if (fx[0] !== "check") continue;
    out.push(fx);
    out.push(...checks(fx[3]), ...checks(fx[4]));
  }
  return out;
}

for (const world of worlds) {
  test(`no menu label calls a failed attempt safe when its failure costs hp (${world.id})`, () => {
    // Regression for a playtest finding: "force the doors — safe to try as many
    // times as you like" cost 1 hp per failed roll and killed a player.
    const offenders: string[] = [];
    const inspect = (where: string, label: string, fx: Fx[] | undefined) => {
      const costly = checks(fx).some((c) => c[4].some((f) => f[0] === "hp" && f[1] < 0));
      if (costly && /safe to try|no risk|costs nothing|nothing to lose/i.test(label)) offenders.push(`${where}: "${label}"`);
    };
    for (const [rid, room] of Object.entries(world.rooms))
      for (const a of room.actions ?? []) inspect(`room ${rid} action ${a.id}`, a.label, a.fx);
    for (const [nid, npc] of Object.entries(world.npcs))
      for (const t of npc.topics ?? []) inspect(`npc ${nid} topic ${t.id}`, `ask ${npc.name}: ${t.label}`, t.fx);
    assert.deepEqual(offenders, []);
  });
}

test("vale: asking the elder about the coffer early rewards xp once, and the clue stays available", () => {
  // Regression: both early-coffer topics granted 1 xp on every repeat, so a
  // player could level up indefinitely without leaving the village.
  const vale = worlds.find((w) => w.id === "vale");
  assert.ok(vale, "vale world present");
  let { state } = newState(vale, 1);
  state = step(vale, state, { kind: "classpick", id: "warden" }).state;
  const go = (label: string) => {
    const a = actionByLabel(vale, state, label);
    assert.ok(a, `legal action "${label}" at ${state.room}`);
    state = step(vale, state, a).state;
  };
  for (const l of ["go south", "go south", "go east"]) go(l);
  assert.equal(state.room, "elder_house");
  const before = state.xp;
  go("ask elder: the sealed coffer");
  assert.equal(state.xp, before + 1, "the first ask is rewarded");
  go("ask elder: the sealed coffer");
  go("ask elder: the sealed coffer");
  assert.equal(state.xp, before + 1, "repeats are not");
  assert.ok(actionByLabel(vale, state, "ask elder: the sealed coffer"), "the clue is still on the menu");
  // switching to the seal-in-hand variant does not re-arm the reward either
  state.inv.push("kings_seal");
  state.itemLoc["kings_seal"] = "inv";
  go("ask elder: the sealed coffer");
  assert.equal(state.xp, before + 1);
});

/**
 * A corridor: a room with no action, nobody standing there, and nothing to
 * take, so the only choice is which way to walk. Counted PER CLASS, because
 * that is what a player experiences — an action gated on one class is not an
 * action for the other three, and the class-blind count is the flattering one.
 *
 * The realm went from 211 corridors (23%) to 15 (2%) across ten regions and
 * the seven shared templates, and every region is now under 10% for every
 * class. That held by nobody's arithmetic until this test. `docs/region-brief.md`
 * sets the bar at 15%; this asserts it, with the realm's actual worst region
 * at 6% so the margin is real rather than a number tuned to today.
 */
const CORRIDOR_PCT_MAX = 15;

test("no region is a corridor maze, for any class (region-brief's 15% bar)", () => {
  const reach = worlds.find((w) => w.id === "reach");
  assert.ok(reach, "the realm is in world/");
  const classes = Object.keys(reach.classes ?? {});
  assert.ok(classes.length >= 4, "four classes to count against");

  const peopled = new Set<string>();
  for (const n of Object.values(reach.npcs)) if (n.room) peopled.add(n.room);
  const stocked = new Set<string>();
  for (const it of Object.values(reach.items)) if (it.loc && reach.rooms[it.loc]) stocked.add(it.loc);
  // an action gated on another class is not on offer to this one
  const offeredTo = (a: { if?: unknown[] }, c: string) =>
    ((a.if ?? []) as unknown[]).every(
      (cond) => !Array.isArray(cond) || !((cond[0] === "class" && cond[1] !== c) || (cond[0] === "!class" && cond[1] === c)),
    );

  const worst: { region: string; cls: string; pct: number } = { region: "", cls: "", pct: 0 };
  const rooms = new Map<string, { total: number; bare: Record<string, number> }>();
  for (const [id, room] of Object.entries(reach.rooms)) {
    const r = room.region ?? id.split("_")[0]!;
    const e = rooms.get(r) ?? rooms.set(r, { total: 0, bare: Object.fromEntries(classes.map((c) => [c, 0])) }).get(r)!;
    e.total++;
    for (const c of classes)
      if (!(room.actions ?? []).some((a) => offeredTo(a, c)) && !peopled.has(id) && !stocked.has(id)) e.bare[c]!++;
  }
  for (const [r, e] of rooms) {
    if (e.total < 10) continue; // "party" and "realm" buckets, not places
    for (const c of classes) {
      const pct = (100 * e.bare[c]!) / e.total;
      if (pct > worst.pct) Object.assign(worst, { region: r, cls: c, pct });
    }
  }
  assert.ok(
    worst.pct <= CORRIDOR_PCT_MAX,
    `${worst.region} is ${worst.pct.toFixed(1)}% corridors for a ${worst.cls}, over the brief's ${CORRIDOR_PCT_MAX}% — run scripts/audit-shape.ts --bare`,
  );
});
