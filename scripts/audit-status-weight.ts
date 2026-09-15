/**
 * Where does the status ratchet's budget actually go?
 *
 * `test/format.test.ts`'s "the free status screen stays inside its own
 * ratchet along the walkthrough" test sums `renderStatus`'s whole output
 * across every status call along the walkthrough and holds the average
 * under a ceiling (3,650 at this writing) that only ever turns down. Item 11
 * in `docs/roadmap.md`'s order ("the act gate, and the budget that wouldn't
 * move") needs roughly 100 characters of headroom there before its already-
 * built `["regions", ">=", 6]` gate can ship, and its own investigation
 * spent most of a day finding only a handful of characters by trimming what
 * it happened to be looking at. What it never did is rank the realm's own
 * quest text by how much of that budget each stage actually spends — a
 * quest shown on 3 status calls and one shown on 130 cost the ratchet
 * nothing alike per character, but very differently in total, and nothing
 * before this measured that.
 *
 * This walks the walkthrough exactly like the ratchet test does, calling
 * `journal()` at every status point (not `renderStatus`, which would need
 * fragile text-parsing to recover per-quest lines) and sums, per distinct
 * (quest id, exact text) pair, `text.length * timesShown` — the same unit
 * the ratchet itself is measured in. The result is a ranked list of where a
 * cut actually pays, not a guess. The first real find from it: `ir_writ`'s
 * fallback stage was the single largest line in the realm (120 chars x 130
 * calls), and it restated both its own quest name ("The Regent's Writ") and
 * `main`'s own stage 4 ("earn the Regent's writ... any opens Coldpass") —
 * confirmed co-active for all 130 of those calls, not assumed. Trimmed to
 * the one thing it uniquely said (who grants it, what it costs); the
 * ratchet's own average moved 3,632.5 -> 3,616.2, roughly half again the
 * total headroom item 11 had going into that one edit. The next three
 * biggest contributors after it (`th_q_rook`, `th_q_after`, `ir_q_after`)
 * were checked by hand against this same ranking and found to carry no
 * restated fact — each is a self-contained, non-redundant line, and
 * shortening any of them further would be cutting content, not repetition,
 * exactly what this project's own bar does not want.
 *
 * This does not find cuts by itself — it only says where a real one, if it
 * exists, is worth the most. Confirm co-activity with a real quest before
 * touching anything the ranking surfaces (see `checkCoActive` below, or
 * write a throwaway script the way this file's own docstring above was
 * verified) rather than trusting that a high rank means redundancy; most of
 * the realm's text earns its place regardless of how often it is shown.
 *
 *   node --import tsx scripts/audit-status-weight.ts world/reach.json [--top N]
 */
import { actionByLabel, condOk, journal, newState, step } from "../src/engine.ts";
import { loadWorld } from "../src/validate.ts";
import type { World } from "../src/types.ts";

const [path, ...rest] = process.argv.slice(2);
if (!path) {
  console.error("usage: node --import tsx scripts/audit-status-weight.ts <world.json> [--top N]");
  process.exit(2);
}
const top = rest.includes("--top") ? Number(rest[rest.indexOf("--top") + 1]) : 20;
const world: World = loadWorld(path);

type Row = { id: string; name: string; text: string; calls: number };
const contrib = new Map<string, Row>();

let { state } = newState(world, 1);
const note = () => {
  for (const q of journal(world, state)) {
    if (q.status !== "active" || !q.text) continue;
    const key = `${q.id}::${q.text}`;
    const row = contrib.get(key) ?? { id: q.id, name: q.name, text: q.text, calls: 0 };
    row.calls++;
    contrib.set(key, row);
  }
};
note();
for (const w of world.walkthrough ?? []) {
  const label = typeof w === "string" ? w : w.repeat;
  let k = 0;
  do {
    const a = actionByLabel(world, state, label);
    if (!a) break;
    state = step(world, state, a).state;
    note();
  } while (typeof w !== "string" && !condOk(world, state, w.until) && ++k < w.max && !state.ended);
  if (state.ended) break;
}

const rows = [...contrib.values()]
  .map((r) => ({ ...r, weight: r.text.length * r.calls }))
  .sort((a, b) => b.weight - a.weight);
const totalWeight = rows.reduce((a, r) => a + r.weight, 0);

console.log(`top ${top} quest-stage contributions to the status ratchet, by chars-shown x calls-shown:\n`);
for (const r of rows.slice(0, top)) {
  console.log(`${String(r.weight).padStart(7)}  (${r.text.length} chars x ${r.calls} calls)  [${r.id}] ${r.name}: ${r.text}`);
}
console.log(`\n${rows.length} distinct quest-stage texts shown along the walkthrough; total weight ${totalWeight}.`);
console.log(`Before acting on a high rank: confirm what else is co-active on the same calls (a road quest, another side`);
console.log(`quest, the room's own text) before assuming its text is redundant rather than merely frequent.`);
