/**
 * What a blind player actually did — read off their own trace, not their report.
 *
 * A playtest report says what a player noticed. The trace says what they did,
 * and the two are different enough to matter: three players who all rated the
 * realm 5/5 for fun had also, between them, walked eight of eighteen regions,
 * rested every hold they reached and bargained or burned nothing, collected two
 * of twelve faction ranks, and pressed one of nine class abilities. None of that
 * is in a report, and all of it is in the trace.
 *
 * The MCP server writes one trace per session to `runs/<id>.json` (see
 * `src/mcp.ts`): the seed and the exact action list. Replaying it through the
 * real engine gives the finished state and, step by step, every menu the player
 * was looking at when they chose — which is what separates "never chosen" from
 * "never even offered".
 *
 *   npx tsx scripts/audit-play.ts world/reach.json runs/g1-716-*.json …
 *   npx tsx scripts/audit-play.ts world/reach.json            # every trace in runs/
 *
 * The engine moves under these files. A trace captured before a content change
 * may replay to somewhere else, or stop being legal partway; the tool says so
 * per trace rather than pretending. That is not a bug in the trace — it is the
 * cost of reading old play against new content, and worth knowing.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { legalActions, newState, step } from "../src/engine.ts";
import { loadWorld } from "../src/validate.ts";
import type { Action, State, World } from "../src/types.ts";

process.stdout.on("error", (e: NodeJS.ErrnoException) => { if (e.code === "EPIPE") process.exit(0); });

const [path, ...rest] = process.argv.slice(2);
if (!path) {
  console.error("usage: npx tsx scripts/audit-play.ts <world.json> [trace.json …]");
  process.exit(2);
}
const world: World = loadWorld(path);
const traces = rest.length
  ? rest
  : readdirSync("runs")
      .filter((f) => f.endsWith(".json"))
      .map((f) => join("runs", f));
if (!traces.length) {
  console.error("no traces: pass some, or play a session so the server writes one to runs/");
  process.exit(2);
}

type Row = {
  file: string;
  seed: number;
  turns: number;
  ending: string;
  classId: string;
  score: number;
  rooms: number;
  regions: string[];
  rested: number;
  bargained: number;
  burned: number;
  party: string[];
  regard: [string, number][];
  standing: [string, number][];
  ranks: string[];
  kinds: Map<string, number>;
  offered: Map<string, number>;
  pressed: Map<string, number>;
  perks: string[];
  attackable: number;
  illegal: number;
  stopped: string;
};

const bump = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

function read(file: string): Row | null {
  let t: { seed?: number; actions?: Action[] };
  try {
    t = JSON.parse(readFileSync(file, "utf8")) as { seed?: number; actions?: Action[] };
  } catch {
    return null;
  }
  if (typeof t.seed !== "number" || !Array.isArray(t.actions)) return null;
  let { state } = newState(world, t.seed);
  const kinds = new Map<string, number>(), offered = new Map<string, number>(), pressed = new Map<string, number>();
  const perks: string[] = [];
  let attackable = 0, illegal = 0, stopped = "";
  for (const [i, a] of t.actions.entries()) {
    const menu = legalActions(world, state);
    for (const l of menu) if (l.kind === "ability") bump(offered, l.id);
    if (menu.some((l) => l.kind === "attack")) attackable++;
    bump(kinds, a.kind);
    if (a.kind === "ability") bump(pressed, a.id);
    if (a.kind === "perkpick") perks.push(a.id);
    const before: State = state;
    const out = step(world, state, a);
    if (out.state === before && out.events[0]?.startsWith("Illegal")) {
      illegal++;
      if (!stopped) stopped = `action ${i + 1} of ${t.actions.length} is no longer legal in ${state.room} (${JSON.stringify(a).slice(0, 60)})`;
    }
    state = out.state;
    if (state.ended) break;
  }
  const flags = Object.keys(state.flags);
  const count = (re: RegExp) => flags.filter((f) => re.test(f)).length;
  const regions = [...new Set(state.visited.map((r) => world.rooms[r]?.region).filter((x): x is string => !!x))].sort();
  const vars = (prefix: string): [string, number][] =>
    Object.entries(state.vars)
      .filter(([v]) => v.startsWith(prefix))
      .map(([v, n]) => [v.slice(prefix.length), n] as [string, number])
      .sort((a, b) => b[1] - a[1]);
  return {
    file,
    seed: t.seed,
    turns: state.turn,
    ending: state.ended?.id ?? "open",
    classId: state.classId ?? "-",
    score: state.score,
    rooms: state.visited.length,
    regions,
    rested: count(/_hollow_rested$/),
    bargained: count(/_hollow_bargained$/),
    burned: count(/_hollow_burned$/),
    party: state.party.map((id) => world.npcs[id]?.name ?? id),
    regard: vars("appr_"),
    standing: vars("rep_"),
    ranks: flags.filter((f) => /_(trusted|sworn)$/.test(f)).sort(),
    kinds,
    offered,
    pressed,
    perks,
    attackable,
    illegal,
    stopped,
  };
}

const rows = traces.map(read).filter((r): r is Row => !!r).sort((a, b) => a.seed - b.seed);
if (!rows.length) {
  console.error(`none of ${traces.length} file(s) is a trace (a trace carries "seed" and "actions" — runs/playtest/ holds session metadata, not traces)`);
  process.exit(2);
}

const roomTotal = Object.keys(world.rooms).length;
const regionTotal = new Set(Object.values(world.rooms).map((r) => r.region).filter(Boolean)).size;
console.log(`${path} — ${world.id}: ${rows.length} trace(s) replayed against the world as it stands now\n`);
for (const r of rows) {
  console.log(`=== seed ${r.seed}  ${r.file}`);
  console.log(`  ${r.ending === "open" ? "did not finish" : r.ending}  turn ${r.turns}  ${r.classId}  score ${r.score}`);
  console.log(`  rooms ${r.rooms}/${roomTotal}   regions ${r.regions.length}/${regionTotal} [${r.regions.join(" ")}]`);
  console.log(`  holds: ${r.rested} rested, ${r.bargained} bargained, ${r.burned} burned`);
  console.log(`  party ${r.party.join(", ") || "(alone)"}`);
  console.log(`  regard   ${r.regard.map(([k, n]) => `${k} ${n > 0 ? "+" : ""}${n}`).join("  ") || "(none)"}`);
  console.log(`  standing ${r.standing.map(([k, n]) => `${k} ${n > 0 ? "+" : ""}${n}`).join("  ") || "(none)"}`);
  console.log(`  ranks    ${r.ranks.join(", ") || "(none)"}`);
  console.log(`  perks    ${r.perks.join(", ") || "(none)"}`);
  console.log(`  turns with something to attack: ${r.attackable}`);
  if (r.illegal) console.log(`  !! ${r.illegal} action(s) no longer legal — ${r.stopped}`);
}

const total = (pick: (r: Row) => Map<string, number>) => {
  const m = new Map<string, number>();
  for (const r of rows) for (const [k, n] of pick(r)) m.set(k, (m.get(k) ?? 0) + n);
  return m;
};
console.log(`\nwhat they pressed, all traces:`);
for (const [k, n] of [...total((r) => r.kinds).entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(6)}  ${k}`);

const offered = total((r) => r.offered), pressed = total((r) => r.pressed);
const ids = Object.keys(world.abilities ?? {});
if (ids.length) {
  console.log(`\nabilities — offered is the count of menus it stood on, which is what tells "never chosen" from "never shown":`);
  for (const id of ids) {
    const o = offered.get(id) ?? 0, p = pressed.get(id) ?? 0;
    const note = o === 0 ? "  never once offered" : p === 0 ? "  offered and never taken" : "";
    console.log(`  ${id.padEnd(20)} offered ${String(o).padStart(5)}  pressed ${String(p).padStart(4)}${note}`);
  }
}

// the two numbers this tool exists for
const seenRooms = new Set(rows.flatMap((r) => r.regions));
const fates = rows.reduce((a, r) => ({ rested: a.rested + r.rested, bargained: a.bargained + r.bargained, burned: a.burned + r.burned }), { rested: 0, bargained: 0, burned: 0 });
const diverged = rows.filter((r) => r.illegal);
if (diverged.length) {
  console.log(
    `\n${diverged.length} of ${rows.length} trace(s) stopped replaying partway: the world moved under them, so their ` +
      `numbers above are what happened up to that point and the totals below are short by whatever came after. ` +
      `Re-measure on a fresh wave rather than trusting an old trace against new content.`,
  );
}
console.log(
  `\n${seenRooms.size} of ${regionTotal} regions were touched by ${diverged.length ? "the parts of these runs that still replay" : "any of these runs"}, and their holds ended ` +
    `${fates.rested} rested, ${fates.bargained} bargained, ${fates.burned} burned. A fate nobody picks is not a choice; ` +
    `a region nobody enters is not content.`,
);
process.exit(0);
