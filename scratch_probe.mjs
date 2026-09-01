import { actionByLabel, condOk, newState, step } from './src/engine.ts';
import { render, renderIntro } from './src/format.ts';
import { loadWorld } from './src/validate.ts';
const world = loadWorld('world/vale.json');

let { state, events } = newState(world, 1);
const seen = new Set([state.room]);
const intro = renderIntro(world, state, events);
console.log('intro len', intro.text.length);

const sizes = [];
const doLabel = (label) => {
  const a = actionByLabel(world, state, label);
  if (!a) { console.log('MISSING LABEL', label, 'at', state.room); return; }
  const before = state;
  const out = step(world, state, a);
  state = out.state;
  const first = state.room !== before.room && !seen.has(state.room);
  seen.add(state.room);
  const r = render(world, state, out.events, { full: first });
  sizes.push([label, r.text.length]);
};
for (const w of world.walkthrough) {
  if (typeof w === 'string') doLabel(w);
  else {
    let n = 0;
    while (!condOk(world, state, w.until) && n++ < w.max && !state.ended) doLabel(w.repeat);
  }
  if (state.ended) break;
}
for (const [label, len] of sizes) console.log(len, label);
const avg = sizes.reduce((a, b) => a + b[1], 0) / sizes.length;
const max = Math.max(...sizes.map(x => x[1]));
console.log('avg', avg.toFixed(1), 'max', max, 'count', sizes.length);
