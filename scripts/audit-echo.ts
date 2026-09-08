/**
 * Echo audit — prose the realm has written twice.
 *
 * A world this size is written by many hands over many rounds, and its
 * signature failure is not a typo but a sentence that already exists
 * somewhere else with two words moved:
 *
 *   "An Ironbound lay-brother, cheerful in the way of someone who has
 *    already made his peace with fire being the answer to most things."
 *   "An Ironbound lay-brother, cheerful in the particular way of someone who
 *    has made his peace with fire being the answer to most things, ..."
 *
 * Two holds, two npcs, one sentence. Nothing in the bar notices, because both
 * are valid, both are inside the style budget, and both replay fine.
 *
 * This compares every authored string in the world against every other by
 * word-shingle overlap and prints the pairs that are effectively the same
 * sentence. It is a reviewer's tool, not a test: some echoes are deliberate
 * (a refrain, a template's shared line) and a human decides which.
 *
 *   node --import tsx scripts/audit-echo.ts world/reach.json [--min 0.5] [--prefix fd] [--top 40]
 */
import { loadWorld } from "../src/validate.ts";
import type { World } from "../src/types.ts";

const [path, ...rest] = process.argv.slice(2);
if (!path) { console.error("usage: node --import tsx scripts/audit-echo.ts <world.json> [--min 0.5] [--prefix xx] [--top 40]"); process.exit(2); }
const arg = (name: string, dflt: number) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 && rest[i + 1] !== undefined ? Number(rest[i + 1]) : dflt;
};
const MIN = arg("min", 0.5);
const TOP = arg("top", 40);
const only = rest.includes("--prefix") ? rest[rest.indexOf("--prefix") + 1]! : null;
const world: World = loadWorld(path);

// a stamped place is a template's copy: sharing its prose with its 67 siblings
// is the point of a template, not a defect. Its ids all begin `<stamp id>_`.
const stampPrefixes = (world.stamps ?? []).map((st) => `${st.id}_`);
const stamped = (where: string) => stampPrefixes.some((p) => where.startsWith(p));

type Line = { where: string; text: string; words: string[]; shingles: Set<string> };
const lines: Line[] = [];
const K = 4; // words per shingle: long enough that ordinary phrasing does not collide
const MIN_WORDS = 10; // below this, two lines being alike is coincidence, not an echo

const add = (where: string, text: unknown) => {
  if (typeof text !== "string") return;
  if (only && !where.startsWith(only)) return;
  const words = text.toLowerCase().replace(/[^a-z0-9' ]+/g, " ").split(/\s+/).filter(Boolean);
  if (words.length < MIN_WORDS) return;
  const shingles = new Set<string>();
  for (let i = 0; i + K <= words.length; i++) shingles.add(words.slice(i, i + K).join(" "));
  if (shingles.size) lines.push({ where, text, words, shingles });
};

for (const [id, r] of Object.entries(world.rooms)) {
  add(`${id} desc`, r.desc);
  add(`${id} brief`, r.brief);
  for (const v of r.variants ?? []) { add(`${id} variant.desc`, v.desc); add(`${id} variant.brief`, v.brief); }
  for (const a of r.actions ?? []) for (const fx of a.fx ?? []) if (fx[0] === "say") add(`${id}:${a.id} say`, fx[1]);
}
for (const [id, n] of Object.entries(world.npcs)) {
  add(`${id} desc`, n.desc);
  for (const t of n.topics ?? []) for (const fx of t.fx ?? []) if (fx[0] === "say") add(`${id}:${t.id} say`, fx[1]);
  for (const rm of n.companion?.remarks ?? []) add(`${id}:${rm.id} remark`, rm.say);
}
for (const [id, it] of Object.entries(world.items)) {
  add(`${id} hint`, it.hint);
  for (const u of it.use ?? []) for (const fx of u.fx ?? []) if (fx[0] === "say") add(`${id} use.say`, fx[1]);
}
for (const [i, ep] of (world.epilogue ?? []).entries()) add(`epilogue[${i}]`, ep.text);

// candidate pairs share at least one shingle; the inverted index keeps this
// from being a quarter of a billion comparisons
const index = new Map<string, number[]>();
for (const [i, l] of lines.entries()) for (const s of l.shingles) (index.get(s) ?? index.set(s, []).get(s)!).push(i);

const shared = new Map<string, number>();
for (const bucket of index.values()) {
  if (bucket.length > 40) continue; // a shingle in dozens of lines is a house phrase, not an echo
  for (let a = 0; a < bucket.length; a++)
    for (let b = a + 1; b < bucket.length; b++) {
      const key = `${bucket[a]},${bucket[b]}`;
      shared.set(key, (shared.get(key) ?? 0) + 1);
    }
}

type Pair = { a: Line; b: Line; score: number };
const pairs: Pair[] = [];
let templateEchoes = 0;
for (const [key, common] of shared) {
  const [ai, bi] = key.split(",").map(Number) as [number, number];
  const a = lines[ai]!, b = lines[bi]!;
  const jaccard = common / (a.shingles.size + b.shingles.size - common);
  if (jaccard < MIN) continue;
  if (stamped(a.where) || stamped(b.where)) { templateEchoes += 1; continue; }
  pairs.push({ a, b, score: jaccard });
}
pairs.sort((x, y) => y.score - x.score);

const clip = (s: string, n = 150) => (s.length > n ? `${s.slice(0, n)}…` : s);
if (templateEchoes) {
  const byTemplate = new Map<string, number>();
  for (const st of world.stamps ?? []) byTemplate.set(st.template, (byTemplate.get(st.template) ?? 0) + 1);
  const tally = [...byTemplate.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t}\u00d7${n}`).join(", ");
  console.log(`${templateEchoes} echoes are a stamped place matching its own template's other copies — set by design, not counted below.`);
  console.log(`  ${world.stamps?.length ?? 0} stamps from ${Object.keys(world.templates ?? {}).length} templates: ${tally}`);
  console.log(`  Worth knowing anyway: a player who enters two barrows reads the same lintel word for word.`);
  console.log();
}
if (!pairs.length) {
  console.log(`no echoes at or above ${MIN} — ${lines.length} authored lines compared`);
} else {
  console.log(`echoes (${pairs.length}) at or above ${MIN}, of ${lines.length} authored lines — the realm writing the same sentence twice:`);
  console.log();
  for (const p of pairs.slice(0, TOP)) {
    console.log(`  ${p.score.toFixed(2)}  ${p.a.where}`);
    console.log(`        ${clip(p.a.text)}`);
    console.log(`        ${p.b.where}`);
    console.log(`        ${clip(p.b.text)}`);
    console.log();
  }
  if (pairs.length > TOP) console.log(`  … and ${pairs.length - TOP} more (raise --top)`);
}
