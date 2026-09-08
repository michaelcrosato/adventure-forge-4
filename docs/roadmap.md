# The Gray Reach — where the work is, and why

Date: 2026-09-08. Owner: project lead. Every number here was measured, and
the command that measures it is given so the next reader can re-check rather
than trust.

The goal: a text adventure as large and sprawling as Skyrim, with the depth
and choice-consequence of Baldur's Gate 3.

## Where the realm actually stands

The sprawl is done. 18 regions, 905 rooms, 265 npcs, 321 items, 129 quests,
68 stamped places, 5 companions, 6 endings and 9 replay-proofs, 325 tests
green. Skyrim has about 340 named places. **Adding a nineteenth region is not
the work** — three blind players just walked eight of the eighteen that
exist. These are:

## 1. The realm's breadth does not pay

Measured on real play, not on the walkthrough. The fourth blind wave's three
traces, replayed (`runs/g1-71*.json`, and the script that reads them is worth
rewriting — it is four lines against `replayWalkthrough`):

    seed 716  won   turn 542  envoy    113 rooms  8 of 18 regions
    seed 717  stuck turn 650  scholar  151 rooms  8 of 18 regions
    seed 718  won   turn 613  envoy    136 rooms  8 of 18 regions

All three walked **the same eight regions** — cp, fd, hb, ir, mg, th, va, wm
— and no player touched em, ff, fl, hl, kw, mc, me, pw, sh or sk. Ten
regions, more than half the realm, unseen by any of three complete runs. The
earlier reading of this section used the walkthrough (97 rooms, 6 regions);
players do better than that and still walk one road.

**Correcting a correction.** An earlier draft said the score cap was fine,
having measured every proven route and found none of them capped before the
last turn. That was true of the routes and false of the players: a proof is
an efficient road, and a player wanders. Replayed against an uncapped engine,
the same three runs would have scored **511, 491 and 567** against a
`maxScore` of 366 — so the clamp was swallowing 125 to 201 points from each
of them and, worse, flattening three quite different runs into the identical
number. The realm authors 7,608 points across 1,395 sites; five per cent was
payable. `score` is no longer clamped (a `maxScore` is what one whole route
pays, and the walkthrough must still land on it exactly), and `status` says
what the number means instead of dividing by it.

That was the part of this section that was a one-line clamp. The rest of it
is §2, which is where the reason lives.

## 2. Choice-consequence is half-built — and here is the half

```bash
npx tsx scripts/audit-fates.ts world/reach.json
```

Every hold can be rested, bargained with, or burned: three fates, authored
three times over, fifteen holds, thirty routes behind the two that are not
"rest". The wave chose **rest 24 times out of 24**. Not one bargain, not one
burn, across three complete runs.

The tool says why without argument. Score ranks the fates identically in all
fifteen holds — rest +25, bargain +20, burn +15 — and rest also carries the
friendliest standing and the only companion approvals, while burn costs
church standing and regard in every hold that offers it. And only one of the
six endings reads a hold's fate at all: `reach_at_rest` wants three
**rested**. Bargaining and burning feed nothing, not even the ending called
`reach_burned`, whose gate is cinder oil in hand rather than a burned realm.

So two thirds of every hold's climax is strictly dominated, and nobody
misjudged anything: three players read the odds line correctly and took the
best option twenty-four times. **This is the largest gap between the game and
its stated ambition**, and the fix is in two halves — score must stop ranking
the fates, and something the realm wants must read each one. The second half
is the real one, and re-gating `reach_burned` on a burned realm (with the
proof that road has never had) is in flight.

### Standing, which is built and invisible

Each faction has a `trusted` tier at +5 and a `sworn` tier at +9, both
refusing plainly below, and the payoffs are now wired across all sixteen
regions. Calibration is fine — the wave reached keepers +25, church +13,
watch +6 and free +5, every one past a threshold — and between them the three
players collected **two ranks**.

Two reasons, both measured. Nothing showed a player their standing at all
until `status` learned to (`world.factions` existed only to name a faction
inside an event). And every rank is granted in exactly one place, by one npc,
behind a topic that also wants a specific earlier conversation with that same
npc — so standing is earned across the realm and collected in one hold, and
nothing tells the player to walk back. The canonical walkthrough ends at
church +5, exactly the trusted threshold, and never collects it.

