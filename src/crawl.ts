/**
 * tinyforge crawler — Tier 1: mechanical, deterministic, zero LLM.
 *
 * Seeded random walks over the real engine, checking invariants every step:
 *   CRASH     step() threw
 *   EMPTYMENU no legal actions while the game is still open
 *   DESYNC    stepping the same state twice gave different hashes (impurity)
 *   BOUNDS    hp/score/turn outside their contracts
 *   HOLE      the rendered turn or status contains "undefined", "null", "NaN",
 *             or "[object Object]" — a missing content field the validator's
 *             reference checks cannot see, printed as-is to the player
 *   OVERCAP   a room offering more of its own options than MENU_CAP — and, as
 *             OVERCAP-SCREEN, a rendered screen wider than SCREEN_CAP. Both
 *             are detailed below, and both are findings at the depth
 *             `npm run verify` runs and printed diagnostics under `--deep`
 * Also replays the walkthrough and prints coverage (rooms seen, endings seen),
 * plus two numbers in every summary line:
 *
 * Four ways to walk it, and coverage is why there is more than one:
 *
 *   (default)         60 uniform random walks from turn zero — the smallest
 *                     share of the Reach of any mode here. The right
 *                     instrument for a bad *state*: it wanders into
 *                     combinations nobody authored.
 *   --sweep           the same walks, biased toward somewhere they have not
 *                     been. Most of a random walk's rooms again for the same
 *                     13 seconds, and a little under twice its reach.
 *   --fork            walks forked off the proven routes every twelfth step,
 *                     so the gates those routes opened stay open. **Half the
 *                     realm in 20 seconds** — three times a random walk — and
 *                     the only mode that reaches real endings, where every
 *                     other mode has only ever reached "dead". In
 *                     `npm run verify`, which prints each mode's live count.
 *   --worst           print the screens, not just their sizes — every screen
 *                     over SCREEN_CAP when any is over, otherwise the widest
 *                     one found. The number says where and not why, and the
 *                     crawler already had the text in hand
 *   --deep            400 walks of 300 steps, or forks every fifth step of
 *                     80: the widest coverage any mode reaches, in about 90
 *                     seconds with --fork. A diagnostic, not part of verify.
 *
 * A room the sweeping walk cannot reach is usually behind a gate — a locked
 * door, a flag, an item, a landmark you must have stood in before travel will
 * take you there. A random walk cannot play well enough to open those and
 * never will; the proven routes already did, which is what --fork is for.
 *
 *   over-cap menus  rooms whose own options (all of them, across the pages a
 *                   crowded room now turns, but not the class abilities that
 *                   ride on top of every room) exceed MENU_CAP. The validator
 *                   already errors on this ("walkthrough: menu hit N > cap"),
 *                   so it is a hard contract — but it could only see the
 *                   walkthrough, and off it `world/vale.json` used to reach
 *                   18 in `square` and 15 in `throne` (no npc there folded
 *                   its topics behind `talk to X` the way the Reach does).
 *                   That landed (vale, lighthouse and reach all read 0 at
 *                   this crawl's default depth), so this is now a FINDING,
 *                   not just a number: a walk that hits the cap fails the
 *                   run. `--deep` still turns up a rare, deep combination in
 *                   `throne` (several endings plus a few carried items'
 *                   `use` entries can co-occur past the cap) — tracked, not
 *                   yet a finding, since the default depth this crawl (and
 *                   `npm run verify`) runs at is clean.
 *   biggest screen  the largest response a walk rendered, as a player would
 *                   see it, and now also a FINDING when it is over SCREEN_CAP
 *                   — the same 1,100 `test/budget.test.ts` holds every proven
 *                   road to, imported from here so the two ceilings cannot
 *                   drift (that file asserts SCREEN_CAP === MAX_CHARS_MAX).
 *
 *                   This was a printed number for a long time, and printed is
 *                   how it stayed broken: the budget test walks the proven
 *                   walkthrough and the ending proofs, so the ~476 rooms no
 *                   proven road renders were measured by nothing, and a walk
 *                   that rendered 1,248 characters in `va_crypt` said so in
 *                   the summary line and exited 0. Every screen over the cap
 *                   is reported, not just the widest — one is rarely alone,
 *                   and the worst room says nothing about whether the next
 *                   four sit at 1,099.
 *
 * Exit 0 = green. `--replay <trace.json>` re-runs a recorded session and
 * prints its receipt (used to verify playtest reports).
 */
