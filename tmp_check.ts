import { actionByLabel, condOk, legalActions, newState, step } from "./src/engine.ts";
import { loadWorld } from "./src/validate.ts";

const world = loadWorld("world/vale.json");
let { state } = newState(world, 1);

const steps: (string | { repeat: string; until: any[]; max: number })[] = [
  "be an Envoy — words open doors that iron cannot",
  "go south",
  "go south",
  "ask gray priest: the old king",
  "ask gray priest: a blessing for the barrow",
  "go east",
  { repeat: "ask elder: the sealed coffer", until: ["has", "crown"], max: 25 },
  "go west",
  "go north",
  "go north",
  "go north",
  "go north",
  "go north",
  "go north",
  "go north",
  "perk: Second Wind (+3 max hp)",
  "go north",
  "go north",
  { repeat: "work out the stone verse", until: ["flag", "verse_stone"], max: 25 },
  "go up",
  "ask hollow king: why do you linger",
  "return the crown",
];

for (const w of steps) {
  if (typeof w === "string") {
    const a = actionByLabel(world, state, w);
    if (!a) {
      console.log(`FAIL: no legal action "${w}" at room=${state.room}, turn=${state.turn}`);
      console.log("legal actions:", legalActions(world, state).map((x) => x.id ?? JSON.stringify(x)));
      process.exit(1);
    }
    const out = step(world, state, a);
    state = out.state;
    console.log(`OK: "${w}" -> room=${state.room}, turn=${state.turn}, flags=${Object.keys(state.flags)}, has crown=${state.inv.includes("crown")}`);
  } else {
    let n = 0;
    while (!condOk(world, state, w.until)) {
      if (n++ >= w.max) { console.log("repeat exceeded max"); process.exit(1); }
      const a = actionByLabel(world, state, w.repeat);
      if (!a) { console.log(`FAIL repeat: no legal action "${w.repeat}" at room=${state.room}`); process.exit(1); }
      const out = step(world, state, a);
      state = out.state;
      console.log(`  repeat try ${n}: -> turn=${state.turn}, events=${JSON.stringify(out.events)}`);
    }
    console.log(`OK repeat "${w.repeat}" done after ${n} tries -> turn=${state.turn}`);
  }
}

console.log("Final room:", state.room, "turn:", state.turn, "flags:", Object.keys(state.flags));