The companion tallies were the same shape one layer down and are now fixed:
`appr_osk` reached +14, +17 and +14 in the wave against a previous ceiling of
+4, and `proofs["reach_at_rest#devoted"]` proves a companion reaching
`devoted` on a normal run. That one took a correction too — the diagnosis
"regard peaks at +1" had measured a road nobody travels: **the walkthrough
recruits only Lys**, and the other three companions are never asked to join.

## 3. Half the game is walking, and a quarter of it is empty

```bash
node --import tsx scripts/audit-shape.ts world/reach.json
```

**51% of the proven playthrough is pressing "go"** — 134 of 264 steps —
against 28% that do something. And **211 of 905 rooms (23%) were corridors**:
no action, nobody standing there, nothing to take, so the only choice is
which way to walk.

Now **19 of 905 (2%)** class-blind, across ten regions and the seven shared
templates. Four regions are still over the per-class bar and they are the
last four — cp 17%, sk 18%, th 19%, va 21% at their worst class. They are
also the four the proven walkthrough walks, which is exactly why earlier
passes skipped them: filling a walkthrough room costs budget, and there was
none. There is now (see below), and that pass is in flight.

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

Three are replaced. The tool grew a column so the work is visible at all,
since `fates` reads `bargain/burn/rest` for all fifteen forever by contract:

```bash
node --import tsx scripts/audit-shape.ts world/reach.json --rites
```

The Meres rest on a **witness** — someone living has to wade in and hear the
covenant. Mootcombe serves its feast in its proper **order**. The Hearthlands
now ask a **trade**: pay the debt three ways (haul grain off the Crown's
granary steps, find the surplus the almonry held back, or buy Bailiff Vance's
argument), each costing a different faction, then give the hold back what was
taken. Embermoor's **refusal** and the Kingswood's **act left undone** are in
flight. The column reads gates, not intent, and says so — a witness recorded
as a flag and a trade paid one hop earlier are both invisible to it, which is
why `--rites` names every road to rest and lets the author read.

And the realm sometimes writes a sentence twice:

```bash
node --import tsx scripts/audit-echo.ts world/reach.json --min 0.6
```

66 real echoes among 3,513 authored lines (template copies are separated and
tallied, not counted) — **2 now**, and the seven shared templates' own
1,939 near-duplicate pairs are down to 44, so a stamped barrow no longer
reads word for word like the last one. What it caught along the way: two
Ironbound lay-brothers in different holds opening with the same line, two
holds carrying a quest named "The Child at the Wall", and Iron Downs giving
the identical line whether the Free Companies or the Watch back your claim.

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

**Done.** All 28 perks were passive numeric bonuses, and nothing an author
could write was available outside the one room that declared it — no class
abilities, no general flee, no anywhere-rest. Class-gated content was real
and reasonably spread (Scholar 97 conditions, Scout 76, Warden 68, Envoy 56),
so the classes *read* different and did not *play* different.

`world.abilities` now exists: a room action minus the room, offered wherever
its `if` holds, spending a `world.resources` pool that a rest refreshes.
Nine ship. The Warden braces, breaks a guard open, and hauls a downed
companion up by the collar; the Scout marks a target and reads the ground for
what it has not seen; the Envoy parleys, presses, and buys a way past; the
Scholar speaks a horror's true name when the fight is going badly.

The lesson worth keeping is the tenth, which does not ship. `recall` was
written gated on a DC-13 wits check — and the hardest wits check in eighteen
regions is DC 12, so it could never appear for anybody, while the budget read
"unchanged" precisely because nothing had been added. **Narrowing a gate
until an ability stops costing budget is deleting it, done less honestly.**
The count that catches it is in `docs/authoring.md` §14. The flatness it
exposed is its own item: might and wits both top out at DC 12 realm-wide, so
two of four classes never meet a wall in the thing they are best at.

## 7. One live hole left, and a bar with gaps

**Disengage landed.** `leave <name> be` now appears against an aggressive npc
once hp is at half or less. It is not free: the npc gets one last strike as
you break away and the menu says `(a strike)` before you spend it, then
carries `disengaged` for two turns so walking out is not struck as well. A
Scout spends a resource point to slip away clean. Before this, a dead-end
room and a fight going badly left the player no recourse but to die.

Still open: **the crawler never checks the menu cap** —
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

## 9. ~~Per-turn cost scales with the world, not the player~~ — done

