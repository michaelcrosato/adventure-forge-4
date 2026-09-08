/**
 * Does "get your bearings" actually lead where it says?
 *
 * Wilderness bearings are hand-authored, one string per generated cell, in the
 * form "<place>: 2 south and 3 east, then east". A blind player has now
 * reported three times, in three separate waves, that following them literally
 * overshoots or loops back (done/P1-issue-6e43ac6b, -965d6864, and this
 * week's). Twice the report was archived without a fix, because checking 294
 * of these by hand against a generated grid is not something anyone was going
 * to do.
 *
 * It is mechanical, though: the grid is data and so are its exits. This walks
 * every bearing the way a player would — step by step, through real exits,
 * following gated ones too, since a bearing says where a place is and not
 * whether the way is open — and reports the two ways one can be wrong:
 *
 *   NO EXIT    the walk runs into a wall partway, so the count is impossible
 *   ELSEWHERE  the walk completes and lands somewhere that is not the place named
 *
 * Prose bearings ("North, the glassworks") say a direction and no count; they
 * are not checkable and are not checked. The count is printed so the coverage
 * is honest.
 *
 *   node --import tsx scripts/audit-bearings.ts world/reach.json [--prefix ir] [--all]
 */
import { loadWorld } from "../src/validate.ts";
import type { World } from "../src/types.ts";

const [path, ...rest] = process.argv.slice(2);
if (!path) { console.error("usage: node --import tsx scripts/audit-bearings.ts <world.json> [--prefix xx] [--all]"); process.exit(2); }
const only = rest.includes("--prefix") ? rest[rest.indexOf("--prefix") + 1]! : null;
const showAll = rest.includes("--all");
const world: World = loadWorld(path);

const DIRS = ["north", "south", "east", "west", "up", "down", "in", "out"] as const;
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 };
const count = (t: string) => (/^\d+$/.test(t) ? Number(t) : (WORDS[t.toLowerCase()] ?? 0));
const DIR = `(${DIRS.join("|")})`;
const N = `(\\d+|one|two|three|four|five|six|seven|eight)`;
// "<place>: 2 south and 3 east, then east" — and the shorter shapes it degrades to
const LEG = new RegExp(`([^;.]+?):\\s*${N}\\s+${DIR}(?:\\s+and\\s+${N}\\s+${DIR})?(?:,\\s*then\\s+${DIR})?`, "gi");

/** significant words of a destination phrase, for matching against a room's own names */
const keyWords = (s: string) =>
  s.toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z' ]/g, " ").split(/\s+/)
    .filter((x) => x.length > 3 && !["the", "then", "and", "past", "toward", "into", "back", "from", "beyond", "keeps", "runs", "lies", "leads"].includes(x));

type Bad = { room: string; dest: string; leg: string; why: string };
const bad: Bad[] = [];
let legs = 0, prose = 0, rooms = 0;

for (const [rid, room] of Object.entries(world.rooms)) {
  if (only && !rid.startsWith(`${only}_`)) continue;
  for (const a of room.actions ?? []) {
    if (!/bearings/i.test(a.label ?? "")) continue;
    rooms++;
    for (const fx of a.fx ?? []) {
      if (fx[0] !== "say" || typeof fx[1] !== "string") continue;
      const text = fx[1];
      const found = [...text.matchAll(LEG)];
      if (!found.length) { prose++; continue; }
      for (const m of found) {
        legs++;
        const [whole, destRaw, n1, d1, n2, d2, d3] = m;
        const steps: [number, string][] = [[count(n1!), d1!]];
        if (n2 && d2) steps.push([count(n2), d2]);
        if (d3) steps.push([1, d3]);
        let at = rid, failed = "";
        outer: for (const [n, d] of steps) {
          for (let i = 0; i < n; i++) {
            const to = world.rooms[at]?.exits?.[d]?.to;
            if (!to || !world.rooms[to]) { failed = `no ${d} exit from ${at} (step ${i + 1} of ${n})`; break outer; }
            at = to;
          }
        }
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

console.log(`${rooms} rooms offer bearings; ${legs} legs carry a count and were walked, ${prose} say a direction only and cannot be checked.`);
console.log(`${bad.length} legs do not lead where they say (${legs ? Math.round((100 * bad.length) / legs) : 0}%).`);
console.log(
  `Said elsewhere, "N <dir> of <place>": ${ofLegs} legs anchored to a room and walked, ${ofUnanchored} naming somewhere this tool could not place. ` +
    `${ofBad.length} cannot be walked at all.\n`,
);
for (const b of ofBad) console.log(`  ${b.room.padEnd(30)} "${b.leg}"\n      ${b.why}`);
if (ofBad.length) console.log();

// by region, because one region's grid with its compass inverted looks exactly
// like a realm-wide problem until you count
const byRegion = new Map<string, { bad: number; all: number }>();
for (const [rid, room] of Object.entries(world.rooms)) {
  if (only && !rid.startsWith(`${only}_`)) continue;
  for (const a of room.actions ?? []) {
    if (!/bearings/i.test(a.label ?? "")) continue;
    for (const fx of a.fx ?? []) {
      if (fx[0] !== "say" || typeof fx[1] !== "string") continue;
      const r = room.region ?? rid.split("_")[0]!;
      const e = byRegion.get(r) ?? byRegion.set(r, { bad: 0, all: 0 }).get(r)!;
      e.all += [...String(fx[1]).matchAll(LEG)].length;
    }
  }
}
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
