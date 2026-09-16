/**
 * Does "get your bearings" actually lead where it says?
 *
 * Wilderness bearings were hand-authored once, one string per generated cell.
 * A blind player reported three times, in three separate waves, that
 * following them literally overshoots or loops back (done/P1-issue-6e43ac6b,
 * -965d6864, and a third). Twice the report was archived without a fix,
 * because checking 294 of these by hand against a generated grid is not
 * something anyone was going to do.
 *
 * The engine rewrite that followed replaced all but 7 of them with a computed
 * macro, `["fx", ["bearings"]]` -> `bearingsHere()` in `src/engine.ts`, built
 * from a real BFS over the room graph rather than a hand-typed guess. This
 * tool's own leg-extractor used to only recognize `["say", "..."]` — literal
 * text sitting in the JSON — so those 290 rooms went dark to it the day the
 * macro landed: not wrong, just invisible, counted in neither the "legs" nor
 * the "prose" bucket. `bearingsHere` has synthetic-world unit coverage
 * (`test/realm.test.ts`, "every breadcrumb it can print is a path that
 * actually walks") and the crawler exercises it for crash-safety at the real
 * 936-room scale, but nothing had independently checked its *rendered text*
 * against the real graph the way this tool always checked hand-authored
 * prose — which is a different claim than "the BFS is correct" and the one
 * this tool exists to make.
 *
 * So: both grammars are walked now, hand-authored and generated alike, the
 * same way a player would — step by step, through real exits, following
 * gated ones too, since a bearing says where a place is and not whether the
 * way is open — and this reports the two ways either can be wrong:
 *
 *   NO EXIT    the walk runs into a wall partway, so the count is impossible
 *   ELSEWHERE  the walk completes and lands somewhere that is not the place named
 *
 * The generated macro is checked from a state seeded at each room with no
 * quest active, so it proves the landmark half of `bearingsHere` — the part
 * every room with the macro renders. The `wanted` half (naming an active
 * quest's own destination) needs a state where that specific quest is
 * mid-stage, which nothing constructs here; that gap is real and unmeasured,
 * the same honest way prose-only legs are printed but not checked.
 *
 *   node --import tsx scripts/audit-bearings.ts world/reach.json [--prefix ir] [--all]
 */
import { bearingsHere, newState } from "../src/engine.ts";
import { loadWorld } from "../src/validate.ts";
import type { World } from "../src/types.ts";

const [path, ...rest] = process.argv.slice(2);
if (!path) { console.error("usage: node --import tsx scripts/audit-bearings.ts <world.json> [--prefix xx] [--all]"); process.exit(2); }
const only = rest.includes("--prefix") ? rest[rest.indexOf("--prefix") + 1]! : null;
const showAll = rest.includes("--all");
const world: World = loadWorld(path);

const DIRS = ["north", "south", "east", "west", "up", "down", "in", "out", "across"] as const;
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const count = (t: string) => (/^\d+$/.test(t) ? Number(t) : (WORDS[t.toLowerCase()] ?? 0));
const DIR = `(${DIRS.join("|")})`;
const N = `(\\d+|${Object.keys(WORDS).join("|")})`;
// "<place>: 2 south and 3 east, then east" — and the shorter shapes it degrades to
const LEG = new RegExp(`([^;.]+?):\\s*${N}\\s+${DIR}(?:\\s+and\\s+${N}\\s+${DIR})?(?:,\\s*then\\s+${DIR})?`, "gi");

/**
 * `bearingsHere`'s own grammar (`legsOf` in src/engine.ts): "<place>[ —
 * <why>], <leg>(, then <leg>)*." where each leg is "<countword> <dir>" —
 * except a *single* non-compass step (a direction outside `COMPASS` in
 * src/engine.ts: "in", "out", "up", "down", "across"), which prints bare
 * with no count; a compass direction is always counted, even for one step,
 * and two or more of any direction always is too ("two in" is real, not just
 * "in, then in"). The hand-authored grammar above never spells out a count
 * on a solo leg at all, compass or not — a different, narrower grammar,
 * which is why this is its own regex rather than a shared one. A single
 * regex finds the run of legs trailing each part; what is left before it is
 * the place (and its optional quest name, dropped: matched the same way
 * ELSEWHERE already does, against the room actually reached).
 */
