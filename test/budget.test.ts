/**
 * The token ceiling — tinyforge's equivalent of zork-unlimited's opening-density
 * budget, enforced on EVERY response the MCP surface would emit along the proven
 * walkthrough. A dev-loop agent that bloats observations goes red here.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { actionByLabel, condOk, newState, step } from "../src/engine.ts";
import { render, renderIntro } from "../src/format.ts";
import { loadWorld } from "../src/validate.ts";
import type { State, World } from "../src/types.ts";

const world: World = loadWorld(fileURLToPath(new URL("../world/lighthouse.json", import.meta.url)));

const AVG_CHARS_MAX = 450; // avg act-response size along the walkthrough
const MAX_CHARS_MAX = 1100; // no single response may exceed this
const INTRO_CHARS_MAX = 1400;

test("observation budget holds along the walkthrough", () => {
  let { state, events } = newState(world, 1);
  const seen = new Set<string>([state.room]);
  const intro = renderIntro(world, state, events);
  assert.ok(intro.text.length <= INTRO_CHARS_MAX, `intro ${intro.text.length} > ${INTRO_CHARS_MAX}`);

  const sizes: number[] = [];
  const doLabel = (label: string) => {
    const a = actionByLabel(world, state, label);
    assert.ok(a, `label ${label}`);
    const before: State = state;
    const out = step(world, state, a);
    state = out.state;
    const first = state.room !== before.room && !seen.has(state.room);
    seen.add(state.room);
    const r = render(world, state, out.events, { full: first });
    sizes.push(r.text.length);
    if (!state.ended) {
      assert.match(r.text, /^1 /m, "every open response carries a numbered menu");
    } else {
      assert.match(r.text, /receipt:/, "ended response carries the receipt");
    }
  };
  for (const w of world.walkthrough) {
    if (typeof w === "string") doLabel(w);
    else {
      let n = 0;
      while (!condOk(world, state, w.until) && n++ < w.max && !state.ended) doLabel(w.repeat);
    }
    if (state.ended) break;
  }
  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const max = Math.max(...sizes);
  assert.ok(avg <= AVG_CHARS_MAX, `avg ${avg.toFixed(0)} chars > ${AVG_CHARS_MAX}`);
  assert.ok(max <= MAX_CHARS_MAX, `max ${max} chars > ${MAX_CHARS_MAX}`);
});

test("menus stay small (numbered replies stay ~1 token)", () => {
  let { state } = newState(world, 1);
  const doLabel = (label: string) => {
    const a = actionByLabel(world, state, label);
    if (a) state = step(world, state, a).state;
  };
  for (const w of world.walkthrough) {
    if (typeof w === "string") doLabel(w);
    else {
      let n = 0;
      while (!condOk(world, state, w.until) && n++ < w.max && !state.ended) doLabel(w.repeat);
    }
    if (state.ended) break;
    const r = render(world, state, []);
    assert.ok(r.actions.length <= 12, `menu ${r.actions.length} > 12 at ${state.room}`);
  }
});
