import { actionByLabel, newState, step } from "./src/engine.ts";
import { render } from "./src/format.ts";
import { loadWorld } from "./src/validate.ts";

const world = loadWorld("world/vale.json");
let { state } = newState(world, 1);
const seen = new Set([state.room]);
const sizes: number[] = [];
const doLabel = (label: string) => {
  const a = actionByLabel(world, state, label);
  if (!a) throw new Error("no action " + label);
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
}
const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
console.log("avg", avg, "max", Math.max(...sizes), "n", sizes.length);
console.log(sizes.map((s, i) => `${i}:${s}`).join(" "));
