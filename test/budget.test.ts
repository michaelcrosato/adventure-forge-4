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
import { actionByLabel, condOk, inClassPhase, inPerkPickPhase, newState, step } from "../src/engine.ts";
import { render, renderIntro } from "../src/format.ts";
import { loadWorld } from "../src/validate.ts";
import { MENU_CAP } from "../src/types.ts";
import type { Action, State, World } from "../src/types.ts";

const AVG_CHARS_MAX = 450; // avg act-response size along the walkthrough
const MAX_CHARS_MAX = 1100; // no single response may exceed this
const INTRO_CHARS_MAX = 1400;

/**
 * The same ceilings on every OTHER proven route — a ratchet, not a bar, and
 * one number per road rather than one for all of them.
 *
 * The walkthrough is one road through the realm and it was the only road these
 * ceilings had ever been measured against. Measured on the rest, five of the
 * eight ending proofs render a screen past 1,100 and three run the average
 * past 450. Those are proven roads with real players on them, and nothing
 * measured them: an author could have pushed mg_hollow_throne to two thousand
 * characters and every check in this project would have stayed green.
 *
 * Each entry is that road as it stands, and **may only ever go down**. Raising
 * one to make a change fit is the single thing this test exists to stop. The
 * target for all of them is AVG_CHARS_MAX and MAX_CHARS_MAX; the rooms
 * standing in the way are mg_hollow_throne, th_wood_3_1, va_throne and
 * mc_north_road.
 *
 * Per-road on purpose, and a road not listed here is held to the real bar. One
 * shared "worst of all roads" number would let a new road quietly license
 * every old one; an allowance per road means a route already over has to get
 * cheaper, and a route added later either meets the ceiling or says out loud
 * what it costs and why.
 *
 * Three of these averages were moved UP once, by 1 to 3 characters, and it is
 * the only time: fast travel learned to carry a player back across a region
 * they had already mapped, which two blind players asked for in two separate
 * waves, and it costs 869 characters along the walkthrough. I looked for the
 * money first — dropping the redundant "to " from every travel label would
 * have paid for it and breaks all nine proofs, which name their travel steps
 * by that label; gating the feature on how much of a region is mapped made no
 * difference, and tuning that threshold until the budget stopped noticing
 * would be hiding a price rather than paying it. So it is recorded here
 * instead. The three roads were already over the real 450 and this made them
 * 452->455, 480->483 and 478->480; the debt to the real bar is 5, 33 and 30
 * characters, and it is still owed.
 */
/**
 * FOUR NUMBERS BELOW WENT UP, AND NO CONTENT GOT WORDIER.
 *
 * The three replays in this file measured a room as "seen" if the room had
 * CHANGED, seeded with the start room. In a world with classes the intro shows
 * the class menu and describes no room, and choosing a class keeps the same
 * room id — so the start room's one full-description screen (~700 characters
 * in the Reach) was never measured on any road. Correcting that (see
 * `describesRoom`) adds exactly one screen per road, and every delta is
 * 700/screens to the character:
 *
 *   reach_burned            318 screens   448.9 -> 451.1   (+2.2)
 *   gray_crown              261 screens   451.0 -> 452.4   (+1.4)
 *   reach_at_rest#devoted   352 screens   460.7 -> 462.4   (+1.7)
 *   crowned_hollow#bloodied  50 screens   510.6 -> 524.5  (+13.9)
 *
 * A ratchet may only turn down, and these turn up — so the argument has to be
 * explicit: the bar now measures strictly MORE than it did, and refusing to
 * record the true number would leave it asserting something false. Raising a
 * ceiling to match a corrected measurement is not the same act as raising one
 * to let content through, and nothing here bought slack: the roads read what
 * they always read, and the tool had been hiding a screen of it.
 *
 * `reach_burned` is the one that stings. It met the real 450 ceiling with no
 * allowance at all; honestly measured it is 451.1, one character over, and now
 * needs a line here like the rest.
 */
