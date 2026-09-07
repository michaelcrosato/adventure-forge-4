/**
 * Content rules the shipped worlds must keep — checked against the real world
 * files, so a dev-loop content change cannot quietly reintroduce them.
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { actionByLabel, newState, step } from "../src/engine.ts";
import { loadWorld } from "../src/validate.ts";
import type { Fx, World } from "../src/types.ts";

const dir = fileURLToPath(new URL("../world", import.meta.url));
const worlds: World[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => loadWorld(join(dir, f)));

/** Every check in an fx list, including those nested in other checks' branches. */
function checks(fxs: Fx[] | undefined): Extract<Fx, [op: "check", ...rest: unknown[]]>[] {
  const out: Extract<Fx, [op: "check", ...rest: unknown[]]>[] = [];
  for (const fx of fxs ?? []) {
    if (fx[0] === "if") out.push(...checks(fx[2]), ...checks(fx[3]));
    if (fx[0] === "chance") out.push(...checks(fx[2]), ...checks(fx[3]));
    if (fx[0] !== "check") continue;
    out.push(fx);
    out.push(...checks(fx[3]), ...checks(fx[4]));
  }
  return out;
}

for (const world of worlds) {
  test(`no menu label calls a failed attempt safe when its failure costs hp (${world.id})`, () => {
    // Regression for a playtest finding: "force the doors — safe to try as many
    // times as you like" cost 1 hp per failed roll and killed a player.
    const offenders: string[] = [];
    const inspect = (where: string, label: string, fx: Fx[] | undefined) => {
      const costly = checks(fx).some((c) => c[4].some((f) => f[0] === "hp" && f[1] < 0));
      if (costly && /safe to try|no risk|costs nothing|nothing to lose/i.test(label)) offenders.push(`${where}: "${label}"`);
    };
    for (const [rid, room] of Object.entries(world.rooms))
      for (const a of room.actions ?? []) inspect(`room ${rid} action ${a.id}`, a.label, a.fx);
    for (const [nid, npc] of Object.entries(world.npcs))
      for (const t of npc.topics ?? []) inspect(`npc ${nid} topic ${t.id}`, `ask ${npc.name}: ${t.label}`, t.fx);
    assert.deepEqual(offenders, []);
  });
}

test("vale: asking the elder about the coffer early rewards xp once, and the clue stays available", () => {
  // Regression: both early-coffer topics granted 1 xp on every repeat, so a
  // player could level up indefinitely without leaving the village.
  const vale = worlds.find((w) => w.id === "vale");
  assert.ok(vale, "vale world present");
  let { state } = newState(vale, 1);
  state = step(vale, state, { kind: "classpick", id: "warden" }).state;
  const go = (label: string) => {
    const a = actionByLabel(vale, state, label);
    assert.ok(a, `legal action "${label}" at ${state.room}`);
    state = step(vale, state, a).state;
  };
  for (const l of ["go south", "go south", "go east"]) go(l);
  assert.equal(state.room, "elder_house");
  const before = state.xp;
  go("ask elder: the sealed coffer");
  assert.equal(state.xp, before + 1, "the first ask is rewarded");
  go("ask elder: the sealed coffer");
  go("ask elder: the sealed coffer");
  assert.equal(state.xp, before + 1, "repeats are not");
  assert.ok(actionByLabel(vale, state, "ask elder: the sealed coffer"), "the clue is still on the menu");
  // switching to the seal-in-hand variant does not re-arm the reward either
  state.inv.push("kings_seal");
  state.itemLoc["kings_seal"] = "inv";
  go("ask elder: the sealed coffer");
  assert.equal(state.xp, before + 1);
});
