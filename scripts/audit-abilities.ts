/**
 * Why an ability never appeared — clause by clause, along the proven routes.
 *
 * Replaying wave four's traces said one of nine class abilities was ever
 * pressed and eight were never once *offered*. That number says something is
 * wrong and nothing about what, because "never offered" has three completely
 * different causes and only one of them is a bug:
 *
 *   1. no proven route plays that class at all (nine proofs: six Scholar, two
 *      Warden, one Envoy, and no Scout — so a Scout ability cannot appear),
 *   2. the class is played but the resource is spent or never granted,
 *   3. the class is played, the resource is there, and the *conditions* never
 *      coincide — `scholar_name` wants a horror in the room AND a companion
 *      holding the line AND you under a third of your hp, all on one turn.
 *
 * Only (3) is an authoring mistake, and telling it from (1) needs a per-clause
 * count rather than a per-ability one. So: replay the walkthrough and every
 * `proofs` route, and on every screen evaluate each ability's conditions one
 * clause at a time. The clause with the fewest true turns is the one keeping
 * the ability off the menu, and it is named.
 *
 *   npx tsx scripts/audit-abilities.ts world/reach.json
 *   npx tsx scripts/audit-abilities.ts world/reach.json --terse
 *
 * The verdict line counts abilities that are gated on a conjunction no proven
 * route ever satisfies while their class was being played — the ones a real
 * player of that class would never see.
 */
import { actionByLabel, condOk, legalActions, newState, step } from "../src/engine.ts";
import { loadWorld } from "../src/validate.ts";
import type { AbilityDef, Cond, State, World } from "../src/types.ts";

process.stdout.on("error", (e: NodeJS.ErrnoException) => { if (e.code === "EPIPE") process.exit(0); });

const [path, ...rest] = process.argv.slice(2);
if (!path) { console.error("usage: npx tsx scripts/audit-abilities.ts <world.json> [--terse]"); process.exit(2); }
const terse = rest.includes("--terse");
const world: World = loadWorld(path);
const abilities = Object.entries(world.abilities ?? {}) as [string, AbilityDef][];
if (!abilities.length) { console.log(`${path} — ${world.id}: no abilities`); process.exit(0); }

const isClassClause = (c: Cond) => c[0] === "class";
/** An ability's own class gate, if it has one — the clause that decides whether a route can ever see it. */
const classOf = (a: AbilityDef): string | undefined => {
  const c = (a.if ?? []).find(isClassClause);
  return c ? String(c[1]) : undefined;
};

type Tally = {
  /** turns on which the class gate held (0 = no proven route plays it) */
  classTurns: number;
  /** per non-class clause, turns it held *while the class gate held* */
  clause: number[];
  /** turns every clause held together — the ability stood on the menu */
  all: number;
  /** the routes on which it stood on the menu at least once */
  routes: Set<string>;
};

/**
 * Screens with a hostile standing in the room, in total and per class — the
 * denominator that makes "1.6% of screens" legible. Nearly every gate here
 * names a hostile, and something stands to fight on about one screen in
 * twenty-five, so an ability on 1.6% of a class's screens is on something like
 * *half its fights*, which is a working ability and not a broken one.
 */
let fightScreens = 0;
const fightsByClass = new Map<string, number>();

const tally = new Map<string, Tally>(
  abilities.map(([id, a]) => [id, { classTurns: 0, clause: (a.if ?? []).filter((c) => !isClassClause(c)).map(() => 0), all: 0, routes: new Set<string>() }]),
);

/** Replay one route, sampling every ability's clauses on every screen it renders. */
function walk(steps: World["walkthrough"], what: string): number {
  let { state } = newState(world, 1);
  let turns = 0;
  const sample = () => {
    turns++;
    const legal = legalActions(world, state);
    if (legal.some((l) => l.kind === "attack")) {
      fightScreens++;
      const c = state.classId ?? "-";
      fightsByClass.set(c, (fightsByClass.get(c) ?? 0) + 1);
    }
    const menu = new Set(legal.filter((l) => l.kind === "ability").map((l) => l.id));
    for (const [id, a] of abilities) {
      const t = tally.get(id)!;
      const cls = classOf(a);
      if (cls && state.classId !== cls) continue;
      t.classTurns++;
      const others = (a.if ?? []).filter((c) => !isClassClause(c));
      others.forEach((c, i) => { if (condOk(world, state, c)) t.clause[i]!++; });
      if (menu.has(id)) { t.all++; t.routes.add(what); }
    }
  };
  const doLabel = (label: string) => {
    const a = actionByLabel(world, state, label);
    if (!a) { console.error(`${what} is broken at step ${turns + 1}: no action "${label}" in ${state.room}`); process.exit(1); }
    state = step(world, state, a).state;
    sample();
  };
  sample(); // the opening screen counts: an ability can be offered before you move
  for (const w of steps) {
    if (typeof w === "string") doLabel(w);
    else { let n = 0; while (!condOk(world, state, w.until) && n++ < w.max && !state.ended) doLabel(w.repeat); }
    if (state.ended) break;
  }
  return turns;
}