import { readFileSync, readdirSync } from "node:fs";
import { actionByLabel, actionLabel, allActions, condOk, legalActions, menuLoad, newState, receipt, sameState, step } from "./engine.ts";
import { render, renderStatus } from "./format.ts";
import { MENU_CAP } from "./types.ts";
import { loadWorld, replayWalkthrough } from "./validate.ts";
import type { Action, State, Trace, World } from "./types.ts";

const HOLE = /\b(?:undefined|null|NaN|\[object Object\])\b/;

/**
 * The per-screen ceiling, in characters — the same 1,100 `test/budget.test.ts`
 * holds every proven road to, and the number AGENT.md states absolutely. It
 * lives here rather than there because the crawler is the only thing that ever
 * sees a screen OFF a proven road, and that test asserts this constant equals
 * its own MAX_CHARS_MAX so the two can never drift apart.
 */
export const SCREEN_CAP = 1100;

/**
 * Rooms allowed to offer more than MENU_CAP, and how many — a named list of
 * exceptions that may only ever shrink, like test/budget.test.ts's PROOF_BUDGET.
 *
 * The cap exists so a turn stays a choice rather than a search, and paging now
 * guarantees that much: a player never sees more than twelve entries whatever
 * the room holds. What the cap is still *for* is stopping an ordinary room
 * from quietly growing to twenty options. A climax where every ending the
 * place offers is chosen is not an ordinary room, and holding it to twelve
 * would be holding the game's depth against it.
 *
 * So a room over the cap has to be argued for here, by name, with its number.
 * Anything not listed is a finding.
 */
const CROWDED: Record<string, number> = {
  // The Vale's barrow throne: two exits, a way back to the village, and every
  // ending the Vale has — the verses, the crown returned, the crown broken,
  // both together, kneeling, walking away with it — each in the variant your
  // oath and your crown have earned. Ten of them can stand at once. Found by
  // the forked crawl, which is the only mode that ever stood there.
  "vale:throne": 13,
};

function walkRng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A walk that prefers somewhere it has not been.
 *
 * The uniform random walk is the right instrument for finding a bad *state* —
 * it wanders into combinations nobody would author — but it is a poor one for
 * finding a bad *room*, because in a realm of 905 rooms it keeps re-treading
 * the ones near the start. Measured: 145 rooms at the default depth and 332 at
 * `--deep`, which leaves two thirds of the realm never rendered by any
 * automated check at all.
 *
 * So `--sweep` biases the same walk toward what it has not seen: an exit into
 * an unvisited room, or a travel entry to an unvisited landmark, is taken over
 * anything else. Everything the crawler checks — crashes, desyncs, holes,
 * empty menus, over-cap loads, screen width — then gets applied to far more of
 * the realm for the same number of steps. It does not replace the uniform
 * walks; a room reached only by a beeline has never been stress-tested, and a
 * state reached only by wandering has never been rendered.
 */
function prefersNew(world: World, s: State, legal: Action[], seen: Set<string>): Action[] {
  const fresh = legal.filter((a) => {
    if (a.kind === "go") { const to = world.rooms[s.room]?.exits?.[a.dir]?.to; return !!to && !seen.has(to); }
    if (a.kind === "travelto") return !seen.has(a.room);
    return false;
  });
  return fresh.length ? fresh : legal;
}

export type CrawlResult = {
  findings: string[];
  roomsSeen: Set<string>;
  endingsSeen: Set<string>;
  steps: number;
  worst: { chars: number; room: string; turn: number; text: string };
  overCap: { count: number; worstN: number; room: string; menu: string };
  /** every room that rendered a screen wider than SCREEN_CAP, worst render kept */
  over: Map<string, { chars: number; turn: number; text: string; hits: number }>;
};
const emptyResult = (): CrawlResult => ({
  findings: [],
  roomsSeen: new Set<string>(),
  endingsSeen: new Set<string>(),
  steps: 0,
  worst: { chars: 0, room: "", turn: 0, text: "" },
  overCap: { count: 0, worstN: 0, room: "", menu: "" },
  over: new Map(),
});

/**
 * One walk, from wherever it is handed, with every check applied at every step.
 *
 * Split out from `crawl` so a walk can begin somewhere other than turn zero:
 * `--fork` starts them from states the proven routes have already reached,
 * which is the only way an automated check ever sees content behind a gate the
 * route opened.
 */
