/**
 * Rest, bargain, burn: what each fate of a hold actually pays.
 *
 * Every hold in the Reach can be laid to rest, bargained with, or burned.
 * Three fates, authored three times over, sixteen holds — a third of the
 * realm's content sits behind the two that are not "rest".
 *
 * Then three blind players ran it end to end and chose **rest 24 times out of
 * 24**. None of them bargained or burned anything. This tool exists to say why
 * in numbers rather than by argument: it reads the effects of every action that
 * settles a hold and prints what each fate pays, so a fate that is strictly
 * worse than its siblings is visible instead of merely unchosen.
 *
 * It reads the *best* case of each action — the hit branch of a check, the
 * taken branch of an `if` — because that is what a player weighing the option
 * is promised. A fate that wins only on a bad roll is not a choice either.
 *
 *   npx tsx scripts/audit-fates.ts world/reach.json
 *   npx tsx scripts/audit-fates.ts world/reach.json --terse
 */
import { loadWorld } from "../src/validate.ts";
import type { Fx } from "../src/types.ts";

const [path, ...rest] = process.argv.slice(2);
if (!path) { console.error("usage: npx tsx scripts/audit-fates.ts <world.json> [--terse]"); process.exit(2); }
const terse = rest.includes("--terse");
const world = loadWorld(path);
process.stdout.on("error", (e: NodeJS.ErrnoException) => { if (e.code === "EPIPE") process.exit(0); });

const FATES = ["rested", "bargained", "burned"] as const;
type Fate = (typeof FATES)[number];
type Pay = { score: number; xp: number; hp: number; rep: Record<string, number>; appr: Record<string, number> };
const blank = (): Pay => ({ score: 0, xp: 0, hp: 0, rep: {}, appr: {} });

/** The best case an option promises: the hit branch of a check, the taken branch of an `if`. */
function payOf(fxs: Fx[] | undefined, p: Pay = blank()): Pay {
  for (const f of fxs ?? []) {
    if (f[0] === "score") p.score += Number(f[1]);
    else if (f[0] === "xp") p.xp += Number(f[1]);
    else if (f[0] === "hp") p.hp += Number(f[1]);
    else if (f[0] === "addvar" && String(f[1]).startsWith("rep_")) {
      const k = String(f[1]).slice(4);
      p.rep[k] = (p.rep[k] ?? 0) + Number(f[2]);
    } else if (f[0] === "addvar" && String(f[1]).startsWith("appr_")) {
      const k = String(f[1]).slice(5);
      p.appr[k] = (p.appr[k] ?? 0) + Number(f[2]);
    } else if (f[0] === "if") payOf(f[2], p);
    else if (f[0] === "check") payOf(f[3], p);
    else if (f[0] === "chance") payOf(f[2], p);
  }
  return p;
}

function setsFlag(fxs: Fx[] | undefined, want: string): boolean {
  for (const f of fxs ?? []) {
    if (f[0] === "set" && f[1] === want) return true;
    if (f[0] === "if" && (setsFlag(f[2], want) || setsFlag(f[3], want))) return true;
    if (f[0] === "check" && (setsFlag(f[3], want) || setsFlag(f[4], want))) return true;
    if (f[0] === "chance" && (setsFlag(f[2], want) || setsFlag(f[3], want))) return true;
  }
  return false;
}

const words = (p: Pay): string => {
  const out: string[] = [];
  if (p.score) out.push(`score ${p.score > 0 ? "+" : ""}${p.score}`);
  if (p.xp) out.push(`xp +${p.xp}`);
  if (p.hp) out.push(`hp ${p.hp}`);
  for (const [k, v] of Object.entries(p.rep)) out.push(`${k} ${v > 0 ? "+" : ""}${v}`);
  for (const [k, v] of Object.entries(p.appr)) out.push(`${k} ${v > 0 ? "+" : ""}${v}`);
  return out.join(" ") || "nothing";
};

const codes = new Set<string>();
for (const id of Object.keys(world.rooms)) { const m = /^([a-z]{2})_/.exec(id); if (m) codes.add(m[1]!); }

let holds = 0, ranked = 0;
const lines: string[] = [];
for (const code of [...codes].sort()) {
  const best: Partial<Record<Fate, number>> = {};
  const rows: string[] = [];
  for (const fate of FATES) {
    const flag = `${code}_hollow_${fate}`;
    for (const [rid, r] of Object.entries(world.rooms)) {
      if (!rid.startsWith(`${code}_`)) continue;
      for (const a of r.actions ?? []) {
        if (!setsFlag(a.fx, flag)) continue;
        const p = payOf(a.fx);
        best[fate] = Math.max(best[fate] ?? -Infinity, p.score);
        rows.push(`    ${fate.padEnd(9)} ${String(a.label).slice(0, 42).padEnd(42)} ${words(p)}`);
      }
    }
  }
  const scores = FATES.map((f) => best[f]).filter((n): n is number => n !== undefined);
  if (scores.length < 2) continue;
  holds++;
  // strictly decreasing in fate order (rest > bargain > burn) is the pattern
  // that makes the two lesser fates dead content: same deed, less reward
  const strictlyRanked = scores.every((n, i) => i === 0 || n < scores[i - 1]!);
  if (strictlyRanked) ranked++;
  const shown = FATES.filter((f) => best[f] !== undefined);
  const sep = shown.every((f) => best[f] === best[shown[0]!]) ? "  =  " : "  >  ";
  lines.push(`\n${code}: ${shown.map((f) => `${f} ${best[f]}`).join(sep)}${strictlyRanked ? "   RANKED" : ""}`);
  if (!terse) lines.push(...rows);
}

if (!terse) console.log(lines.join("\n").trimStart());
else for (const l of lines) if (l.trim()) console.log(l.trim());
console.log(
  ranked
    ? `\n${ranked} of ${holds} holds rank their fates by score alone: the same deed pays less for taking the road less approved of.\n` +
        `A fate nobody would choose is not a choice, and three blind players chose "rest" 24 times out of 24.\n` +
        `Fates should differ in what they pay, not in how much — and something the realm wants should read each one.`
    : `\n0 of ${holds} holds rank their fates by score: the same deed pays the same whichever road you take it by.\n` +
        `What is left is what each fate pays INSTEAD — standing, regard, and an ending that reads it. reach_at_rest\n` +
        `wants three holds rested and reach_burned three burned; a bargained realm still has no seat of its own.`,
);
process.exit(0);
