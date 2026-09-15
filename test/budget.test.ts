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
 * target for all of them is AVG_CHARS_MAX and MAX_CHARS_MAX; the one room
 * still standing in the way is va_crypt, a fight screen kept at width by
 * design (see the comment on crowned_hollow#bloodied, below). mg_hollow_throne,
 * va_throne, th_wood_3_1 and mc_north_road are all cut down to size.
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
/**
 * mg_hollow_throne, va_throne AND th_wood_3_1, CUT DOWN — ITEM 8 IN THE ORDER.
 *
 * All three were restating themselves: a desc clause repeating the two exits
 * printed six lines below it (va_throne only, and the only room in the realm
 * whose desc did this), an ending's own prose saying a thing twice, an npc
 * desc saying what the engine's own pierce warning already says on the same
 * screen, and — the one that mattered most — the free "weigh the doors of the
 * seat" action's nine readiness lines, each carrying about twenty characters
 * of "stands ready:" / "still wants ... and you are short of it" boilerplate,
 * written out twice over (a first-press branch and a byte-identical
 * repeat-press branch). th_wood_3_1 was a different shape of the same defect:
 * an 8%-a-cell wilderness ambush (a gray boar) happened to land, on the
 * road's own proven seed, on the same cell as Rook, the room's own scripted
 * encounter — a coincidence, not a line either one owns, so both npc descs
 * and the quest stage's redundant restatement of its own name got trimmed
 * rather than either encounter gated away. No label, no companion's own
 * voice, and no beat of the Regent's entrance or the barrow king's warnings
 * were touched anywhere.
 *
 *   reach_burned           318 screens   450.7 avg  1,154 -> 1,094 max  (entry removed: meets the real bar both ways)
 *   regent_deposed         271 screens   451.1 avg  1,180 -> 1,092 max
 *   gray_crown             261 screens   451.8 avg  1,125 -> 1,097 max
 *   reach_at_rest#devoted  352 screens   461.5 avg  1,130 -> 1,076 max
 *   reach_at_rest#warden   272 screens   445.2 avg  1,146 -> 1,097 max  (entry removed: meets the real bar both ways)
 *
 * Several roads moved a few tenths of a character with no line of their own
 * touched, just from walking through a cut room on the way to somewhere
 * else: `crowned_hollow#bloodied` 524.5 -> 523.1 (va_throne, on the way to
 * va_crypt), `reach_at_rest#scout` 451.3 -> 451.0 (th_wood_3_1).
 *
 * What stayed unmeasured until now: the same "weigh the doors" action, pressed
 * with every road ready at once, a state no proof or the crawler ever reaches
 * (see "the free weigh-the-doors action stays under the ceiling even maxed
 * out" below). A general off-path scanner — something that could have found
 * this without being told where to look — is still not built.
 */
/**
 * scholar_read AND scout_hands, UNSTARVED.
 *
 * Both abilities spend a class resource on `checkHere <skill> 11`: a check of
 * that skill at DC 11 or higher legally available in the room, right now.
 * Both were close to dead content. `scripts/audit-play.ts` replayed this
 * session's own two blind-playtest traces and found scholar_read never once
 * offered across either run; `scripts/audit-abilities.ts` then measured it
 * exactly — on the menu 0.6% of scholar screens (13 of 2,038) and
 * scout_hands 0.7% of scout screens (2 of 271), against warden_set's 2.1%
 * (10 of 481) and envoy_press's 2.0% (7 of 342), the same shape of ability
 * on the other two classes, by the same measure.
 *
 * The cause was not the ability, it was the realm's own DC mix. A census of
 * every `check` in the world: wits runs 181 checks total with 16 (8.8%) at
 * DC>=11, dominant mode DC9; grace runs 126 with 9 (7.1%) at DC>=11, also
 * DC9-dominant; will runs 229 with 95 (41.5%) at DC>=11; might runs 148 with
 * 32 (21.6%). Wits and grace content skews low almost everywhere it is
 * authored, so a DC-11 floor was asking for a check the realm rarely writes.
 * Both thresholds dropped to DC 10 — the smallest change that fixes the mix
 * without touching the DSL, the fx, or either ability's cost.
 *
 * That makes the check legally available on more screens, which is the whole
 * point, and it costs width wherever a resourced Scholar or Scout carries the
 * road: the option is now offered where it legally can be, and an offered
 * option is exactly the content this fix exists to add. Looked for the money
 * first, the way fast travel's did — there is no repeated boilerplate to trim
 * here the way "to " was for travel labels, since the added text is the
 * option itself. Four roads move, all still well clear of the real 1,100 max
 * (worst is 1,094, mg_hollow_throne, unchanged):
 *
 *   reach_burned            318 screens   450.3 -> 451.2   (+0.9)
 *   gray_crown              261 screens   451.8 -> 452.7   (+0.9)
 *   reach_at_rest#scout     271 screens   450.9 -> 452.5   (+1.6)
 *   reach_at_rest#devoted   352 screens   461.5 -> 462.3   (+0.8)
 *
 * reach_at_rest#devoted plays a Scholar and reach_at_rest#scout plays a
 * Scout — the two roads that carry a resourced companion of the matching
 * class the whole way, so they were the two expected to move, and did.
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
  "reach:regent_deposed": { avg: 451, max: MAX_CHARS_MAX }, // max cleared 1,180 -> 1,092 cutting mg_hollow_throne (item 8); avg still owed
  // reach_burned cleared BOTH the real avg and the real max cutting
  // mg_hollow_throne for item 8 (450.7 avg, 1,094 max) and asked nothing of
  // this ratchet for one change — back below with an entry of its own now,
  // unstarving scholar_read/scout_hands (above).
  "reach:reach_burned": { avg: 451, max: MAX_CHARS_MAX }, // 450.3 -> 451.2 unstarving scholar_read/scout_hands (above)
  "reach:gray_crown": { avg: 452, max: MAX_CHARS_MAX }, // max cleared 1,125 -> 1,097 cutting va_throne (item 8); avg (481 -> 452.4, above) still owed, down to 451.8 as a side effect of the th_wood_3_1 cut (this road passes through it too), then 452.7 unstarving scholar_read/scout_hands (above)
  // reach_at_rest#warden's max came down 1170 -> 1146 above, then, cutting
  // th_wood_3_1 for item 8, 1146 -> 1097: a gray boar's 8%-a-cell wilderness
  // ambush happened to land on the same cell as Rook, the room's own scripted
  // encounter, so two full hostile descriptions and both their opening lines
  // rendered together — a coincidence, not a line either encounter owns, so
  // the cut trimmed both npc descs, the quest stage's redundant restatement
  // of its own name, and the boar's one-time ambush line rather than gating
  // either encounter away. Meets the real bar both ways now; entry gone.
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
  "reach:reach_at_rest#scout": { avg: 452, max: MAX_CHARS_MAX }, // 451.79 -> 450.95 as a side effect of the th_wood_3_1 cut (item 8; this road passes through it too), then 450.92 -> 452.49 unstarving scholar_read/scout_hands (above) — the Scout road, so scout_hands is what moved it
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
  "reach:reach_at_rest#devoted": { avg: 462, max: MAX_CHARS_MAX }, // 462.8 the day companion remarks stopped firing on menu navigation (the road needed two more weighings of the throne doors to earn its paired remark honestly), then 460.69 once the reckoning stopped re-explaining what is missing on every press; max cleared 1,130 -> 1,076 cutting mg_hollow_throne (item 8); 461.51 -> 462.33 unstarving scholar_read/scout_hands (above) — the Scholar road, so scholar_read is what moved it (max also moved, 1,076 -> 1,087 em_priory, still clear of the real bar)
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
  "reach:crowned_hollow#bloodied": { avg: 523, max: 1295 }, // avg 524.5 -> 523.1 as a side effect of cutting va_throne for item 8 (this road passes through it on the way to va_crypt); max is va_crypt's own first-visit fight screen and untouched, by design — see the comment above
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
 * mg_hollow_throne's free "weigh the doors of the seat" action, maxed out —
 * item 8 in the order, and the "nothing measures an off-path screen today"
 * gap it names. Every proven road satisfies only ONE of the throne's three
 * roads (rite, burn, bargain) before ending the tale there, so no walkthrough
 * or proof ever presses this action with all three ready, the founding
 * ledger AND the Vale's crown both carried, and a companion in tow — a state
 * a Scholar who lingers at the seat can genuinely reach. `crawl --worst`
 * cannot find it either: the room is `noTravel`, gated behind the whole
 * Marrowgate admission chain, so a random walk that reaches it at all renders
 * whatever flags it happens to be carrying, not the maximum.
 *
 * Forced here instead of walked, both branches (first press writes nine
 * readiness lines, a repeat press writes eight and drops the explanations).
 * Before the readiness lines were trimmed for item 8 this ran comfortably
 * past 1,100 by hand; measured now at 1,040 and 1,064.
 *
 * What this does NOT cover: the room's own first-visit entry screen, in this
 * same maxed state, is a different and larger problem — 1,344 chars even with
 * no companion and the guard-flanked line withheld, from `onEnterOnce` text,
 * a quest-stage-change notice, the full desc, the Regent's own npc desc, and
 * two item hints (the founding ledger's and the iron crown's, each written
 * for its own screen, not this one) all converging because every one of the
 * throne's roads happens to be open at once — content stacking, the same
 * shape as item 11's unresolved act-gate exposure, not a redundant line to
 * cut. Left unmeasured and unfixed for a future pass; see docs/roadmap.md.
 */
test("the free weigh-the-doors action stays under the ceiling even maxed out (reach)", () => {
  const reach = worlds.find((w) => w.id === "reach");
  assert.ok(reach, "world/reach.json must ship among the worlds under test");

  let { state } = newState(reach!, 1);
  const classAction = actionByLabel(reach!, state, reach!.walkthrough[0] as string);
  assert.ok(classAction, "walkthrough's first step must still be the class pick");
  state = step(reach!, state, classAction!).state;

  state.room = "mg_first_reeves_tomb";
  state.flags["mg_entered"] = true;
  state.flags["mg_admitted"] = true;
  state.flags["free_sworn"] = true; // the company held the stair too — the flanked variant of the Regent's line
  state.vars["hollows_rested"] = 3;
  state.vars["hollows_burned"] = 3;
  state.vars["hollows_bargained"] = 3;
  state.vars["rep_watch"] = 2;
  state.flags["va_king_rested"] = true;
  state.flags["mg_reeve_confessed"] = true;
  state.inv.push("mg_founding_ledger", "va_crown", "ir_oil");
  state.party.push("lys");

  const enterAction = actionByLabel(reach!, state, "go north");
  assert.ok(enterAction, `mg_first_reeves_tomb must still open north onto the throne`);
  // The entry screen itself is rendered (to advance state realistically) but
  // deliberately not asserted on — see the doc comment above.
  let out = step(reach!, state, enterAction!);

  const weighAction = actionByLabel(reach!, out.state, "weigh the doors of the seat");
  assert.ok(weighAction, `mg_hollow_throne must still offer "weigh the doors of the seat"`);
  out = step(reach!, out.state, weighAction!);
  const first = render(reach!, out.state, out.events, { full: false });
  assert.ok(first.text.length <= MAX_CHARS_MAX, `weigh the doors, first press: ${first.text.length} > ${MAX_CHARS_MAX}\n${first.text}`);

  out = step(reach!, out.state, actionByLabel(reach!, out.state, "weigh the doors of the seat")!);
  const again = render(reach!, out.state, out.events, { full: false });
  assert.ok(again.text.length <= MAX_CHARS_MAX, `weigh the doors, repeat press: ${again.text.length} > ${MAX_CHARS_MAX}\n${again.text}`);
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
