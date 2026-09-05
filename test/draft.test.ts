/**
 * The realm under construction. drafts/reach.json is the Gray Reach's root
 * while its regions are being written; it lives outside world/ so the shipped
 * worlds' tests do not see it, but the same bar applies to it at every commit:
 * it validates, and its walkthrough stays inside the token budget. This test
 * moves to the world/ glob (and disappears) when the realm ships.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { actionByLabel, condOk, newState, step } from "../src/engine.ts";
import { render, renderIntro } from "../src/format.ts";
import { loadWorld, validateWorld } from "../src/validate.ts";
import { MENU_CAP } from "../src/types.ts";

const path = fileURLToPath(new URL("../drafts/reach.json", import.meta.url));

test("the draft realm validates and its walkthrough holds the budget", { skip: !existsSync(path) }, () => {
  const world = loadWorld(path);
  assert.deepEqual(validateWorld(world), []);
  let { state, events } = newState(world, 1);
  const seen = new Set<string>([state.room]);
  assert.ok(renderIntro(world, state, events).text.length <= 1400);
  const sizes: number[] = [];
  const doLabel = (label: string) => {
    const a = actionByLabel(world, state, label);
    assert.ok(a, `label ${label} at ${state.room}`);
    const before = state.room;
    const out = step(world, state, a);
    state = out.state;
    const first = state.room !== before && !seen.has(state.room);
    seen.add(state.room);
    const r = render(world, state, out.events, { full: first });
    sizes.push(r.text.length);
    assert.ok(r.actions.length <= MENU_CAP, `menu ${r.actions.length} at ${state.room}`);
  };
  for (const w of world.walkthrough) {
    if (typeof w === "string") doLabel(w);
    else { let n = 0; while (!condOk(world, state, w.until) && n++ < w.max && !state.ended) doLabel(w.repeat); }
    if (state.ended) break;
  }
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  assert.ok(avg <= 450, `avg ${avg.toFixed(0)} chars > 450`);
  assert.ok(Math.max(...sizes) <= 1100, `max ${Math.max(...sizes)} chars > 1100`);
});