function walkFrom(world: World, start: State, seed: number, maxSteps: number, sweep: boolean, r: CrawlResult, w: string): void {
  const { findings, roomsSeen, endingsSeen, overCap } = r;
  const rnd = walkRng(seed);
  let state = start;
  {
    const seenThisWalk = new Set<string>([state.room]);
    roomsSeen.add(state.room);
    for (let i = 0; i < maxSteps; i++) {
      if (state.ended) { endingsSeen.add(state.ended.id); break; }
      const legal = legalActions(world, state);
      if (!legal.length) { findings.push(`EMPTYMENU walk ${w} turn ${state.turn} room ${state.room}`); break; }
      // the room's own load, not the page showing — a crowded room now turns
      // pages rather than hiding its tail, so the page is always within the cap
      // and it is the load that says whether the room got too crowded to read
      const load = menuLoad(world, state);
      if (load > (CROWDED[`${world.id}:${state.room}`] ?? MENU_CAP)) {
        overCap.count++;
        if (load > overCap.worstN) {
          overCap.worstN = load;
          overCap.room = state.room;
          // the labels, not just the count: an over-cap room reached only by a
          // sweeping walk is awkward to reproduce by hand, and the author
          // needs to know WHICH thirteen things the room was offering
          overCap.menu = allActions(world, state).filter((a) => a.kind !== "ability" && a.kind !== "roommore").map((a) => actionLabel(world, a, state)).join(" | ");
        }
      }
      const pool = sweep ? prefersNew(world, state, legal, roomsSeen) : legal;
      const a = pool[Math.floor(rnd() * pool.length)]!;
      let out;
      try {
        out = step(world, state, a);
        // purity check: same state + same action twice must be identical
        const again = step(world, state, a);
        if (!sameState(out.state, again.state)) {
          findings.push(`DESYNC walk ${w} turn ${state.turn} action ${JSON.stringify(a)}`);
          break;
        }
      } catch (e) {
        findings.push(`CRASH walk ${w} turn ${state.turn} action ${JSON.stringify(a)}: ${String(e)}`);
        break;
      }
      const firstHere = !seenThisWalk.has(out.state.room);
      state = out.state;
      r.steps++;
      seenThisWalk.add(state.room);
      roomsSeen.add(state.room);
      if (state.hp < 0 || state.hp > state.maxHp) findings.push(`BOUNDS hp=${state.hp}/${state.maxHp} walk ${w}`);
      // score has no ceiling: maxScore is what one whole route pays, not a cap
      // (see applyFx's `score` case), so only a negative one is out of bounds
      if (state.score < 0) findings.push(`BOUNDS score=${state.score} walk ${w}`);
      // `full: true` for the hole check, so a first-visit-only desc is searched too
      const full = render(world, state, out.events, { full: true }).text;
      const hole = HOLE.exec(`${full}\n${renderStatus(world, state)}`);
      if (hole) findings.push(`HOLE walk ${w} turn ${state.turn} room ${state.room} action ${JSON.stringify(a)}: "${hole[0]}" in output`);
      // ...and the honest render for the size, the way a player would see it:
      // the long desc only the first time this walk reached the room
      const asPlayed = firstHere ? full : render(world, state, out.events, {}).text;
      if (asPlayed.length > r.worst.chars) r.worst = { chars: asPlayed.length, room: state.room, turn: state.turn, text: asPlayed };
      // ...and every screen over the ceiling, not just the single widest one:
      // "biggest screen 1248" says one room is over and nothing about whether
      // the next four are at 1,247. Worst render per room, with a hit count.
      if (asPlayed.length > SCREEN_CAP) {
        const prev = r.over.get(state.room);
        if (!prev) r.over.set(state.room, { chars: asPlayed.length, turn: state.turn, text: asPlayed, hits: 1 });
        else {
          prev.hits++;
          if (asPlayed.length > prev.chars) { prev.chars = asPlayed.length; prev.turn = state.turn; prev.text = asPlayed; }
        }
      }
    }
  }
}

export function crawl(world: World, walks: number, maxSteps: number, sweep = false): CrawlResult {
  const r = emptyResult();
  for (let w = 0; w < walks && r.findings.length < 20; w++) {
    walkFrom(world, newState(world, w + 1).state, 1000 + w, maxSteps, sweep, r, String(w));
  }
  return r;
}