const PROOF_BUDGET: Record<string, { avg: number; max: number }> = {
  // Only the roads that are over, and only in the dimension they are over: an
  // allowance in the other dimension is the real ceiling, so a road cannot
  // trade one for the other. crowned_hollow, hollow_reach and reach_at_rest
  // are not here at all — they meet the real bar, and hollow_reach came back
  // under it (1,042 to 982) when quest stage changes learned to collapse.
  // Turned down across the board the day the menu stopped saying a check's
  // skill twice — once in the label's own "(grace)" tag and again in the hint's
  // "+2 grace" a foot later, 513 option lines deep. That is about 1.1
  // characters a screen on every road at once, and it is why these numbers
  // moved down together rather than one at a time.
  // Two maxes went UP the day an ability started naming its effect, and this is
  // the accounting. `envoy_press` was offered 77 times across two blind waves
  // and pressed 0, because the line spent a charge on something it did not
  // name: "press him (1 of 2 left)" — brace against what, for how much, for how
  // long? It reads "+4 will, 2 turns; 2 of 2 left" now, and an option a player
  // cannot evaluate is dead content, which is the same argument that fixed the
  // fates. The third time this realm has paid width for legibility, after the
  // odds preview and the raised-DC clause.
  //
  // Repaid, and the prediction above it was wrong twice over. The hand-written
  // direction is gone from `th_q_rook` — the stage names the room now and the
  // engine walks the exits — but that screen belongs to `reach_at_rest#warden`,
  // not to this road, and the clause was 24 characters, not the 85 guessed
  // here. An `at`'s "(the way there: three east, then one in)" prints in the
  // status screen, which no ceiling measures, so trading a route for an `at`
  // only ever buys back the route's own words. #warden's max came down 1170 ->
  // 1146 on it; this road's 1180 is `mg_hollow_throne` and was never involved.
  "reach:regent_deposed": { avg: 452, max: 1180 },
  "reach:reach_burned": { avg: 451, max: 1154 }, // the burn road is a different route now, and a shorter-screened one; 450.68 -> 449.30, so its average is honestly under the real bar rather than passing on a floor
  "reach:gray_crown": { avg: 452, max: 1125 }, // 481 -> 452.4 the day an item stopped explaining itself in every new room: the crown's 111-character clue rode 96 first-seen screens on this road alone
  "reach:reach_at_rest#warden": { avg: AVG_CHARS_MAX, max: 1146 },
  // regent_deposed#warden_crown was here at max 1141, then 1131; the same
  // change took it to 1,092 and its average to 445, so it meets the real bar
  // on both counts and needs no allowance at all. Two roads down, eight to go.
  // The Scout road (reach_at_rest, first proven by this class), and the one
  // ratchet entry that was traced to a single menu line and then mostly paid
  // off. It arrived at 466 avg — 16 over — and the max was never the problem
  // (1076, the same screen every other reach_at_rest road tops out at, since
  // the ending does not branch on class). `scout_ground` ("read the ground")
  // was the only class ability in the realm gated by nothing but
  // `["class", "scout"]`: no resource, no room check, so it was a legal option
  // on 197 of this road's 271 screens, and on the ones where the region held
  // nothing unseen it answered "You have found every place marked
  // hereabouts." — an option that does nothing, which is the defect the realm
  // already has a rule against.
  //
  // It is gated on `["inWild"], ["unseenHere"]` now: you read ground, not
  // floorboards, and only where there is something the reading can name. 466
  // -> 451.79, so 14 of the 16 came back. The last two are the ability doing
  // its job on the wilderness screens that remain, and the honest price of the
  // Scout's one distinctive line. This is 5 chars a screen, not 16.
  "reach:reach_at_rest#scout": { avg: 451, max: MAX_CHARS_MAX },
  // The full-party road: four companions travelling, the most expensive proof
  // in the realm, and the ratchet turned down three times on the day it was
  // written. It arrived at 506 average and a 1,489-character screen at
  // mc_north_road; not repeating the company entry, giving each event its own
  // line, and collapsing quest stage changes took it to 478 and 1,448. The last
  // 293 came off when a hold's arrival stopped being a chorus: the four
  // companions' answers moved out of one `onEnterOnce` and into region-gated
  // remarks of their own, which the engine has always spoken one a turn. The
  // average barely moved, which is the point — the words are all still there.
  // Then 16 more came off the day the company entry stopped reciting itself.
  // "speak with the company (Vell, Tamsin, Brother Osk, Lys)" stood on 227 of
  // this road's 350 screens — 20.4 characters a screen of names that had not
  // changed in a hundred turns. It names everyone for five places after the
  // company changes and counts them after that; opening it costs no turn and
  // names them all, and status carries the roster for free at any time. 477.75
  // -> 461.23, and the worst screen (va_throne) 1,155 -> 1,131.
  //
  // What is left of the overage is the companions talking: 83 distinct spoken
  // lines on this road, none of them said twice, 19 characters a screen. That
  // is what a four-companion road is for, and it is the one thing here that
  // should not be trimmed to meet a number.
  "reach:reach_at_rest#devoted": { avg: 462, max: 1130 }, // 462.8 the day companion remarks stopped firing on menu navigation (the road needed two more weighings of the throne doors to earn its paired remark honestly), then 460.69 once the reckoning stopped re-explaining what is missing on every press
  // The realm's first proof to land a blow. Measured before this road existed,
  // 125 proven screens offered a fight and 0 were taken — hp, armor, timed
  // conditions, aggression and the down-and-revive path stood unexercised by
  // anything the bar replays. This Warden road fights the Ashwood's three
  // wolves and the gray husk, then the barrow-wight guarding the crypt's own
  // passage north; the wight downs the companion mid-fight and warden_weight
  // ("take the weight") hauls her back up before the killing blow, and the
  // player's own hp crosses the lowHp line in that same exchange. A combat
  // screen is not padding: the player's roll, the companion's roll, the
  // retaliation, and a menu carrying several combat abilities at once all
  // print together, on a road no proof had ever rendered before. The worst
  // screen (1,295, va_crypt) is that room's first-visit description — two
  // hostiles introduced, the "armor useless" warning, and a ten-line menu —
  // paid once, by the first road to ever open that door.
  "reach:crowned_hollow#bloodied": { avg: 524, max: 1295 },
};

