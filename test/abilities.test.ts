/**
 * A class ability nobody is ever offered is a promise the character screen
 * makes and the game never keeps.
 *
 * Replaying wave four's traces said one of nine abilities was pressed and
 * eight were never once *offered*. `scripts/audit-abilities.ts` took that
 * apart clause by clause and found three different causes, only one of which
 * is an authoring mistake — so the ratchet here is per ability, with the
 * reason written down, rather than one number nobody can act on.
 *
 * The rule: every ability a proven route can reach must stand on that route's
 * menu at least once. UNPROVEN below names the exceptions and why; anything
 * else that goes unoffered fails, which is what holds the next ability added
 * to the same bar.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { actionByLabel, condOk, legalActions, newState, step } from "../src/engine.ts";
import { loadWorld } from "../src/validate.ts";
import type { State, World } from "../src/types.ts";

const world: World = loadWorld("world/reach.json");

/**
 * Abilities no proven route offers, and the reason each one is not a defect
 * the content can fix today. Every entry is a debt: `scripts/audit-abilities.ts`
 * prints the same list with its numbers, and this set may only shrink.
 */
const UNPROVEN: Record<string, string> = {
  // Nine proofs: six Scholar, two Warden, one Envoy. A Scout has never been
  // played to an ending here, so all three of its abilities are unreachable by
  // construction — a hole in the proofs, not in the content.
  scout_mark: "no proven route plays a Scout",
  scout_ground: "no proven route plays a Scout",
  scout_hands: "no proven route plays a Scout",
  // `companionDown` was false on all 431 warden screens, and the traces say why:
  // companions took 18 blows across every proven route and 1-8 in a whole blind
  // run, never enough to drop one. The gate is the right gate; what is missing is
  // a fight long enough to need it.
  warden_weight: "no companion has ever gone down on a proven route",
  // Gold peaks at exactly 3 on all ten routes, while real blind players finish
  // holding 17-36. The proofs walk past the realm's coin; the price is not wrong.
  envoy_buy_off: "no proven route ever holds 5 gold",
};

test("every ability a proven route can reach is offered on it at least once", () => {
  const ids = Object.keys(world.abilities ?? {});
  const offered = new Set<string>();
  const classesPlayed = new Set<string>();

  const walk = (steps: World["walkthrough"]) => {
    let { state } = newState(world, 1);
    const sample = () => {
      if (state.classId) classesPlayed.add(state.classId);
      for (const l of legalActions(world, state)) if (l.kind === "ability") offered.add(l.id);
    };
    const doLabel = (label: string) => {
      const a = actionByLabel(world, state, label);
      assert.ok(a, `no action "${label}" in ${state.room}`);
      state = step(world, state, a!).state as State;
      sample();
    };
    sample();
    for (const w of steps) {
      if (typeof w === "string") doLabel(w);
      else { let n = 0; while (!condOk(world, state, w.until) && n++ < w.max && !state.ended) doLabel(w.repeat); }
      if (state.ended) break;
    }
  };
  walk(world.walkthrough);
  for (const steps of Object.values(world.proofs ?? {})) walk(steps);

  const missing = ids.filter((id) => !offered.has(id) && !(id in UNPROVEN));
  assert.deepEqual(
    missing,
    [],
    `never offered on any proven route, and not a known debt:\n  ${missing.join("\n  ")}\n` +
      `Run \`npx tsx scripts/audit-abilities.ts world/reach.json\` — it names the clause keeping each one off the menu.`,
  );

  // and the debts stay honest: an entry that has quietly started being offered
  // is a line to delete, not a comment to leave lying
  const stale = Object.keys(UNPROVEN).filter((id) => offered.has(id));
  assert.deepEqual(stale, [], `these are offered now — drop them from UNPROVEN:\n  ${stale.join("\n  ")}`);
  // an entry naming an ability that no longer exists is the same kind of lie
  const gone = Object.keys(UNPROVEN).filter((id) => !ids.includes(id));
  assert.deepEqual(gone, [], `UNPROVEN names abilities the world no longer has:\n  ${gone.join("\n  ")}`);
});

test("every class has something of its own to spend a charge on outside a fight", () => {
  // Every one of the first nine abilities but `envoy_press` required a hostile
  // in the room, and something stands to fight on 4.1% of screens — so a
  // Warden's and a Scholar's whole kit sat behind a door that opens one screen
  // in twenty-five, and the class was a stat line the rest of the time.
  const combatOnly = (id: string) => world.abilities![id]!.context === "combat";
  for (const classId of Object.keys(world.classes ?? {})) {
    const own = Object.entries(world.abilities ?? {}).filter(([, a]) =>
      (a.if ?? []).some((c) => c[0] === "class" && c[1] === classId),
    );
    assert.ok(own.length, `class ${classId} has no abilities at all`);
    const outside = own.filter(([id]) => !combatOnly(id));
    assert.ok(outside.length, `class ${classId} can only act in a fight: ${own.map(([id]) => id).join(", ")}`);
  }
});