const NONCOMPASS = DIRS.filter((d) => !["north", "south", "east", "west"].includes(d));
const GEN_LEG = `(?:${N}\\s+${DIR}|${NONCOMPASS.join("|")})`;
const GEN_LEGRUN = new RegExp(`,\\s*(${GEN_LEG}(?:,\\s*then\\s+${GEN_LEG})*)$`, "i");
const GEN_ONE = new RegExp(`^${N}\\s+${DIR}$|^${DIR}$`, "i");
/** One rendered `bearingsHere` part's trailing leg-run, parsed into [count, dir] steps; null if the grammar does not match (a bug in the render, not in this tool's grammar, is exactly what that would mean). */
function parseGenLegs(run: string): [number, string][] | null {
  const steps: [number, string][] = [];
  for (const one of run.split(/,\s*then\s+/i)) {
    const m = GEN_ONE.exec(one.trim());
    if (!m) return null;
    steps.push(m[2] ? [count(m[1]!), m[2]] : [1, m[3]!]);
  }
  return steps;
}

/** significant words of a destination phrase, for matching against a room's own names */
const keyWords = (s: string) =>
  s.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z' ]/g, " ").split(/\s+/)
    .filter((x) => x.length > 3 && !["the", "then", "and", "past", "toward", "into", "back", "from", "beyond", "keeps", "runs", "lies", "leads"].includes(x));

type Bad = { room: string; dest: string; leg: string; why: string };
const bad: Bad[] = [];
let legs = 0, prose = 0, rooms = 0, generated = 0, deadGenerated = 0, mixedRooms = 0;

/** Walk a sequence of [count, dir] steps from a room through real exits, gated ones included. Returns the room landed on, or the failure reason. */
function walkSteps(from: string, steps: [number, string][]): { at: string; failed: string } {
  let at = from, failed = "";
  outer: for (const [n, d] of steps) {
    for (let i = 0; i < n; i++) {
      const to = world.rooms[at]?.exits?.[d]?.to;
      if (!to || !world.rooms[to]) { failed = `no ${d} exit from ${at} (step ${i + 1} of ${n})`; break outer; }
      at = to;
    }
  }
  return { at, failed };
}

/** A fresh state seeded at each room in turn — bearingsHere reads only s.room and the (empty, at turn 1) journal, so this checks the landmark half every macro room renders; see the docstring for the quest-destination half this cannot reach. */
const seed = newState(world, 1).state;

// by region, because one region's grid with its compass inverted looks exactly
// like a realm-wide problem until you count — tallied here, alongside the
// walk itself, rather than by a second scan that would need its own copy of
// every fx kind this loop already knows how to read
const legsByRegion = new Map<string, number>();