const dir = fileURLToPath(new URL("../world", import.meta.url));
const worlds: World[] = readdirSync(dir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => loadWorld(join(dir, f)));

/**
 * Has this screen described its room? `render`'s `full` flag reveals a room's
 * description once, and the ceiling is about that screen — so "seen" has to
 * mean "described", not "stood in".
 *
 * Three replays here got that wrong the same way: they seeded `seen` with the
 * start room and asked whether the room had CHANGED. In a world with classes
 * the intro is the class menu and describes no room, and choosing a class keeps
 * the same room id — so the start room's one full-desc screen was invisible to
 * every number this file asserts. A large start description could break the
 * ceiling without ever appearing. `inPerkPickPhase`'s own comment warns about
 * the same trap for a level-up landing on room entry.
 */
const describesRoom = (world: World, s: State): boolean => !inClassPhase(world, s) && !inPerkPickPhase(world, s);

for (const world of worlds) {
  test(`observation budget holds along the walkthrough (${world.id})`, () => {
    let { state, events } = newState(world, 1);
    const seen = new Set<string>(describesRoom(world, state) ? [state.room] : []);
    const intro = renderIntro(world, state, events);
    assert.ok(intro.text.length <= INTRO_CHARS_MAX, `intro ${intro.text.length} > ${INTRO_CHARS_MAX}`);

    const sizes: number[] = [];
    const doLabel = (label: string) => {
      const a = actionByLabel(world, state, label);
      assert.ok(a, `label ${label}`);
      const before: State = state;
      const out = step(world, state, a);
      state = out.state;
      const first = describesRoom(world, state) && !seen.has(state.room);
      if (first) seen.add(state.room);
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

  const seen = new Set<string>(describesRoom(arena, state) ? [state.room] : []);
  const screens: { kind: string; text: string; events: string[] }[] = [];
  const turn = (action: Action, kind: string) => {
    const out = step(arena, state, action);
    state = out.state;
    const first = describesRoom(arena, state) && !seen.has(state.room);
    if (first) seen.add(state.room);
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

/**
 * Every proven route, not just the walkthrough. See PROOF_*_RATCHET above for
 * why these numbers are not AVG_CHARS_MAX and MAX_CHARS_MAX yet, and why they
 * may only move one way.
 */
for (const world of worlds) {
  const proofs = Object.entries(world.proofs ?? {});
  if (!proofs.length) continue;
  test(`the observation budget holds along every other proven route (${world.id})`, () => {
    const over: string[] = [];
    for (const [key, steps] of proofs) {
      let { state } = newState(world, 1);
      const seen = new Set<string>(describesRoom(world, state) ? [state.room] : []);
      const sizes: { chars: number; room: string }[] = [];
      const doLabel = (label: string) => {
        const a = actionByLabel(world, state, label);
        assert.ok(a, `proofs.${key}: no action "${label}" in ${state.room}`);
        const before: State = state;
        const out = step(world, state, a);
        state = out.state;
        const first = describesRoom(world, state) && !seen.has(state.room);
        if (first) seen.add(state.room);
        sizes.push({ chars: render(world, state, out.events, { full: first }).text.length, room: state.room });
      };
      for (const w of steps) {
        if (typeof w === "string") doLabel(w);
        else { let n = 0; while (!condOk(world, state, w.until) && n++ < w.max && !state.ended) doLabel(w.repeat); }
        if (state.ended) break;
      }
      assert.ok(sizes.length, `proofs.${key} rendered nothing`);
      const avg = sizes.reduce((a, b) => a + b.chars, 0) / sizes.length;
      const worst = sizes.reduce((a, b) => (b.chars > a.chars ? b : a), sizes[0]!);
      // unlisted roads are held to the real ceiling; the table is the exceptions
      const budget = PROOF_BUDGET[`${world.id}:${key}`] ?? { avg: AVG_CHARS_MAX, max: MAX_CHARS_MAX };
      if (Math.floor(avg) > budget.avg) over.push(`proofs.${key}: avg ${avg.toFixed(1)} > ${budget.avg}`);
      if (worst.chars > budget.max) over.push(`proofs.${key}: max ${worst.chars} in ${worst.room} > ${budget.max}`);
    }
    assert.deepEqual(over, [], `a proven route got wordier — the ratchet only turns down:\n  ${over.join("\n  ")}`);
  });
}