const routes: [string, World["walkthrough"]][] = [
  ["walkthrough", world.walkthrough],
  ...Object.entries(world.proofs ?? {}).map(([k, v]) => [k, v] as [string, World["walkthrough"]]),
];
let screens = 0;
for (const [name, steps] of routes) screens += walk(steps, name);

const classesPlayed = new Map<string, number>();
for (const [, a] of abilities) { const c = classOf(a); if (c) classesPlayed.set(c, tally.get(abilities.find(([, x]) => x === a)![0])!.classTurns); }

/** The clause keeping an ability off the menu: the rarest one, by true-turns while its class was played. */
function binding(id: string, a: AbilityDef): { clause: Cond; turns: number } | undefined {
  const others = (a.if ?? []).filter((c) => !isClassClause(c));
  const t = tally.get(id)!;
  let best: { clause: Cond; turns: number } | undefined;
  others.forEach((c, i) => { const n = t.clause[i]!; if (!best || n < best.turns) best = { clause: c, turns: n }; });
  return best;
}

const unseen = abilities.filter(([id]) => tally.get(id)!.all === 0);
const noClass = unseen.filter(([id]) => tally.get(id)!.classTurns === 0);
const conjunction = unseen.filter(([id]) => tally.get(id)!.classTurns > 0);

if (terse) {
  console.log(`abilities ${abilities.length} offered ${abilities.length - unseen.length} unproven-class ${noClass.length} never-coincide ${conjunction.length} screens ${screens}`);
  process.exit(0);
}

console.log(`${path} — ${world.id}: ${abilities.length} abilities over ${routes.length} proven routes, ${screens} screens`);
console.log(
  `something stood in the room to fight on ${fightScreens} of them (${((fightScreens / screens) * 100).toFixed(1)}%) — most of these gates ` +
    `name a hostile, so read every share below against that, not against 100%\n`,
);
for (const [id, a] of abilities) {
  const t = tally.get(id)!;
  const cls = classOf(a) ?? "any class";
  const head = `${id}  [${cls}]  "${a.label}"`;
  if (t.classTurns === 0) {
    console.log(`${head}\n    NEVER PLAYABLE HERE — no proven route is a ${cls}, so nothing in this repo can offer it`);
    continue;
  }
  const pct = (n: number) => `${((n / t.classTurns) * 100).toFixed(1)}%`;
  // only for the ones that require a fight: dividing an out-of-combat ability's
  // screens by the fight count reads like a share and is not one
  const fights = fightsByClass.get(classOf(a) ?? "-") ?? 0;
  const ofFights = a.context === "combat" && fights ? `, which is ${((t.all / fights) * 100).toFixed(0)}% of the ${fights} fights on that road` : "";
  console.log(`${head}\n    ${t.classTurns} screens as a ${cls}; on the menu ${t.all} of them (${pct(t.all)})${ofFights}${t.all ? ` — ${[...t.routes].join(", ")}` : ""}`);
  const others = (a.if ?? []).filter((c) => !isClassClause(c));
  others.forEach((c, i) => {
    const n = t.clause[i]!;
    console.log(`      ${n === 0 ? "NEVER  " : String(n).padStart(7)}  ${JSON.stringify(c)}${n === 0 ? "  <- this clause alone is never true" : ` (${pct(n)})`}`);
  });
  if (t.all === 0 && others.length > 1) {
    const b = binding(id, a);
    console.log(`      all together: NEVER. ${others.length} clauses at once; the rarest is ${JSON.stringify(b!.clause)} at ${b!.turns}`);
  }
}

console.log();
if (noClass.length)
  console.log(
    `${noClass.length} of ${abilities.length} abilities belong to a class no proven route plays (${[...new Set(noClass.map(([, a]) => classOf(a)))].join(", ")}). ` +
      `That is a hole in the proofs, not in the content: add a route that plays it and the numbers become real.`,
  );
if (conjunction.length)
  console.log(
    `${conjunction.length} of ${abilities.length} were playable and still never once offered — their conditions never coincide on any proven route. ` +
      `An ability a player of that class cannot see is a promise the class screen makes and the game never keeps.`,
  );
if (!unseen.length) console.log(`every ability stood on the menu at least once. Being offered is not being worth pressing, but it is the floor.`);
process.exit(0);
