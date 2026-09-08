# The Gray Reach — where the work is, and why

Date: 2026-09-08. Owner: project lead. Every number here was measured, and
the command that measures it is given so the next reader can re-check rather
than trust.

The goal: a text adventure as large and sprawling as Skyrim, with the depth
and choice-consequence of Baldur's Gate 3.

## Where the realm actually stands

The sprawl is done. 18 regions, 905 rooms, 886 distinct room names, 251 npcs,
258 items, 128 quests, 68 stamped places, 4 companions with 45-47 topics
each, 568 epilogue lines, 7 endings every one replay-proven, 182 tests green.
Skyrim has about 340 named places. **Adding a nineteenth region is not the
work.** These are:

## 1. The realm's breadth does not pay

A winning walkthrough visits **97 of 905 rooms and 6 of 18 regions**, and
reaches `maxScore` at turn 255. So 89% of the world is invisible in a
playthrough, and the score tally caps at 5% of what is authored — 1,394
score effects totalling 7,172 points against a `maxScore` of 366. A player
who explores gets no signal, and no hold argues for being the seventh they
visit.

The two answers are written up and not yet built:
`2026-09-08-standing-and-ranks.md` (deeds spread across holds buy something)
and `2026-09-08-the-realm-moves.md` (a force that acts while you do not).

## 2. Choice-consequence is half-built

```bash
node --import tsx scripts/audit-choices.ts world/reach.json
```

