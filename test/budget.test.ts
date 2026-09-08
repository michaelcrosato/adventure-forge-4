/**
 * The token ceiling — enforced on EVERY response the MCP surface would emit
 * along the proven walkthrough, for EVERY shipped world. A dev-loop agent that
 * bloats observations goes red here.
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { actionByLabel, condOk, newState, step } from "../src/engine.ts";
import { render, renderIntro } from "../src/format.ts";
import { loadWorld } from "../src/validate.ts";
import { MENU_CAP } from "../src/types.ts";
import type { Action, State, World } from "../src/types.ts";

const AVG_CHARS_MAX = 450; // avg act-response size along the walkthrough
const MAX_CHARS_MAX = 1100; // no single response may exceed this
const INTRO_CHARS_MAX = 1400;

const dir = fileURLToPath(new URL("../world", import.meta.url));
const worlds: World[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => loadWorld(join(dir, f)));

for (const world of worlds) {
  test(`observation budget holds along the walkthrough (${world.id})`, () => {
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

  test(`menus stay small along the walkthrough (${world.id})`, () => {
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
      assert.ok(r.actions.length <= MENU_CAP, `menu ${r.actions.length} > ${MENU_CAP} at ${state.room}`);
    }
  });
}

/**
 * The loop above only ever walks the proven walkthrough, which recruits one
 * companion — so it is structurally blind to a defect that scales with party
 * size. This builds a full party out of every npc the shipped world actually
 * carries a `companion` block for (never a hardcoded list, so a sixth
 * companion added tomorrow is covered the moment it ships) and renders a
 * full-party turn of each shape a player meets: one in combat, where every
 * companion also rolls an attack, and one on a plain move, where companions
 * are free to remark. It is the regression test for `partyRemarks` in
 * engine.ts: before that fix, every companion in the party could remark on
 * the same turn, and a full party's quarrel-flavored remarks plus their
 * attack rolls together blew well past the 1,100 cap.
 */
test("a full party never breaks the observation budget, in combat or on a plain move (reach)", () => {
  const reach = worlds.find((w) => w.id === "reach");
  assert.ok(reach, "world/reach.json must ship among the worlds under test");

  const companionIds = Object.keys(reach!.npcs).filter((id) => reach!.npcs[id]!.companion);
  assert.ok(companionIds.length >= 4, `expected the shipped world's companion roster, found ${companionIds.length}`);
  const companionNames = companionIds.map((id) => reach!.npcs[id]!.name);

  // a small standalone arena, not world/reach's own rooms: it borrows the
  // real companion definitions (their real hit, dmg, and remarks) so the
  // party is the genuine article, but nothing about a region file another
  // agent might be editing right now
  const arena: World = {
    id: "arena",
    title: "Arena",
    intro: "A bare floor for testing.",
    start: "arena_a",
    hp: 60,
    maxScore: 0,
    rooms: {
      arena_a: { name: "Arena", desc: "A bare stone floor, walls close on every side.", exits: { north: { to: "arena_b" } } },
      arena_b: { name: "Arena, far end", desc: "The far end of the same bare floor.", exits: { south: { to: "arena_a" } } },
    },
    items: {},
    npcs: {
      ...Object.fromEntries(companionIds.map((id) => [id, reach!.npcs[id]!])),
      foe: { name: "training dummy", room: "arena_a", hp: 300, atk: 3, df: 8, hostile: true },
    },
    walkthrough: [],
  };

  let { state } = newState(arena, 8802);
  state.party = [...companionIds];
  for (const id of companionIds) {
    state.npcRoom[id] = "arena_a";
    state.npcHp[id] = arena.npcs[id]!.hp ?? 20;
  }

  const seen = new Set<string>([state.room]);
  const screens: { kind: string; text: string; events: string[] }[] = [];
  const turn = (action: Action, kind: string) => {
    const before = state;
    const out = step(arena, state, action);
    state = out.state;
    const first = state.room !== before.room && !seen.has(state.room);
    seen.add(state.room);
    const r = render(arena, state, out.events, { full: first });
    screens.push({ kind, text: r.text, events: out.events });
  };

  // combat: the player attacks, every standing companion rolls too
  turn({ kind: "attack", npc: "foe" }, "combat");
  turn({ kind: "attack", npc: "foe" }, "combat");
  // a plain move: no attack rolls at all, only the company's own remarks
  turn({ kind: "go", dir: "north" }, "plain move");
  turn({ kind: "go", dir: "south" }, "plain move");

  for (const s of screens) {
    assert.ok(
      s.text.length <= MAX_CHARS_MAX,
      `${s.kind} screen is ${s.text.length} chars, over the ${MAX_CHARS_MAX} cap:\n${s.text}`,
    );
    // the fix itself: at most one companion remark reaches any one screen, no
    // matter how many stand in the party. (A companion's farewell prints the
    // same "Name: "..."" shape and is deliberately uncapped, but nothing here
    // ever lowers a companion's regard or sets a leave flag, so every such
    // line in this run is a remark, not a farewell.)
    const remarkLines = s.events.filter((e) => companionNames.some((n) => e.startsWith(`${n}: "`)));
    assert.ok(
      remarkLines.length <= 1,
      `${s.kind} turn carried ${remarkLines.length} companion remarks at once: ${remarkLines.join(" | ")}`,
    );
  }

  // Full-party combat legitimately costs more than a solo-companion screen —
  // every companion's own attack roll is real content, not chatter, and is
  // not what this fix caps — so both statistics are held to the same hard
  // per-screen ceiling AGENT.md sets absolutely, not the walkthrough's softer
  // 450 average (a property of a long, mostly-one-companion play that a
  // five- or six-strong company was never going to match).
  const avg = screens.reduce((a, s) => a + s.text.length, 0) / screens.length;
  const max = Math.max(...screens.map((s) => s.text.length));
  assert.ok(avg <= MAX_CHARS_MAX, `avg ${avg.toFixed(0)} chars > ${MAX_CHARS_MAX} across a full-party combat + plain-move turn`);
  assert.ok(max <= MAX_CHARS_MAX, `max ${max} chars > ${MAX_CHARS_MAX} across a full-party combat + plain-move turn`);
});