/**
 * Walks forked off the proven routes.
 *
 * Even a sweeping walk from turn zero reaches 479 of 905 rooms, because most of
 * what is left sits behind a gate — a locked door, a flag, an item, a landmark
 * you must have stood in before travel will take you there. A random walk
 * cannot play well enough to open those, and never will.
 *
 * The proven routes already opened them. So: replay each of them, and every
 * `every` steps fork a short walk off the state it has reached. Everything the
 * crawler checks then gets applied to the content those routes pass *near*
 * rather than only the rooms they step in, with the gates already open.
 */
export function crawlForks(world: World, every: number, forkSteps: number, sweep = true): CrawlResult {
  const r = emptyResult();
  const routes: [string, World["walkthrough"]][] = [
    ["walkthrough", world.walkthrough],
    ...Object.entries(world.proofs ?? {}).map(([k, v]) => [k, v] as [string, World["walkthrough"]]),
  ];
  let forks = 0;
  for (const [name, steps] of routes) {
    let { state } = newState(world, 1);
    let n = 0;
    const doLabel = (label: string): boolean => {
      const a = actionByLabel(world, state, label);
      if (!a) { r.findings.push(`FORKROUTE ${name}: no action "${label}" in ${state.room}`); return false; }
      state = step(world, state, a).state;
      r.roomsSeen.add(state.room);
      if (++n % every === 0 && !state.ended && r.findings.length < 20) {
        walkFrom(world, state, 7000 + forks, forkSteps, sweep, r, `${name}+${n}`);
        forks++;
      }
      return true;
    };
    for (const w of steps) {
      if (typeof w === "string") { if (!doLabel(w)) break; }
      else { let k = 0; while (!condOk(world, state, w.until) && k++ < w.max && !state.ended) if (!doLabel(w.repeat)) break; }
      if (state.ended) break;
    }
  }
  // Not `r.steps += forks`: walkFrom already counts every action each fork
  // executes, so adding the fork count again put one phantom step per fork into
  // the number every coverage and performance comparison is read off.
  return r;
}

/**
 * Every screen a walk rendered wider than SCREEN_CAP, as one finding — or null
 * when the run was clean. Exported so the promotion itself is testable: a
 * finding that only exists inside the CLI block is a finding nothing can prove
 * still fires.
 */
export function overCapReport(worldId: string, r: CrawlResult): string | null {
  if (!r.over.size) return null;
  const rooms = [...r.over].sort((a, b) => b[1].chars - a[1].chars);
  const screens = [...r.over.values()].reduce((n, o) => n + o.hits, 0);
  return (
    `OVERCAP-SCREEN ${worldId}: ${rooms.length} room${rooms.length === 1 ? "" : "s"} rendered a screen over ${SCREEN_CAP} (${screens} screen${screens === 1 ? "" : "s"} in all)\n      ` +
    rooms.map(([room, o]) => `${room} ${o.chars}${o.hits > 1 ? ` (x${o.hits})` : ""}`).join(", ") +
    `\n      re-run with --worst to read them`
  );
}

export function replayTrace(world: World, trace: Trace): string {
  let { state } = newState(world, trace.seed);
  for (const a of trace.actions) state = step(world, state, a).state;
  return receipt(world, state);
}

