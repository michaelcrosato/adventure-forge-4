/**
 * Choice-consequence audit for authors and reviewers. A choice that matters is
 * a flag set by something the player chose (a room action, a topic, an item
 * use) that the world reads back somewhere else: another room's variant or
 * exit, another npc's topic, a quest, the epilogue, a companion's remark, a
 * status track. Loads a world (root file, parts included, regions and stamps
 * expanded) and prints:
 *
 *   - per region prefix: player-set flags, how many are read back outside
 *     the place that set them, how many are read in another region, how many
 *     reach the epilogue
 *   - "choices nobody remembers": player-set flags read nowhere but where
 *     they were set (the fork's branch the world forgets)
 *   - with --all: every player-set flag and everywhere it is read
 *
 *   node --import tsx scripts/audit-choices.ts world/reach.json [--prefix fd] [--all]
 */
import { loadWorld } from "../src/validate.ts";
import type { Cond, Fx, World } from "../src/types.ts";

const [path, ...rest] = process.argv.slice(2);
if (!path) { console.error("usage: node --import tsx scripts/audit-choices.ts <world.json> [--prefix xx] [--all]"); process.exit(2); }
const only = rest.includes("--prefix") ? rest[rest.indexOf("--prefix") + 1]! : null;
const all = rest.includes("--all");
const world: World = loadWorld(path);

const prefixOf = (id: string) => id.split("_")[0] ?? "";
const want = (id: string) => !only || prefixOf(id) === only;
/** Flags the engine writes for its own bookkeeping, or that stand for a visit rather than a choice. */
const auto = (flag: string) =>
  /^(did_|said_|remarked_|_)/.test(flag) || /_lit$/.test(flag);

type Origin = { kind: string; container: string; label: string };
type Setter = Origin & { flag: string; chosen: boolean };
const setters: Setter[] = [];
const readers = new Map<string, Origin[]>();
const read = (flag: string, o: Origin) => { (readers.get(flag) ?? readers.set(flag, []).get(flag)!).push(o); };
/** Counters a branch adds to (`addvar`), by branch label: a branch that feeds a counter the world reads is remembered through it. */
const counters = new Map<string, Set<string>>();
const varReads = new Map<string, Origin[]>();
/**
 * Standings and tallies, both directions: how far the world can move each one
 * (`addvar`/`setvar`) against which thresholds it ever reads back. A standing
 * a hundred deeds can raise, read only at +2, is a promise the world does not
 * keep — every deed past the second one changes nothing.
 */
type VarMoves = { ups: number; upSum: number; downs: number; downSum: number; sets: number };
const varMoves = new Map<string, VarMoves>();
const moveOf = (v: string) => varMoves.get(v) ?? varMoves.set(v, { ups: 0, upSum: 0, downs: 0, downSum: 0, sets: 0 }).get(v)!;
const varThresholds = new Map<string, Map<string, number>>();
/** Vars the player is merely SHOWN — a status tally, a hud counter, a path's number — as against read by a condition. */
const varShown = new Set<string>();
const thresholdOf = (v: string) => varThresholds.get(v) ?? varThresholds.set(v, new Map()).get(v)!;

const walkCond = (conds: Cond[] | undefined, o: Origin) => {
  for (const c of conds ?? []) {
    if (c[0] === "flag" || c[0] === "!flag") read(c[1], o);
    else if (c[0] === "var") {
      (varReads.get(c[1]) ?? varReads.set(c[1], []).get(c[1])!).push(o);
      const key = `${c[2]}${c[3]}`;
      thresholdOf(c[1]).set(key, (thresholdOf(c[1]).get(key) ?? 0) + 1);
    }
    else if (c[0] === "any") walkCond(c[1], o);
  }
};
/** Effects: `set` records a setter; `addvar` a counter fed; conditions inside `if` are reads. */
const walkFx = (fxs: Fx[] | undefined, o: Origin, chosen: boolean) => {
  for (const fx of fxs ?? []) {
    switch (fx[0]) {
      case "set": setters.push({ ...o, flag: fx[1], chosen }); break;
      case "addvar": // coin is a price, not a memory; standing, regard and tallies are
        if (chosen && fx[1] !== "gold") (counters.get(o.label) ?? counters.set(o.label, new Set()).get(o.label)!).add(fx[1]);
        if (fx[2] > 0) { const m = moveOf(fx[1]); m.ups += 1; m.upSum += fx[2]; }
        else if (fx[2] < 0) { const m = moveOf(fx[1]); m.downs += 1; m.downSum += fx[2]; }
        break;
      case "setvar": moveOf(fx[1]).sets += 1; break;
      case "if": walkCond(fx[1], o); walkFx(fx[2], o, chosen); walkFx(fx[3], o, chosen); break;
      case "check": walkFx(fx[3], o, chosen); walkFx(fx[4], o, chosen); break;
      case "chance": walkFx(fx[2], o, chosen); walkFx(fx[3], o, chosen); break;
    }
  }
};

