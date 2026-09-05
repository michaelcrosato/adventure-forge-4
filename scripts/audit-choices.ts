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

const walkCond = (conds: Cond[] | undefined, o: Origin) => {
  for (const c of conds ?? []) {
    if (c[0] === "flag" || c[0] === "!flag") read(c[1], o);
    else if (c[0] === "var") (varReads.get(c[1]) ?? varReads.set(c[1], []).get(c[1])!).push(o);
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
        break;
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
  for (const rm of n.companion?.remarks ?? []) walkCond(rm.if, { kind: "remark", container: nid, label: `${n.name} remarks` });
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
for (const ep of world.epilogue ?? []) walkCond(ep.if, { kind: "epilogue", container: "epilogue", label: ep.text.slice(0, 40) });
for (const tr of world.statusTracks ?? []) walkCond(tr.if, { kind: "status", container: "status", label: tr.label });
for (const p of world.statusPaths ?? []) walkCond(p.if, { kind: "status", container: "status", label: p.label });
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
