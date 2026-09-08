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

## 5. The act structure is fiction

`act2_open` is read in exactly **one place** in sixty thousand lines of
content (`world/reach/wm_wardmoor.json:13`), and is absent from all nine
newer holds; the Vale's west road opens into Thornwold and the Hearthlands
from turn two. The design doc's "act one resolves, Corvane opens act two"
is true for one hold in fifteen. Either gate act two to match the story, or
change the story.

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

## 8. Per-turn cost scales with the world, not the player

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
- **Six regions refilled.** Corridors 211 → 94 (23% → 10%): the Vale 10 → **0**,
  Marrowgate 14 → **0**, the Saltkerns 27 → 1, Fenmarch 27 → 3, the Fallows
  29 → 5, Thornwold 25 → 6. Hollowbrook and Coldpass are the last two over
  the bar. Every author held the budget by gating additions on walkthrough
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