for (const [rid, r] of Object.entries(world.rooms)) {
  walkFx(r.onEnter, { kind: "room enter", container: rid, label: r.name }, false);
  walkFx(r.onEnterOnce, { kind: "room enter", container: rid, label: r.name }, false);
  for (const v of r.variants ?? []) walkCond(v.if, { kind: "room variant", container: rid, label: r.name });
  for (const [dir, e] of Object.entries(r.exits ?? {})) walkCond(e.if, { kind: "exit", container: rid, label: `${r.name} ${dir}` });
  for (const a of r.actions ?? []) {
    const o = { kind: "action", container: rid, label: `${r.name}: ${a.label}` };
    walkCond(a.if, o);
    walkFx(a.fx, o, true);
  }
}
for (const [nid, n] of Object.entries(world.npcs)) {
  for (const t of n.topics ?? []) {
    const o = { kind: "topic", container: nid, label: `${n.name}: ${t.label}` };
    walkCond(t.if, o);
    walkFx(t.fx, o, true);
  }
  walkFx(n.onDeath, { kind: "death", container: nid, label: n.name }, false);
  for (const rm of n.companion?.remarks ?? []) {
    const o = { kind: "remark", container: nid, label: `${n.name} remarks` };
    walkCond(rm.if, o);
    // a remark's own effects set flags (every quarrel_* in the realm is set here)
    walkFx((rm as { fx?: Fx[] }).fx, o, true);
  }
  for (const lv of n.companion?.leaves ?? []) walkCond(lv.if, { kind: "leaves", container: nid, label: `${n.name} leaves` });
}
for (const [iid, it] of Object.entries(world.items)) {
  for (const u of it.use ?? []) {
    const o = { kind: "use", container: iid, label: `use ${it.name}` };
    walkCond(u.if, o);
    walkFx(u.fx, o, true);
  }
  for (const v of it.variants ?? []) walkCond(v.if, { kind: "item hint", container: iid, label: it.name });
}
for (const [qid, q] of Object.entries(world.quests ?? {})) {
  const o = { kind: "quest", container: qid, label: q.name };
  walkCond(q.start, o); walkCond(q.done, o); walkCond(q.failed, o);
  for (const st of q.stages ?? []) walkCond(st.if, o);
}
// `world.clock` concatenates from the part files, so a scheduled event is a
// region author's content — and it both reads flags and sets them. Missing it
// made the Ironbound march's own `iron_march` report as a gate with no key on
// the very day the march landed: the flag is set by a clock entry and nothing
// else, which this walk could not see.
for (const entry of world.clock ?? []) {
  const o = { kind: "clock", container: "clock", label: entry.id };
  walkCond(entry.if, o);
  walkFx(entry.fx, o, true);
}
for (const ep of world.epilogue ?? []) walkCond(ep.if, { kind: "epilogue", container: "epilogue", label: ep.text.slice(0, 40) });
for (const tr of world.statusTracks ?? []) {
  walkCond(tr.if, { kind: "status", container: "status", label: tr.label });
  varShown.add(tr.var);
}
if (world.progress) varShown.add(world.progress.var);
for (const h of world.hud ?? []) varShown.add(h.var);
for (const p of world.statusPaths ?? []) {
  const o = { kind: "status", container: "status", label: p.label };
  walkCond(p.if, o);
  // a path's states are where a standing is actually read — walking only p.if
  // undercounted every faction's reads to zero
  for (const st of p.states ?? []) walkCond(st.if, o);
  if (p.var) varShown.add(p.var);
}
if (Array.isArray(world.objectives)) for (const ob of world.objectives) walkCond(ob.if, { kind: "objectives", container: "status", label: "recap" });