Authored flags are in good shape: most regions have every choice remembered
somewhere, several at 100%. The **numbers** are not. About twelve hundred
places move faction standing; six thresholds read it, all of them `>= 2`
(the Crown's, once, at `>= 3`). Each faction has exactly two `statusPaths`
states, so a player at +8 with the Barrow-Keepers reads the same line, and
meets the same doors, as one at +2 — against 240 places that move it.

Calibration says the tiers are already reachable: replaying every proven
route, the road's favoured faction lands at +10 to +14 and a second at
exactly +5. The design needs no renumbering, only building.

The same audit found the realm proves only one faction road: all five
proven routes end deep with the Keepers and negative with the Ironbound —
`reach_burned` included, the ending earned by burning the Hollow Throne with
Ironbound oil, which finishes at `rep_iron -2`.

## 3. Half the game is walking, and a quarter of it is empty

```bash
node --import tsx scripts/audit-shape.ts world/reach.json
```

**51% of the proven playthrough is pressing "go"** — 134 of 264 steps —
against 28% that do something. And **211 of 905 rooms (23%) are corridors**:
no action, nobody standing there, nothing to take, so the only choice is
which way to walk.

The distribution is by authoring age, not design. The regions written last
sit at 4-7%; the ones written first at 44-55%, with the Vale — the tutorial
hour — at 29% and Marrowgate, the finale, at 31%. Two shipped with
wilderness that was never written rather than merely thin: `sk_coast` has 24
open cells and 5 authored scenes, `mg_warrens` 9 and 3, so those cells fall
back to a generated name ("the Warrens 1,2") and one generic line and read
identically to one another.

Filling a corridor does not lengthen the mandatory path — a corridor costs
its turn either way. It converts dead navigation into play. The bar is now
in `docs/region-brief.md`: **under 15%**.

## 4. The fifteen holds rhyme

The same tool prints each hold's fingerprint. Read down the fates column:
fifteen holds, fifteen identical `bargain/burn/rest` triples, 43-58 rooms and
6-8 quests apiece, exactly four stamped places in thirteen of fifteen.

Seven holds rest their grief by the same mechanic — three tagged tokens from
three named sources, combined at one spot. Fourteen of fifteen burn by
fetching an incendiary and passing a might check, eight naming the same
cinder-oil. `2026-09-08-seven-rites.md` records eight replacement shapes.

And the realm sometimes writes a sentence twice:

```bash
node --import tsx scripts/audit-echo.ts world/reach.json --min 0.6
```

66 real echoes among 3,513 authored lines (template copies are separated and
tallied, not counted). Two Ironbound lay-brothers in different holds open
with the same line; two holds carry a quest named "The Child at the Wall";
Iron Downs gives the identical line whether the Free Companies or the Watch
back your claim.

## 5. The acts are looser than they sound — and that was the design

**Retracted, mostly.** `act2_open` is read in exactly one place in sixty
thousand lines (`world/reach/wm_wardmoor.json:13`), which looks like a
three-act structure the game never enforces. It is not: the realm design
spec says so on purpose — *"Open from the start: Thornwold (west), Fenmarch
(east), and through them the Iron Downs, Saltkerns, Hollowbrook. Highward's
south gate (Wardmoor) admits no one from a blighted hold until the barrow is
dealt with (`act2_open`)"* (`2026-09-05-realm-design.md:92`). One gate is the
intent, and the openness is the Skyrim half of the goal working as designed.

What survives is smaller and is about words, not gates: the free recap calls
these "Act 2" as though something opened, when what Corvane actually opens is
*information* — he names the other hollows and the road to Marrowgate. If
that reads as a promise of a gate, the recap should say "the holds" and not
"act two". A wording fix, not a design one.

## 6. A build is only ever "+N to a stat"

All 28 perks are passive numeric bonuses. Nothing an author can write is
available outside the one room that declared it, which is why there are no
class abilities, no general flee, and no anywhere-rest. Class-gated content
is real and reasonably spread (Scholar 97 conditions, Scout 76, Warden 68,
Envoy 56 — the Envoy is 42% behind the Scholar), so the classes *read*
different; they do not *play* different.

## 7. Two live holes, and a bar with gaps

An **aggressive** npc cannot be disengaged from — the option is hardcoded off
(`src/engine.ts:1037`) — so a dead-end room and a fight going badly leave the
player no recourse but to die. And **the crawler never checks the menu cap**:
the one tool built to explore off the golden path does not check the
invariant most likely to break off it. Nothing validates that a `gen` grid
authors a scene for every open cell, though the brief requires it.

## 8. The bar proves one playthrough shape

Every one of the six proven routes — the walkthrough and all five ending
proofs — opens with **"be a Scholar"**. Every one of them ends deep with the
Barrow-Keepers and negative with the Ironbound, `reach_burned` included. And
the walkthrough visits six of eighteen regions.

The design contract says *"every obstacle has a force, a craft, and a words
route, so no class is ever locked out"*. That is asserted and never checked:
nothing in the bar establishes that a Warden, a Scout or an Envoy can finish
this game, and the crawler — which picks its class at random — only ever
reaches `dead` on the Reach. For a repo whose first value is proof over
promises, this is the largest unproven claim in it.

The fix is proofs, not argument: a Warden route and an Envoy route to an
ending, and a road that is not the Keepers'. `scripts/walk.ts` turns a label
list into a walkthrough, so the work is playing them and capturing them.

## 9. Per-turn cost scales with the world, not the player

0.16 ms/step at 9 rooms, 0.27 at 31, **2.73 at 905** — tracking total content,
not walk depth, because `step()` deep-clones a state carrying 760+ dictionary
entries on a fresh game and several hot paths scan all 251 npcs or 258 items
every turn regardless of room.

Kept in proportion: about 42% of that is `hashState`, which the crawler calls
twice a step and live play calls once a *game*, so a real turn costs ~1.4 ms
— imperceptible. This is a **dev-loop** cost (reach is ~58% of `verify`'s 29
seconds) and a **scaling trend** that bites well before Skyrim's size. It is
not a reason to stop authoring today.

## What has landed since (2026-09-08)

- **Two engine layers.** Timed conditions (`cond`/`npccond`/`uncond`/`harm`, a
  `conditions` record, modifiers folding into the same functions the menu
  preview and `status` already read) and the realm's own turn (`["turn", op,
  n]` and `world.clock`, at most one scheduled line a turn). 182 tests → 227.
  No shipped world declares a clock yet, so all three walkthroughs still
  render byte-identically.
- **Eight regions refilled — every region is now under the bar.** Corridors
  211 → **61** class-blind (23% → 7%), and counted per class, which is what a
  player walks through, **245/233/223/245 → 112/98/97/111** for
  warden/scout/scholar/envoy. Per region: the Vale 10 → **0**, Marrowgate
  14 → **0**, Hollowbrook 20 → 1, Coldpass 16 → 2, the Saltkerns 27 → 1,
  Fenmarch 27 → 3, the Fallows 29 → 5, Thornwold 25 → 6. What is left is
  mostly the shared templates' own connective rooms, which no region author
  owns — see the templates item below.
  Every author held the walkthrough **byte-identical** against a budget with
  27 characters of slack, by gating additions on walkthrough-crossed rooms
  behind classes the proven runs never play. That discipline is the reusable
  result and is now in the region brief.
- **Forgotten forks to zero** in the Vale (from 15), Fenmarch (3) and
  Hollowbrook (3); Fenmarch's talkative npcs 3 → 7.
- **The first faction has height.** The Free Companies' `trusted` (+5) and
  `sworn` (+9) tiers landed with granting scenes that refuse plainly when the
  standing is short, and `rep_free` is now read at `>= 9` by 32 conditions
  instead of at `>= 2` by 25. They also lend a **fifth companion** — Doss, a
  hired sergeant, the strongest fighter in the game and not a friend. Every author held the budget by gating additions on walkthrough
  rooms behind state the proven runs never reach — the walkthrough's rendered
  text is byte-identical through all of it.
- **The Vale remembers.** Its forgotten choices went 15 → 0: every choice a
  new player makes in the first half-hour is now read back by a later topic,
  a room that changes, or a line in their ending.
- **Prose echoes 66 → 2** in 3,613 authored lines, and `audit-echo` learned
  three distinctions so its signal is trustworthy: a stamped place matching
  its template, a wilderness cell's bearings compass, and a room's own
  variants are none of them echoes. It also reports **names used twice** now;
  four collisions fixed, including two that broke the travel list.
- **The free recap reads as lines**, not as one 2,354-character sentence
  naming fifteen holds.
- **Every `gen` grid now covers every open cell** — the two that shipped
  unwritten (the Saltkerns 24/5, Marrowgate's warrens 9/3) are authored.

## Read the winner's trace, not just the report

A playtest report gives a verdict and a list of complaints. The **trace** it
leaves in `runs/` replays through the real engine and gives everything else,
and it is cheap — the wave already paid for it:

```bash
node --import tsx -e "
import {newState, step} from './src/engine.ts';
import {loadWorld} from './src/validate.ts';
import {readFileSync} from 'node:fs';
const w = loadWorld('world/reach.json');
const t = JSON.parse(readFileSync('runs/<trace>.json','utf8'));
let { state } = newState(w, t.seed);
for (const a of t.actions) { state = step(w, state, a).state; if (state.ended) break; }
console.log(state.ended?.id, state.turn, state.score, state.classId, state.party, state.vars);"
```

One replay of the first winning run (seed 8802, `reach_at_rest`, turn 397)
paid for itself three times over:

- The player finished **with all four companions**, which is exactly the
  configuration that renders 1,444 characters against the 1,100 cap. A latent
  bug became a confirmed live one.
- They entered Thornwold at **turn 148** — 37% of the run inside the Vale
  before leaving it, then six regions in the remaining 250 turns.
- They ended at **Keepers +16, Church +11**, so both of the standing tiers
  being built would have fired for them. The +5/+9 calibration is right.

None of that was in the report they wrote.

## The order

1. **Corridors and echoes** — the density and freshness of what already
   exists. Half the game is walking; make the walk worth it.
2. **Standing with height, and the Ironbound march** — the reasons a fourth
   hold is worth visiting at all. Nothing else makes the breadth pay.
3. **Conditions, then the clock, then abilities and disengage** — depth in
   the turn itself, and the primitives the march and the bargains-come-due
   need.
4. **Seven rites** — variety, once there is a reason to go looking for it.
5. **The bar's gaps, then the scaling** — lock in the new density rules with
   tests, teach the crawler the menu cap, then make the loop cheap again.
6. **A sixteenth hold, last** — and one whose problem is not a grief-hollow
   at all.

## The bar, unchanged

`npm run verify` green: typecheck, tests, validator, crawler. The walkthrough
replays to a full-score win, every other ending carries its own replay-proof,
the token budget holds (avg act-response ≤ 450 chars, max ≤ 1100), menus stay
at or under 12, and determinism is sacred. Never weaken it. A change that
reads well and replays wrong is not done.
