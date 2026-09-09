/**
 * What a fight in this realm actually costs, simulated through the real rules.
 *
 * The realm has a whole combat layer — hp, armor, a d20 to hit against a
 * defence, timed conditions, a Warden who can brace or break, a companion who
 * can be struck down and hauled back up — and three blind players of wave
 * eight, replayed off their own traces, pressed `attack` 13 times between them
 * and their two combat abilities 0 times out of 24 offers. The reports say
 * fights are fine. The traces say the tactical layer inside them is decorative.
 *
 * The reason is structural, and it is worth seeing in numbers rather than
 * arguing about: **every companion standing with you takes a swing on your
 * turn, and the enemy's one blow rotates between all of you.** A party of four
 * therefore multiplies what you deal by five and divides what you take by
 * five. Nothing on the other side scales with the crowd it faces.
 *
 * So: put one fixed player build against every hostile in the realm, at party
 * sizes 0, 2 and 4, and print the rounds it takes and the hp it costs. No
 * arithmetic is re-derived here — it runs the engine's own `step`, so a change
 * to the rules changes these numbers.
 *
 *   npx tsx scripts/audit-fights.ts world/reach.json [--terse]
 */
import { legalActions, newState, step } from "../src/engine.ts";
import { loadWorld } from "../src/validate.ts";
import type { Action, State } from "../src/types.ts";

const [path, ...rest] = process.argv.slice(2);
if (!path) { console.error("usage: npx tsx scripts/audit-fights.ts <world.json> [--terse]"); process.exit(2); }
const terse = rest.includes("--terse");
const world = loadWorld(path);
process.stdout.on("error", (e: NodeJS.ErrnoException) => { if (e.code === "EPIPE") process.exit(0); });

/** The build every fight below is measured against: a Warden with a plain weapon, so the numbers move only with the enemy and the crowd. */
const CLASS = "warden";
const WEAPON = Object.entries(world.items).find(([, it]) => it.dmg === 2 && !it.hit)?.[0] ?? Object.keys(world.items).find((id) => world.items[id]!.dmg);
const COMPANIONS = Object.entries(world.npcs).filter(([, n]) => n.companion).map(([id]) => id);
const ROOM = world.start;
const MAX_ROUNDS = 40;

type Fight = { rounds: number; hpLost: number; down: number; won: boolean; died: boolean };

function fight(npc: string, party: string[]): Fight {
  const { state } = newState(world, 1);
  // pick the class through the menu rather than by writing classId: the pick
  // is what sets the attributes and the hp the fight is actually fought with
  const pick = legalActions(world, state).find((a) => a.kind === "classpick" && a.id === CLASS);
  let s: State = {
    ...(pick ? step(world, state, pick).state : state),
    room: ROOM,
    inv: WEAPON ? [WEAPON] : [],
    party: [...party],
    npcRoom: { ...state.npcRoom, [npc]: ROOM, ...Object.fromEntries(party.map((id) => [id, ROOM])) },
  };
  const hp0 = s.hp;
  let rounds = 0;
  while (rounds < MAX_ROUNDS && !s.ended) {
    const a = legalActions(world, s).find((x): x is Extract<Action, { kind: "attack" }> => x.kind === "attack" && x.npc === npc);
    if (!a) break; // dead, or never attackable at all
    s = step(world, s, a).state;
    rounds++;
  }
  const alive = (s.npcHp[npc] ?? world.npcs[npc]!.hp ?? 1) > 0 && !s.flags[`dead_${npc}`];
  return {
    rounds,
    hpLost: hp0 - s.hp,
    down: party.filter((id) => s.flags[`down_${id}`] || (s.npcHp[id] ?? 1) <= 0).length,
    won: !alive && !s.ended,
    died: !!s.ended,
  };
}

const SIZES = [0, 2, 4];
const hostiles = Object.entries(world.npcs).filter(([, n]) => n.atk !== undefined && (n.hp ?? 0) > 0);
const rows: { id: string; name: string; hp: number; atk: number; runs: Fight[] }[] = [];
for (const [id, def] of hostiles) {
  const runs = SIZES.map((n) => fight(id, COMPANIONS.slice(0, n)));
  if (runs.every((r) => r.rounds === 0)) continue; // never attackable from a standing start
  rows.push({ id, name: def.name, hp: def.hp ?? 1, atk: def.atk ?? 0, runs });
}

const med = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)] ?? 0;
const bySize = SIZES.map((_, i) => ({
  rounds: med(rows.map((r) => r.runs[i]!.rounds)),
  hp: med(rows.map((r) => r.runs[i]!.hpLost)),
  down: rows.reduce((a, r) => a + r.runs[i]!.down, 0),
  lost: rows.filter((r) => !r.runs[i]!.won).length,
  died: rows.filter((r) => r.runs[i]!.died).length,
}));

if (terse) {
  console.log(SIZES.map((n, i) => `party${n} rounds ${bySize[i]!.rounds} hp ${bySize[i]!.hp} died ${bySize[i]!.died}`).join(" | "));
  process.exit(0);
}

console.log(`${rows.length} hostiles that strike back, each fought from full hp with a plain weapon (${world.items[WEAPON!]?.name ?? "bare hands"}):\n`);
console.log(`  ${"".padEnd(26)} ${SIZES.map((n) => `alone+${n}`.padStart(16)).join("")}`);
console.log(`  ${"who".padEnd(26)} ${SIZES.map(() => "rounds  hp lost".padStart(16)).join("")}`);
for (const r of rows.sort((a, b) => b.runs[0]!.hpLost - a.runs[0]!.hpLost)) {
  const cells = r.runs.map((f) => `${f.won ? "" : f.died ? "dead " : "* "}${f.rounds}`.padStart(8) + String(f.hpLost).padStart(8)).join("");
  console.log(`  ${`${r.name} (${r.hp}hp, ${r.atk}atk)`.slice(0, 26).padEnd(26)}${cells}`);
}
console.log(`\n  "dead" = the player died on that round; "*" = the thing still stood after ${MAX_ROUNDS} rounds.\n`);
for (const [i, n] of SIZES.entries())
  console.log(
    `  with ${n} companions: median ${bySize[i]!.rounds} rounds, ${bySize[i]!.hp} hp lost, ` +
      `${bySize[i]!.down} companions struck down, ${bySize[i]!.died} of ${rows.length} fights killed the player`,
  );
console.log(
  `\nEvery companion standing with you swings on your turn, and the enemy's one blow rotates between all of you.\n` +
    `That is ${1 + COMPANIONS.slice(0, 4).length} attacks a round against one, and one blow in ${1 + COMPANIONS.slice(0, 4).length} landing on you. Nothing on the other side\n` +
    `scales with the crowd it faces, which is why a full party has never lost a companion and why an ability\n` +
    `that spends a charge to soften one blow in five has been offered 24 times and taken none.`,
);