// ---- roll up per flag ----
type Row = { flag: string; setBy: Setter[]; reads: Origin[]; outside: Origin[]; elsewhere: Origin[]; epilogue: boolean };
const rows = new Map<string, Row>();
for (const s of setters) {
  if (!s.chosen || auto(s.flag)) continue;
  const row = rows.get(s.flag) ?? { flag: s.flag, setBy: [], reads: [], outside: [], elsewhere: [], epilogue: false };
  row.setBy.push(s);
  rows.set(s.flag, row);
}
for (const row of rows.values()) {
  const containers = new Set(row.setBy.map((s) => s.container));
  const regions = new Set(row.setBy.map((s) => prefixOf(s.container)));
  row.reads = readers.get(row.flag) ?? [];
  // a branch that feeds a counter (crypts robbed, hollows rested) is remembered wherever the counter is read
  for (const st of row.setBy)
    for (const v of counters.get(st.label) ?? [])
      for (const o of varReads.get(v) ?? []) if (!containers.has(o.container)) row.reads.push({ ...o, kind: `${o.kind} (via ${v})` });
  row.outside = row.reads.filter((o) => !containers.has(o.container));
  row.elsewhere = row.outside.filter((o) => !regions.has(prefixOf(o.container)) && !["epilogue", "status"].includes(o.container));
  row.epilogue = row.reads.some((o) => o.kind === "epilogue");
}

const byRegion = new Map<string, Row[]>();
for (const row of rows.values()) {
  const region = prefixOf(row.setBy[0]!.container);
  if (!want(region)) continue;
  (byRegion.get(region) ?? byRegion.set(region, []).get(region)!).push(row);
}

const pad = (s: string | number, n: number) => String(s).padStart(n);
console.log(`region  choices  remembered  elsewhere  epilogue  forgotten`);
let forgotten: Row[] = [];
for (const [region, list] of [...byRegion.entries()].sort()) {
  const remembered = list.filter((r) => r.outside.length > 0);
  const lost = list.filter((r) => r.outside.length === 0);
  forgotten.push(...lost);
  console.log(`${region.padEnd(6)} ${pad(list.length, 8)} ${pad(remembered.length, 11)} ${pad(list.filter((r) => r.elsewhere.length > 0).length, 10)} ${pad(list.filter((r) => r.epilogue).length, 9)} ${pad(lost.length, 10)}`);
}
console.log();
/**
 * A fork: the place (room or npc) offers several branches (distinct actions or
 * topics) and this flag is set by some of them, not all, so it tells the
 * branches apart. A flag every branch sets (the fork's done-marker), one set by
 * a single branch, or one reached by several routes to the same result, is a gate.
 */
const branches = new Map<string, Map<string, Set<string>>>(); // container -> branch label -> flags it sets
for (const row of rows.values()) for (const s of row.setBy) {
  const per = branches.get(s.container) ?? branches.set(s.container, new Map()).get(s.container)!;
  (per.get(s.label) ?? per.set(s.label, new Set()).get(s.label)!).add(row.flag);
}
const isFork = (r: Row) => r.setBy.some((s) => {
  const per = [...(branches.get(s.container)?.values() ?? [])];
  return per.length > 1 && !per.every((set) => set.has(r.flag));
});
if (forgotten.length) {
  const forks = forgotten.filter(isFork).sort((a, b) => a.flag.localeCompare(b.flag));
  const gates = forgotten.filter((r) => !isFork(r)).sort((a, b) => a.flag.localeCompare(b.flag));
  const show = (r: Row) => {
    const by = [...new Set(r.setBy.map((s) => `${s.kind} "${s.label}"`))].join("; ");
    console.log(`  ${r.flag}  <- ${by}${r.reads.length ? `  (read only there, ${r.reads.length}x)` : "  (never read)"}`);
  };
  console.log(`forks the world forgets (${forks.length}) — one branch of a choice among others, read nowhere but where it was made:`);
  for (const r of forks) show(r);
  console.log();
  console.log(`gates read only where they stand (${gates.length}) — one flag opened by several routes, a fork's done-marker, or a single path; fine unless it was meant to matter:`);
  for (const r of gates) show(r);
} else console.log("every choice is remembered somewhere");

