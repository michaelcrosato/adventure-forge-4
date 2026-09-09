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
  // player could level up indefinitely without leaving the village. The elder
  // now folds behind "talk to" (conversation mode), so the topic is reached
  // by opening the conversation once and re-picking the topic inside it.
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
  go("talk to elder");
  const before = state.xp;
  go("the sealed coffer");
  assert.equal(state.xp, before + 1, "the first ask is rewarded");
  go("the sealed coffer");
  go("the sealed coffer");
  assert.equal(state.xp, before + 1, "repeats are not");
  assert.ok(actionByLabel(vale, state, "the sealed coffer"), "the clue is still on the menu");
  // switching to the seal-in-hand variant does not re-arm the reward either
  state.inv.push("kings_seal");
  state.itemLoc["kings_seal"] = "inv";
  go("the sealed coffer");
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

/**
 * No hold ranks its three fates by score.
 *
 * Every hold can be laid to rest, bargained with, or burned — thirty routes
 * behind the two that are not "rest" — and three blind players ran the realm
 * end to end and chose rest **24 times out of 24**. `scripts/audit-fates.ts`
 * said why without needing an argument: score ranked the fates identically in
 * all fifteen holds, rest +25, bargain +20, burn +15, and rest also carried
 * the friendliest standing and the only companion approvals.
 *
 * A fate that pays less for the same deed is not a choice. What separates them
 * now is what each pays *instead* — standing, regard, and an ending that reads
 * it — and that is the part a test cannot check. This checks the part it can:
 * the number is the same whichever road you take the deed by.
 */
test("a hold's fates pay the same score, whichever road the deed is done by", () => {
  const world = loadWorld("world/reach.json");
  const codes = new Set<string>();
  for (const id of Object.keys(world.rooms)) { const m = /^([a-z]{2})_/.exec(id); if (m) codes.add(m[1]!); }
  const setsFlag = (fxs: Fx[] | undefined, want: string): boolean => {
    for (const f of fxs ?? []) {
      if (f[0] === "set" && f[1] === want) return true;
      if (f[0] === "if" && (setsFlag(f[2], want) || setsFlag(f[3], want))) return true;
      if (f[0] === "check" && (setsFlag(f[3], want) || setsFlag(f[4], want))) return true;
      if (f[0] === "chance" && (setsFlag(f[2], want) || setsFlag(f[3], want))) return true;
    }
    return false;
  };
  const scoreOf = (fxs: Fx[] | undefined, n = 0): number => {
    for (const f of fxs ?? []) {
      if (f[0] === "score") n += Number(f[1]);
      else if (f[0] === "if") n = scoreOf(f[2], n);
      else if (f[0] === "check") n = scoreOf(f[3], n);
      else if (f[0] === "chance") n = scoreOf(f[2], n);
    }
    return n;
  };
  let holds = 0;
  for (const code of [...codes].sort()) {
    const best: Record<string, number> = {};
    for (const fate of ["rested", "bargained", "burned"]) {
      const flag = `${code}_hollow_${fate}`;
      for (const [rid, r] of Object.entries(world.rooms)) {
        if (!rid.startsWith(`${code}_`)) continue;
        for (const a of r.actions ?? []) {
          if (!setsFlag(a.fx, flag)) continue;
          best[fate] = Math.max(best[fate] ?? -Infinity, scoreOf(a.fx));
        }
      }
      // Conversations too. Both this test and scripts/audit-fates.ts scanned
      // only room actions, and five holds settle their grief in an npc's topic
      // instead — so both printed a clean bar while those five paid +20 for a
      // bargain against +25 for a rest, which is the one thing they exist to
      // catch. The flag is what ties a topic to its hold; the npc may stand
      // anywhere.
      for (const npc of Object.values(world.npcs)) {
        for (const t of npc.topics ?? []) {
          if (!setsFlag(t.fx, flag)) continue;
          best[fate] = Math.max(best[fate] ?? -Infinity, scoreOf(t.fx));
        }
      }
    }
    const pays = Object.entries(best);
    if (pays.length < 2) continue;
    holds++;
    const first = pays[0]![1];
    for (const [fate, n] of pays)
      assert.equal(n, first, `${code}: ${fate} pays ${n} where ${pays[0]![0]} pays ${first} — a fate that pays less for the same deed is not a choice (npx tsx scripts/audit-fates.ts world/reach.json)`);
  }
  assert.ok(holds >= 15, `the realm should have fifteen holds with more than one fate, found ${holds}`);
});

/**
 * A hold's grief says where it is.
 *
 * Wave eight, seed 9901 — a blind player who won and rated it fun 5/5 —
 * finished two of the Hearthlands' side quests and never found the hold's
 * grief at all: "Hearthlands/Tithing never exposed an explicit 'settle this
 * hold's grief' action/location the way every other hold did... the 'Hollows
 * rested' counter never incremented for it." The site exists and pays like
 * every other hold's (`scripts/audit-fates.ts`: hl rests, bargains and burns
 * for 25 each, at the threshing floor). Nothing pointed at it: `hl_q_due` and
 * `hl_q_order` are the hold's two critical-path quests and neither named a
 * room, while five of its side quests did. The player followed the signposted
 * content, and all of the signposted content was optional.
 *
 * So: the stage a player reads before a hold-grief quest has moved must name
 * the room they are meant to reach. The list below is the debt as it stood
 * when this test was written, and it may only shrink — an entry that has
 * gained an `at` is a line to delete, and a quest not on the list that loses
 * one fails.
 */
test("reach: a hold-grief quest's default stage names the room it points at", () => {
  const world = worlds.find((w) => w.id === "reach")!;
  const UNPOINTED = new Set([
    "em_q_keeper", "em_q_choir", "fd_q_congregation", "fd_q_ironbound", "ff_q_sent_for", "ff_q_lesson",
    "ff_q_wardlands", "fl_q_names", "hl_q_due", "hl_q_order", "kw_q_round", "kw_q_horn", "mc_q_prepare",
    "mc_q_order", "mc_q_orchard", "me_q_witness", "pw_q_dies", "pw_q_names", "sh_q_truce_words",
    "sh_q_rod", "th_q_pardon",
  ]);
  const pointless: string[] = [];
  const fixed: string[] = [];
  for (const [qid, q] of Object.entries(world.quests ?? {})) {
    // a hold's grief path: its start, done or failed reads one of the hold's own `<code>_hollow_*` flags
    if (!/_hollow_/.test(JSON.stringify([q.start, q.done, q.failed]))) continue;
    // the line shown before anything has happened is the first unconditioned stage
    const def = q.stages.find((st) => (st.if ?? []).length === 0);
    if (!def) continue; // every stage gated: there is no "before it moves" line to fix
    if (!def.at && !UNPOINTED.has(qid)) pointless.push(qid);
    if (def.at && UNPOINTED.has(qid)) fixed.push(qid);
  }
  assert.deepEqual(
    pointless,
    [],
    `a hold's grief must say where it is — give the default stage an \`at\`:\n  ${pointless.join("\n  ")}`,
  );
  assert.deepEqual(fixed, [], `these point somewhere now — drop them from UNPOINTED:\n  ${fixed.join("\n  ")}`);
});
