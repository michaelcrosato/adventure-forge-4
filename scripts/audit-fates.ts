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


/**
 * How a hold's grief reaches the player's journal at all.
 *
 * A fate nobody can find is not a choice either. Wave eight, seed 9901 walked
 * the Hearthlands, finished two of its side quests and left reporting that the
 * hold had no grief site: `hl_hollow_grievance` is set by entering one room,
 * `hl_barn_doors`, and the two quests that lead to the threshing floor start on
 * that flag, so the whole grief stayed invisible. Five holds open theirs on
 * arriving in the region, which is the shape that cannot be missed.
 */
/** Every flag an effect list sets, however nested — the vocabulary a quest's `done` can be written in. */
function flagsSet(fxs: Fx[] | undefined, out: Set<string> = new Set()): Set<string> {
  for (const f of fxs ?? []) {
    if (f[0] === "set") out.add(String(f[1]));
    else if (f[0] === "if") { flagsSet(f[2] as Fx[], out); flagsSet(f[3] as Fx[], out); }
    else if (f[0] === "check") { flagsSet(f[3] as Fx[], out); flagsSet(f[4] as Fx[], out); }
    else if (f[0] === "chance") { flagsSet(f[2] as Fx[], out); flagsSet(f[3] as Fx[], out); }
  }
  return out;
}

function opensHow(code: string, settling: Set<string>): string {
  const kinds: string[] = [];
  for (const [, q] of Object.entries(world.quests ?? {})) {
    // this hold's grief quest by what closes it, not by what it is called:
    // Wardmoor's ends on `wm_oath_resolved` and Hollowbrook's on
    // `hb_kingsrest_resolved`, and a name test calls neither of them a grief
    const blob = JSON.stringify([q.start, q.done, q.failed]);
    const own = blob.includes(`${code}_hollow_`) || [...settling].some((f) => blob.includes(`"${f}"`));
    if (!own) continue;
    const start = JSON.stringify(q.start ?? []).replace(/\s/g, "");
    if (start.includes(`"flag","${code}_entered"`)) return "opens on arriving in the region";
    kinds.push(start.includes(`${code}_hollow_grievance`) ? "one room" : "one flag");
  }
  if (!kinds.length) return "no quest leads to it at all";
  return `opens only after ${kinds.includes("one room") ? "standing in one room" : "one flag is set"}`;
}

const codes = new Set<string>();
for (const id of Object.keys(world.rooms)) { const m = /^([a-z]{2})_/.exec(id); if (m) codes.add(m[1]!); }

let holds = 0, ranked = 0;
const lines: string[] = [];
for (const code of [...codes].sort()) {
  const best: Partial<Record<Fate, number>> = {};
  const rows: string[] = [];
  const settling = new Set<string>();
  for (const fate of FATES) {
    const flag = `${code}_hollow_${fate}`;
    // Rooms AND conversations. This scanned only room actions for its first
    // three weeks, and five holds settle their grief in an npc's topic instead
    // — so the tool printed "0 of 15 ranked" while those five still paid +20
    // for a bargain against +25 for a rest, which is exactly the finding it
    // exists to catch. A blind spot in a measuring tool is worse than no tool:
    // it is a green bar over the thing you were checking for.
    const offers: { label: string; fx: Fx[] | undefined }[] = [];
    for (const [rid, r] of Object.entries(world.rooms)) {
      if (!rid.startsWith(`${code}_`)) continue;
      for (const a of r.actions ?? []) offers.push({ label: a.label, fx: a.fx });
    }
    for (const [nid, npc] of Object.entries(world.npcs)) {
      for (const t of npc.topics ?? []) {
        if (!setsFlag(t.fx, flag)) continue; // the npc may live anywhere; the flag is what ties it to the hold
        offers.push({ label: `${npc.name}: ${t.label}`, fx: t.fx });
        void nid;
      }
    }
    for (const a of offers) {
      if (!setsFlag(a.fx, flag)) continue;
      for (const f of flagsSet(a.fx)) settling.add(f);
      const p = payOf(a.fx);
      best[fate] = Math.max(best[fate] ?? -Infinity, p.score);
      rows.push(`    ${fate.padEnd(9)} ${String(a.label).slice(0, 42).padEnd(42)} ${words(p)}`);
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
  const opens = opensHow(code, settling);
  lines.push(`\n${code}: ${shown.map((f) => `${f} ${best[f]}`).join(sep)}${strictlyRanked ? "   RANKED" : ""}${opens ? `   [${opens}]` : ""}`);
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
        `What is left is what each fate pays INSTEAD — standing, regard, and an ending that reads it. All three\n` +
        `fates now have a seat: reach_at_rest wants three holds rested, reach_burned three burned, reach_bargained\n` +
        `three bargained, and each is proven by a route that actually does it. The open question is no longer\n` +
        `whether a fate has a reader but whether a player can tell, before choosing, what it will cost them.\n\n` +
        `And whether they can find it at all. Seven holds put their grief in the journal the moment you cross\n` +
        `into the region; five wait until you have stood in one particular room, and three until one other flag\n` +
        `is set. Wave eight's seed 9901 walked the Hearthlands, finished two of its side quests, and left\n` +
        `reporting the hold had no grief site — it has one, at the threshing floor, behind a flag set by\n` +
        `entering the barn doors and nothing else. A fate nobody can find is not a choice either.`,
);
process.exit(0);
