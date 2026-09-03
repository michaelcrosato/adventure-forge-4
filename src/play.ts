/**
 * tinyforge human CLI — play in a terminal: `npm run play [-- seed]`.
 * Type a menu number (or an action label). `look` re-shows the room. `q` quits.
 */
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { actionByLabel, inClassPhase, inPerkPickPhase, newState, step } from "./engine.ts";
import { render, renderIntro } from "./format.ts";
import { loadWorld } from "./validate.ts";

const seed = Number(process.argv[2] ?? Math.floor(Math.random() * 1e9));
const world = loadWorld(process.env.TF_WORLD ?? fileURLToPath(new URL("../world/vale.json", import.meta.url)));
let { state, events } = newState(world, seed);
const seen = new Set<string>(inClassPhase(world, state) ? [] : [state.room]);
let out = renderIntro(world, state, events);
console.log(out.text);

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl.setPrompt("> ");
rl.prompt();
rl.on("line", (line) => {
  const cmd = line.trim().toLowerCase();
  if (cmd === "q" || cmd === "quit") process.exit(0);
  if (cmd === "look") {
    console.log(render(world, state, [], { full: true }).text);
    rl.prompt();
    return;
  }
  const n = Number(cmd);
  const action = Number.isInteger(n) && n >= 1 ? out.actions[n - 1] : actionByLabel(world, state, cmd);
  if (!action) {
    console.log("Pick a menu number.");
    rl.prompt();
    return;
  }
  const res = step(world, state, action);
  state = res.state;
  const first = !seen.has(state.room);
  if (!inClassPhase(world, state) && !inPerkPickPhase(world, state)) seen.add(state.room);
  out = render(world, state, res.events, { full: first });
  console.log(out.text);
  if (state.ended) process.exit(0);
  rl.prompt();
});
