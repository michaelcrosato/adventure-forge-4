/**
 * A speaker's line, as the player reads it.
 *
 * The engine adds the quotes that make a line read as speech. 236 of the
 * realm's 1,957 topic lines already carry a quote of their own, because the
 * author wrote the attribution themselves — narration then speech, or speech
 * interrupted by it — and wrapping those again renders `Vell: ""Mine," Vell
 * says...`: doubled at the open, unbalanced at the close. Found by playing,
 * not by any tool, which is why it lived in 12% of the realm's dialogue.
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { speaks } from "../src/engine.ts";
import { loadWorld } from "../src/validate.ts";
import type { World } from "../src/types.ts";

const dir = fileURLToPath(new URL("../world", import.meta.url));
const worlds: World[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => loadWorld(join(dir, f)));

for (const world of worlds) {
  test(`a line that punctuated itself is not quoted again (${world.id})`, () => {
    let checked = 0;
    for (const [npc, def] of Object.entries(world.npcs)) {
      for (const t of def.topics ?? []) {
        if (typeof t.say !== "string" || !t.say.includes('"')) continue;
        // `speaks` is the engine's own, exported so this checks the shipped
        // function against shipped content rather than a copy of the rule
        const line = speaks(def.name, t.say);
        checked++;
        assert.ok(!line.startsWith(`${def.name}: ""`), `doubled open quote: ${line.slice(0, 80)}`);
        // the engine's own closing quote, appended after the author's, leaves an odd count
        assert.equal((line.match(/"/g) ?? []).length % 2, 0, `unbalanced quotes: ${line.slice(0, 80)}`);
      }
    }
    // the realm has 236 such lines; the small worlds may legitimately have none
    if (world.id === "reach") assert.ok(checked > 100, `expected the realm's self-quoted lines, found ${checked}`);
  });
}

test("a bare line still gets the engine's quotes", () => {
  assert.equal(speaks("Lys", "Quiet out here."), 'Lys: "Quiet out here."');
  assert.equal(speaks("Vell", '"Mine," Vell says.'), 'Vell: "Mine," Vell says.');
  assert.equal(speaks("Osk", "He is quiet, then: \"Let it be the one that did.\""), 'Osk: He is quiet, then: "Let it be the one that did."');
});