// ---------- CLI ----------
if (process.argv[1]?.endsWith("crawl.ts")) {
  const args = process.argv.slice(2);

  if (args.includes("--replay")) {
    const tracePath = args[args.indexOf("--replay") + 1]!;
    const trace = JSON.parse(readFileSync(tracePath, "utf8")) as Trace;
    // the same world selection every entry point uses; a trace names its world
    // id, which is the default file name under world/
    const world = loadWorld(process.env.TF_WORLD ?? `world/${trace.world}.json`);
    console.log(replayTrace(world, trace));
    process.exit(0);
  }

  const explicit = args.find((a) => a.endsWith(".json") && !a.includes("runs/"));
  const paths = explicit
    ? [explicit]
    : readdirSync("world").filter((f) => f.endsWith(".json")).map((f) => `world/${f}`);
  const deep = args.includes("--deep");
  const sweep = args.includes("--sweep");
  const fork = args.includes("--fork");
  const walks = deep ? 400 : 60;
  const maxSteps = deep ? 300 : 120;
  let bad = 0;
  for (const p of paths) {
    const world = loadWorld(p);
    const t0 = Date.now();
    const r = fork ? crawlForks(world, deep ? 5 : 12, deep ? 80 : 40) : crawl(world, walks, maxSteps, sweep);
    const wt = replayWalkthrough(world, 1);
    if (wt.error) r.findings.push(`WALKTHROUGH ${wt.error}`);
    // a hard finding, not just a number, at this default depth — the one
    // `npm run verify` actually runs, and the one every shipped world is
    // clean at. `--deep` still turns up a rare, deep `throne` combination in
    // `world/vale.json` (see header), so it stays a diagnostic run: informing,
    // never failing, until that is closed too. Screen width follows the same
    // rule now, one line down.
    if (r.overCap.count && !deep) r.findings.push(`OVERCAP ${world.id}: ${r.overCap.count} steps over cap, worst ${r.overCap.worstN} in ${r.overCap.room}\n      ${r.overCap.menu}`);
    // A screen over SCREEN_CAP is a FINDING at the depth `npm run verify` runs,
    // which is what this change is for: `va_crypt` rendered 1,248 characters off
    // every proven road for as long as this was a printed number, and 476 rooms
    // no proven road renders could carry anything at all.
    //
    // `--deep` keeps it informational, the same nuance and for the same reason
    // as over-cap menus above: the deeper modes still turn up screens nobody has
    // brought down yet, and a diagnostic that is permanently red teaches people
    // to stop running it. At the time this landed, with va_crypt, mg_watch_house_cells,
    // fd_drowned_nave and hb_keepers_hall cut, `--deep --fork` still reads
    // va_throne 1351, th_hollow_glade 1207, mg_old_crypts 1156, mc_orchards_2_3
    // 1144, va_crypt 1141, kw_saint_chapel_nave 1127, mc_orchards_4_3 1116 and
    // hl_fields_3_1 1107, and `--deep --sweep` 18 rooms of its own (worst 1329,
    // hb_toll_fire). Every one that was read is content stacking on a single
    // turn — va_throne's 1351 is an ending's own prose, two companions' answers,
    // a departure and four journal lines all landing together, none of them said
    // twice — which is the shape item 8 in the order describes. That is the list to
    // work down; there is no allowlist here and there must never be one, because
    // a named exception is how an over-cap screen stops being a finding at the
    // depth that matters too.
    const overMsg = overCapReport(world.id, r);
    if (overMsg) {
      if (deep) console.log(`  … ${overMsg}\n      (deep: printed, not a finding — see the comment in crawl.ts)`);
      else r.findings.push(overMsg);
    }
    const rooms = Object.keys(world.rooms).length;
    console.log(
      `crawl ${world.id}${fork ? " (forked off the proven routes)" : sweep ? " (sweeping)" : ""}: ${fork ? "" : `${walks} walks, `}${r.steps} steps, ${Date.now() - t0}ms | rooms ${r.roomsSeen.size}/${rooms} | endings seen: ${[...r.endingsSeen].join(",") || "none"} | biggest screen ${r.worst.chars} (${r.worst.room || "-"}) | over-cap menus ${r.overCap.count}${r.overCap.count ? ` (worst ${r.overCap.worstN} in ${r.overCap.room})` : ""} | walkthrough: ${wt.error ?? `win in ${wt.turns}t`}`,
    );
    // `--worst` prints the widest screen it actually found, because "biggest
    // screen 1424 (va_throne)" says where and not why, and every investigation
    // that number starts otherwise begins with guessing at the state that
    // produced it. The crawler already had the text in hand.
    if (args.includes("--worst") && r.worst.text) {
      // every over-cap screen when there are any, since one is rarely alone and
      // "the widest" alone hides whether the rest are at 1,099 or 1,098
      const show = r.over.size
        ? [...r.over].sort((a, b) => b[1].chars - a[1].chars).map(([room, o]) => ({ room, ...o }))
        : [{ room: r.worst.room, chars: r.worst.chars, turn: r.worst.turn, text: r.worst.text, hits: 1 }];
      for (const o of show) {
        console.log(`\n  --- ${o.chars} chars in ${o.room} on turn ${o.turn}${o.hits > 1 ? ` (${o.hits} such screens)` : ""} ---`);
        for (const line of o.text.split("\n")) console.log(`  ${line}`);
      }
      console.log();
    }
    if (r.findings.length) {
      bad++;
      for (const f of r.findings) console.error(`  ✗ ${f}`);
    }
  }
  process.exit(bad ? 1 : 0);
}