/**
 * Content nobody can reach: a flag read by a condition that nothing ever sets.
 * The mirror image of a forgotten choice, and a worse bug — a forgotten choice
 * happened and was ignored, this one cannot happen at all. The engine writes
 * several flags itself, so those are not holes; anything else read and never
 * written is a gate with no key.
 */
{
  const written = new Set<string>(setters.map((s) => s.flag));
  // flags the ENGINE sets for itself — see docs/authoring.md's auto-flag list
  const engineWritten = (f: string) =>
    // `left_<npc>` (a wide berth given) and `<companion>_left` (a companion walking out) are both the engine's
    /^(did_|said_|remarked_|clocked_|calm_|down_|fell_|laid_|stole_|left_|_)/.test(f) || /_(lit|left)$/.test(f);
  const unreachable = [...readers.entries()]
    .filter(([flag]) => !written.has(flag) && !engineWritten(flag) && want(flag))
    .sort(([a], [b]) => a.localeCompare(b));
  if (unreachable.length) {
    console.log();
    console.log(`gates with no key (${unreachable.length}) — a flag read by a condition that nothing in the world ever sets:`);
    for (const [flag, where] of unreachable) {
      const places = [...new Set(where.map((o) => `${o.kind} "${o.label}"`))];
      console.log(`  ${flag}  <- read by ${places.slice(0, 3).join("; ")}${places.length > 3 ? ` (+${places.length - 3} more)` : ""}`);
    }
  }
}

/**
 * The other half of "choice matters": a standing or tally the world moves but
 * never reads back above a low threshold. Reputation with a faction is the
 * usual offender — a hundred deeds can raise it, nothing reads it past +2, so
 * every deed after the second one is a number that changes no scene.
 */
console.log();
const tracked = [...new Set([...varMoves.keys(), ...varReads.keys()])]
  .filter((v) => v !== "gold" && want(v) === (only ? prefixOf(v) === only : true))
  .map((v) => {
    const m = varMoves.get(v) ?? { ups: 0, upSum: 0, downs: 0, downSum: 0, sets: 0 };
    const th = [...(varThresholds.get(v)?.keys() ?? [])];
    // the highest value any condition ever asks this var to reach
    const highest = th
      .filter((k) => k.startsWith(">"))
      .map((k) => Number(k.replace(/^>=?/, "")))
      .filter((n) => Number.isFinite(n))
      .reduce((a, b) => Math.max(a, b), -Infinity);
    return { v, m, th, highest, reads: (varReads.get(v) ?? []).length };
  })
  .sort((a, b) => b.m.upSum - a.m.upSum || a.v.localeCompare(b.v));
/**
 * A `statusTracks` var whose own `remaining` flags are read elsewhere is a
 * display counter, not a forgotten number. Fosterfell's "Sent for: the roll,
 * the writ, the letters" counts three flags, and its rite gates on all three
 * individually — so the tally is what renders "2/3" and nothing more. I filed
 * that as a defect off this tool's own verdict before checking, which is the
 * mistake this line exists to stop the next reader making.
 */
const displayCounters = new Set<string>();
for (const tr of world.statusTracks ?? []) {
  if (!tr.var || !tr.remaining?.length) continue;
  const parts = tr.remaining.map((r) => r.flag).filter((f): f is string => !!f);
  if (parts.length && parts.every((f) => (readers.get(f) ?? []).length)) displayCounters.add(tr.var);
}

if (tracked.length) {
  console.log(`standings and tallies (${tracked.length}) — how far the world moves each, against the highest it ever reads:`);
  console.log(`  ${"var".padEnd(16)} ${pad("moves", 6)} ${pad("+total", 7)} ${pad("reads", 6)}  highest read  verdict`);
  for (const t of tracked) {
    const moves = t.m.ups + t.m.downs + t.m.sets;
    const highest = Number.isFinite(t.highest) ? `>=${t.highest}` : "—";
    // a standing worth three times what anything asks of it is inert over most of its range
    const verdict = moves === 0
      ? "not moved by content — the engine's own, or nothing feeds it"
      : t.reads === 0
        ? varShown.has(t.v)
          ? displayCounters.has(t.v)
            ? "a display counter — the flags it counts are read, the number itself is not"
            : "shown in status, but no gate, scene or line reads it"
          : "never read — the world does not notice it at all"
        : !Number.isFinite(t.highest)
          ? "read, but never as a height to reach"
          : t.m.upSum >= t.highest * 3
            ? `inert above +${t.highest} — ${t.m.ups} deeds raise it, nothing reads past that`
            : "";
    console.log(`  ${t.v.padEnd(16)} ${pad(moves, 6)} ${pad("+" + t.m.upSum, 7)} ${pad(t.reads, 6)}  ${highest.padEnd(12)}  ${verdict}`);
  }
}

