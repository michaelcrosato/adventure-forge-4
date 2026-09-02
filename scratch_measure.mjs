import { actionByLabel, condOk, newState, step } from "./src/engine.ts";
import { render, renderIntro } from "./src/format.ts";
import { loadWorld } from "./src/validate.ts";

const world = loadWorld("./world/vale.json");
let { state, events } = newState(world, 1);
const seen = new Set([state.room]);
const sizes = [];
const doLabel = (label) => {
  const a = actionByLabel(world, state, label);
  const before = state;
  const out = step(world, state, a);
  state = out.state;
  const first = state.room !== before.room && !seen.has(state.room);
  seen.add(state.room);
  const r = render(world, state, out.events, { full: first });
  sizes.push(r.text.length);
};
for (const w of world.walkthrough) {
  if (typeof w === "string") doLabel(w);
  else {
    let n = 0;
    while (!condOk(world, state, w.until) && n++ < w.max && !state.ended) doLabel(w.repeat);
  }
  if (state.ended) break;
}
console.log("count", sizes.length);
const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
console.log("avg", avg);
console.log("last size", sizes[sizes.length - 1]);