It did: 0.16 ms/step at 9 rooms, 0.27 at 31, **2.73 at 905**, tracking total
content rather than walk depth. A CPU profile said where, and four changes
fixed it — a per-world index of the fixed subsets a menu can ever draw from
(67 npcs a def could make hostile, not 265; 161 takeable items, not 321), a
memo open only inside one `legalActions` call (the hostile question was asked
dozens of times to get one answer), a hand-written state copy in place of
`structuredClone` (a fifth of every turn paying for cycles, Maps and Dates a
State never contains), and a crawler that compares two states outright rather
than hashing both.

The Reach now costs **0.378 ms a step**; `npm run verify` went 34s to 24s and
its crawl of the realm 31s to 11s, with the deep crawl 7m26s to 3m07s. Every
number the crawler reports is byte for byte what it reported before.

What is left is one O(world) scan a turn: `npcsHere` still walks all 265
npcs, about 12% of crawl time. A room-occupancy index would need
write-guarded invalidation, and that hazard is not worth a dev-loop-only gain
today.

## 10. The budget had twenty characters left, and it was shaping the work

```bash
node --import tsx scripts/budget.ts world/reach.json
```

That tool is new because every agent on this realm was re-deriving the
numbers by hand to decide whether a change fit, which meant the figures in
their reports could not be checked without deriving them a third time. The
first thing it printed was worth the trouble: **20 characters of slack across
all 269 screens of a winning run** — avg 449.9257 against a ceiling of 450.

That is not a budget, it is a wall, and it was quietly deciding the design.
Four content agents in a row reported their change as "byte-identical" and
were telling the truth: each had put its additions behind a class or a region
the proven walkthrough never reaches, because that is the only place a change
fits. `recall` (§6) is the same pressure one step further — content gated
past what the realm contains, so that the budget could read unchanged.

Where the characters go, per screen: menu 155 (34.5%), prose 127 (28.1%),
events 105 (23.2%), the status line 51 (11.3%), npc lines 4.

**2,227 characters now**, from one change: the `exits: N W E S` line restated
the numbered `go <dir>` options printed directly beneath it. Its one piece of
its own — a `*` on a side trip nobody has walked — moved onto the option it
belongs to and now says so in words, which two playtest reports had asked for
and nothing on the screen ever answered.

Two bigger line items are deliberately **not** to be touched, and the reasons
are recorded so nobody re-discovers them the hard way:

- the odds preview, 14,373 characters of `DC 11, +1 will: roll 10+ on the
  die`. The comment on `oddsHint` records real players calling a correct fail
  a bug when a terser form let them read the total as the die roll.
- `travel to a known place`, 4,048 characters and the most-printed string in
  the game. Three archived issues say players found that label too vague, not
  too long.

The lever left is editorial — prose and event text, about eleven characters a
screen for another three thousand. Stop at five thousand: headroom that large
is its own licence to bloat.

## What has landed since (2026-09-08)

- **Three engine layers.** Timed conditions (`cond`/`npccond`/`uncond`/`harm`,
  a `conditions` record, modifiers folding into the same functions the menu
  preview and `status` already read); the realm's own turn (`["turn", op, n]`
  and `world.clock`, at most one scheduled line a turn, concatenating from the
  part files so a region owns its own schedule); and `world.abilities` with
  `world.resources` — a room action minus the room. Plus disengage. 182 tests
  → 269.
- **Ten regions and the shared templates refilled.** Corridors 211 → **19**
  class-blind (23% → 2%), and counted per class, which is what a player walks
  through, **245/233/223/245 → 82/68/67/81** for warden/scout/scholar/envoy. Per region: the Vale 10 → **0**, Marrowgate
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
- **All six factions have height.** Each offers a `trusted` tier at +5 and a
  `sworn` tier at +9, with granting scenes that refuse plainly when the
  standing is short and charge standing with whoever the tier crosses — the
  Ironbound brand the iron-sun into your hand and it costs you the Keepers and
  the Church. Every `rep_*` is now read at `>= 9`; before, all six topped out
  at `>= 2`. The Free Companies also lend a **fifth companion** — Doss, a
  hired sergeant, the strongest fighter in the game and not a friend. Every
  author held the budget by gating additions behind state the proven runs
  never reach, and the walkthrough's rendered text came back byte-identical
  through all six — which was the right discipline at the time and is exactly
  the pressure §10 is about.
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
- **Three tools grew a column each.** `audit-choices` reports standings and
  tallies (how far the world moves a number against the highest it ever reads
  it back) and gates with no key (a flag read by a condition nothing sets);
  `audit-shape` counts corridors per class and prints how each hold's grief is
  actually rested; `audit-echo` reports names used twice as well as sentences.
  `budget.ts` is new. Two of these found bugs in my own earlier reports — the
  corridor count was class-blind and flattering, and the `statusPaths` walk
  never read `states[].if`, so every faction's read count came back zero.

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