if (all) {
  console.log();
  for (const [region, list] of [...byRegion.entries()].sort()) {
    console.log(`== ${region}`);
    for (const r of list.sort((a, b) => a.flag.localeCompare(b.flag))) {
      const kinds = new Map<string, number>();
      for (const o of r.outside) kinds.set(o.kind, (kinds.get(o.kind) ?? 0) + 1);
      const where = [...kinds.entries()].map(([k, n]) => `${k}×${n}`).join(", ");
      console.log(`  ${r.flag}: ${r.outside.length} reads outside${r.elsewhere.length ? `, ${r.elsewhere.length} in other regions` : ""}${r.epilogue ? ", epilogue" : ""}${where ? ` [${where}]` : ""}`);
    }
  }
}

/**
 * A door that shuts behind a failed try.
 *
 * An option gated on a standing — `["var", "rep_watch", ">=", 1]` — whose own
 * miss branch takes that standing away can leave the player at exactly the
 * value where the option disappears from the menu, with no line saying why.
 * Wave eight, seed 9902, at the Oath-Ground: "one resolution option ('bring a
 * living oath to the stone') silently disappeared from the menu after a single
 * failed attempt, while a same-DC alternative stayed — no explanation given
 * for why one path closes and another doesn't after a fail." That option is
 * one of the Wardmoor hold's three fates, so a missed roll closed a whole
 * ending off the road with no announcement.
 *
 * The realm's rule is that a price is said before the die is thrown, and the
 * miss's standing cost IS previewed. What is not previewable is that the cost
 * falsifies the option's own gate. Cheaper than an engine clause for a shape
 * this rare: find them, and write the content so the cost never crosses the
 * gate (spend the standing only when there is standing to spare).
 */
const selfClosing: string[] = [];
{
  const moved = (fxs: Fx[] | undefined, out: Map<string, number> = new Map()): Map<string, number> => {
    for (const f of fxs ?? []) {
      if (f[0] === "addvar") out.set(String(f[1]), (out.get(String(f[1])) ?? 0) + Number(f[2]));
      else if (f[0] === "if") { moved(f[2] as Fx[], out); moved(f[3] as Fx[], out); }
      else if (f[0] === "check") { moved(f[3] as Fx[], out); moved(f[4] as Fx[], out); }
      else if (f[0] === "chance") { moved(f[2] as Fx[], out); moved(f[3] as Fx[], out); }
    }
    return out;
  };
  const look = (where: string, label: string, ifs: Cond[] | undefined, fxs: Fx[] | undefined) => {
    const chk = fxs?.[0];
    if (!chk || chk[0] !== "check") return; // only a leading check has a miss branch of its own
    const miss = moved(chk[4] as Fx[]);
    for (const c of ifs ?? []) {
      if (c[0] !== "var" || !String(c[2]).startsWith(">")) continue;
      const d = miss.get(String(c[1])) ?? 0;
      if (d < 0) selfClosing.push(`  ${where}\n    "${label}"\n    gated on ${c[1]} ${c[2]} ${c[3]}, and a miss moves ${c[1]} by ${d}`);
    }
  };
  for (const [rid, r] of Object.entries(world.rooms)) for (const a of r.actions ?? []) look(`room ${rid}`, a.label, a.if, a.fx);
  for (const [nid, npc] of Object.entries(world.npcs)) for (const t of npc.topics ?? []) look(`npc  ${nid}`, t.label, t.if, t.fx);
}
if (!only) {
  console.log();
  if (selfClosing.length) {
    const one = selfClosing.length === 1;
    console.log(`${selfClosing.length} option${one ? "" : "s"} can close ${one ? "its" : "their"} own door on a miss — the cost of failing is the thing the gate asks for:`);
    for (const l of selfClosing) console.log(l);
  } else {
    console.log("No option in the realm closes its own door on a miss: no gate reads a standing its own failure spends.");
  }
}