for (const [rid, room] of Object.entries(world.rooms)) {
  if (only && !rid.startsWith(`${only}_`)) continue;
  const region = room.region ?? rid.split("_")[0]!;
  for (const a of room.actions ?? []) {
    if (!/bearings/i.test(a.label ?? "")) continue;
    rooms++;
    const kinds = new Set((a.fx ?? []).map((fx) => fx[0]));
    if (kinds.has("bearings") && kinds.has("say")) mixedRooms++;
    for (const fx of a.fx ?? []) {
      if (fx[0] === "bearings") {
        generated++;
        const rendered = bearingsHere(world, { ...seed, room: rid });
        const body = /: (.*)\.$/.exec(rendered)?.[1];
        if (!body) { deadGenerated++; continue; } // "Nothing hereabouts has a name to steer by."
        for (const part of body.split("; ")) {
          const m = GEN_LEGRUN.exec(part);
          const destRaw = m ? part.slice(0, m.index) : part;
          const dest = destRaw.split(" — ")[0]!.trim();
          legs++;
          legsByRegion.set(region, (legsByRegion.get(region) ?? 0) + 1);
          if (!m) { bad.push({ room: rid, dest, leg: part, why: "UNPARSEABLE — bearingsHere rendered a leg this tool's own grammar for it does not match" }); continue; }
          const steps = parseGenLegs(m[1]!);
          if (!steps) { bad.push({ room: rid, dest, leg: part, why: "UNPARSEABLE — bearingsHere rendered a leg this tool's own grammar for it does not match" }); continue; }
          const { at, failed } = walkSteps(rid, steps);
          if (failed) { bad.push({ room: rid, dest, leg: part, why: `NO EXIT — ${failed}` }); continue; }
          const landed = world.rooms[at]!;
          const names = `${landed.name ?? ""} ${landed.landmark ?? ""} ${at}`.toLowerCase();
          const want = keyWords(dest);
          if (want.length && !want.some((k) => names.includes(k)))
            bad.push({ room: rid, dest, leg: part, why: `ELSEWHERE — lands at ${at} "${landed.name}"` });
        }
        continue;
      }
      if (fx[0] !== "say" || typeof fx[1] !== "string") continue;
      const text = fx[1];
      const found = [...text.matchAll(LEG)];
      if (!found.length) { prose++; continue; }
      for (const m of found) {
        legs++;
        legsByRegion.set(region, (legsByRegion.get(region) ?? 0) + 1);
        const [whole, destRaw, n1, d1, n2, d2, d3] = m;
        const steps: [number, string][] = [[count(n1!), d1!]];
        if (n2 && d2) steps.push([count(n2), d2]);
        if (d3) steps.push([1, d3]);
        const { at, failed } = walkSteps(rid, steps);
        const dest = destRaw!.trim();
        if (failed) { bad.push({ room: rid, dest, leg: whole!.trim(), why: `NO EXIT — ${failed}` }); continue; }
        const landed = world.rooms[at]!;
        const names = `${landed.name ?? ""} ${landed.landmark ?? ""} ${at}`.toLowerCase();
        const want = keyWords(dest);
        if (want.length && !want.some((k) => names.includes(k)))
          bad.push({ room: rid, dest, leg: whole!.trim(), why: `ELSEWHERE — lands at ${at} "${landed.name}"` });
      }
    }
  }
}

// ---------- the other grammar: a place located from somewhere else ----------
/**
 * "the slag-hound's den is three north of the head-frame, three east".
 *
 * The check above walks bearings a `get your bearings` action gives from the
 * room you stand in. Two blind players in wave five reported wrong directions
 * anyway, and both were this other shape: an npc naming where a place is
 * *relative to a third place*. Nothing walked those, in any file, so a
 * hand-authored hop count in dialogue was never checked at all.
 *
 * The anchor is the named place; the walk starts there. What cannot be checked
 * this way is where it *ends* — the sentence's subject is the destination and
 * pulling that out of prose is guesswork — so this reports only that the walk
 * is impossible: an exit the grid does not have. That is what "didn't match
 * the actual room graph" means, and it is the half worth catching.
 */