Replaying the **other** player's trace — the one that ran out of agent turns
— made each finding much stronger, because the two converge:

| | winner (8802) | non-finisher (8801) |
|---|---|---|
| class | Scholar | Scholar |
| left the Vale at turn | 148 | 168 |
| hollows rested | 3 | 3 |
| Keepers / Church | 16 / 11 | 16 / 11 |
| regions reached | 7 | 6 |

**Both blind players picked a Scholar, spent about 40% of the run inside the
Vale, and settled exactly the minimum three hollows.** Neither visited a
fourth, because nothing asks them to — which is finding 1 above, confirmed
from the player's side rather than the spreadsheet's. And 420 turns is right
at the edge: one won at 397, the other was three turns into Coldpass at 419
with the capital next. Use 480 next time, or the wave measures the budget
instead of the game.

## The order

1. ~~**Corridors and echoes**~~ — 211 to 15, echoes 66 to 2, the templates'
   1,939 pairs to 44.
2. ~~**Standing with height, the Ironbound march, and the cross-region
   pass**~~ — all three landed, all sixteen regions wired. The march keeps
   its own clock now (`since`), so setting it moving late no longer drops ten
   holds in ten turns. What that work revealed is item 3.
3. **A rank a player earns and never collects.** Twelve ranks, each granted
   by one npc in one hold behind a topic that also wants an earlier
   conversation with that same npc. The wave crossed four thresholds and
   collected two ranks. `status` shows standing now; the collecting is the
   open half, and `world.clock` is the obvious instrument — it can notice a
   crossing and say where the rank waits without throwing away the twelve
   scenes where a faction's own voice tells you what you have become.
4. ~~**Conditions, the clock, abilities, disengage, `since`, negated
   conditions, room paging**~~ — landed. Rooms turn pages now, so the menu
   cap stopped being a limit on how deep a room may go, and it caught three
   rooms that were one option over while the engine was hiding the thirteenth
   from the count as well as the player.
5. ~~**Seven rites**~~ — all seven, each hold resting by a different road:
   witness, trade, an act left undone, a sequence, a refusal, a sacrifice, a
   name, and now substitution (Pennywell, chained to the Shieldings) and a
   stand-down (the Shieldings, a real check where an auto-trigger was).
6. **The fates.** §2. Two thirds of every hold's climax is strictly
   dominated and three players proved it 24 times out of 24. Score must stop
   ranking the fates, and something the realm wants must read each one.
   Re-gating `reach_burned` on a burned realm — and capturing the proof that
   road has never had — is in flight. Everything else in this list is
   smaller than this.
7. ~~**The bar's gaps**~~ — the validator now rejects a gate whose key the
   world never cuts (it found one: a Kingswood quest stage that could never
   clear, one letter wrong) and an ability spending a pool nobody declared;
   the crawler holds a room's own option load to the cap; and the budget
   walks **every** proven road, not just the walkthrough, which found five
   over the ceiling and now ratchets each one down.
8. **The four rooms still over the ceiling** — mc_north_road (1,448: a
   hold's arrival text plus all four companions answering in the same
   breath), th_wood_3_1 (1,243), mg_hollow_throne (1,170) and va_throne
   (1,125). The last two are the story's climaxes and want careful cutting,
   not gating.
9. ~~**Prove the other three classes**~~ — proven, and the wave picked Envoy
   twice of three unprompted, so the class skew has broken. The region skew
   has not: see §1.
10. **A sixteenth hold, last** — and one whose problem is not a grief-hollow
    at all.

## The bar, unchanged

`npm run verify` green: typecheck, tests, validator, crawler. The walkthrough
replays to a full-score win, every other ending carries its own replay-proof,
the token budget holds (avg act-response ≤ 450 chars, max ≤ 1100), menus stay
at or under 12, and determinism is sacred. Never weaken it. A change that
reads well and replays wrong is not done.