const OF = new RegExp(`${N}\\s+${DIR}(?:\\s*,?\\s*(?:and\\s+)?${N}\\s+${DIR})?\\s+of\\s+([^.,;:!?"]{3,44})`, "gi");
const byName = new Map<string, string>();
for (const [rid, r] of Object.entries(world.rooms)) {
  for (const key of [r.name, r.landmark]) {
    if (!key) continue;
    const k = String(key).toLowerCase().replace(/^the\s+/, "");
    if (!byName.has(k)) byName.set(k, rid);
  }
}
const anchorOf = (phrase: string): string | undefined => {
  const p = phrase.toLowerCase().replace(/^(the|a|an)\s+/, "").replace(/[^a-z' -]/g, "").trim();
  if (byName.has(p)) return byName.get(p);
  const words = keyWords(p);
  if (!words.length) return undefined;
  for (const [name, rid] of byName) if (words.every((w) => name.includes(w))) return rid;
  return undefined;
};
type Said = { where: string; text: string };
const said: Said[] = [];
const walkFx = (where: string, fxs: unknown): void => {
  if (!Array.isArray(fxs)) return;
  for (const f of fxs as unknown[]) {
    if (!Array.isArray(f)) continue;
    if (f[0] === "say" && typeof f[1] === "string") said.push({ where, text: f[1] });
    else if (f[0] === "if") { walkFx(where, f[2]); walkFx(where, f[3]); }
    else if (f[0] === "check") { walkFx(where, f[3]); walkFx(where, f[4]); }
    else if (f[0] === "chance") { walkFx(where, f[2]); walkFx(where, f[3]); }
  }
};
for (const [rid, room] of Object.entries(world.rooms)) {
  if (only && !rid.startsWith(`${only}_`)) continue;
  walkFx(`room ${rid} onEnter`, room.onEnter);
  walkFx(`room ${rid} onEnterOnce`, room.onEnterOnce);
  for (const a of room.actions ?? []) walkFx(`room ${rid}/${a.id}`, a.fx);
}
for (const [nid, npc] of Object.entries(world.npcs)) {
  if (only && !nid.startsWith(`${only}_`)) continue;
  for (const t of npc.topics ?? []) {
    if (t.say) said.push({ where: `npc ${nid}/${t.id}`, text: String(t.say) });
    walkFx(`npc ${nid}/${t.id}`, t.fx);
  }
  for (const r of npc.companion?.remarks ?? []) {
    if (r.say) said.push({ where: `npc ${nid} remark ${r.id}`, text: String(r.say) });
    walkFx(`npc ${nid} remark ${r.id}`, r.fx);
  }
}
let ofLegs = 0, ofUnanchored = 0;
const ofBad: Bad[] = [];
for (const { where, text } of said) {
  for (const m of text.matchAll(OF)) {
    const [whole, n1, d1, n2, d2, place] = m;
    const anchor = anchorOf(place!);
    if (!anchor) { ofUnanchored++; continue; }
    ofLegs++;
    const steps: [number, string][] = [[count(n1!), d1!]];
    if (n2 && d2) steps.push([count(n2), d2]);
    let at = anchor, failed = "";
    outer2: for (const [n, d] of steps) {
      for (let i = 0; i < n; i++) {
        const to = world.rooms[at]?.exits?.[d]?.to;
        if (!to || !world.rooms[to]) { failed = `no ${d} exit from ${at} (step ${i + 1} of ${n})`; break outer2; }
        at = to;
      }
    }
    if (failed) ofBad.push({ room: where, dest: place!.trim(), leg: whole!.trim(), why: `NO EXIT — ${failed}` });
  }
}

console.log(
  `${rooms} bearings actions (${generated} carry the computed \`["bearings"]\` macro` +
    `${mixedRooms ? `, ${mixedRooms} of them also carrying hand-authored text alongside it` : ""}); ` +
    `${legs} legs carry a count and were walked, ${prose} hand-authored legs say a direction only and cannot be checked, ` +
    `${deadGenerated} computed rooms named nothing at all ("Nothing hereabouts has a name to steer by").`,
);
console.log(`${bad.length} legs do not lead where they say (${legs ? Math.round((100 * bad.length) / legs) : 0}%).`);
console.log(
  `Said elsewhere, "N <dir> of <place>": ${ofLegs} legs anchored to a room and walked, ${ofUnanchored} naming somewhere this tool could not place. ` +
    `${ofBad.length} cannot be walked at all.\n`,
);
for (const b of ofBad) console.log(`  ${b.room.padEnd(30)} "${b.leg}"\n      ${b.why}`);
if (ofBad.length) console.log();

const byRegion = new Map<string, { bad: number; all: number }>();
for (const [r, all] of legsByRegion) byRegion.set(r, { bad: 0, all });
for (const b of bad) {
  const r = world.rooms[b.room]?.region ?? b.room.split("_")[0]!;
  const e = byRegion.get(r) ?? byRegion.set(r, { bad: 0, all: 0 }).get(r)!;
  e.bad++;
}
console.log("by region:");
for (const [r, e] of [...byRegion].filter(([, e]) => e.all).sort((a, b) => b[1].bad - a[1].bad))
  console.log(`  ${r.padEnd(6)} ${String(e.bad).padStart(3)} of ${String(e.all).padStart(3)} legs wrong${e.bad === e.all && e.all > 4 ? "   <- every one" : ""}`);
console.log();
const show = showAll ? bad : bad.slice(0, 40);
for (const b of show) console.log(`  ${b.room.padEnd(20)} ${b.why}\n${" ".repeat(22)}"${b.leg}"`);
if (bad.length > show.length) console.log(`\n  ...and ${bad.length - show.length} more (--all)`);
console.log(`
A bearing is walked through real exits, gated ones included: it says where a
place is, not whether the way is open. ELSEWHERE matches the destination's own
words against the room's name, landmark and id, so a bearing that lands one
room short of a landmark reads as wrong — which is what a player following it
experiences.`);
