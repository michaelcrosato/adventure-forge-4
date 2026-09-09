# The Gray Reach — where the work is, and why

Date: 2026-09-09. Owner: project lead. Every number here was measured, and
the command that measures it is given so the next reader can re-check rather
than trust.

The goal: a text adventure as large and sprawling as Skyrim, with the depth
and choice-consequence of Baldur's Gate 3.

## Where the realm actually stands

The sprawl is done. 18 regions, 905 rooms, 265 npcs, 321 items, 135 quests,
68 stamped places, 5 companions, **7 endings and 13 replay-proofs**, 12 class
abilities, 314 tests green. Skyrim has about 340 named places. **Adding a
nineteenth region is not the work** — three blind players just walked nine of
the eighteen that exist. These are:

Five waves in a row have now won three of three, fun 5/5 every time, at 505
to 640 turns; wave seven scored 554, 570 and 578 against a one-route baseline
of 366, which is the first hard evidence that uncapping the score changed how
much of the realm a player walks. What those waves ask for has also changed
shape: wave four's list was broken mechanics, wave seven's was legibility, and
the useful findings of waves eight and nine did not come from the reports at
all — they came from replaying the players' own traces and from re-measuring
what the reports claimed, which between them contradicted three findings and
sharpened two others into different bugs than the ones filed. Clarity has sat
at 4/5 for four waves, and the two open items behind that number are not
wording problems: the act gate (item 11) and the router that prefers the
shortest path over the walkable one (item 12).

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
3. ~~**A rank a player earns and never collects**~~ — done, and not with the
   clock. Twelve ranks, each granted by one npc in one hold, and three blind
   players collected two of twelve between them across 1,669 turns. Six quest
   ladders (`world/reach/ranks.json`) name the person and point at their door,
   which keeps all twelve of the scenes where a faction's own voice tells you
   what you have become. The standing-gated three start on the standing **and**
   on having met the granter — a rank is collected from a person, and that also
   kept the Scout road inside an allowance with 0.07 characters of headroom.
4. ~~**Conditions, the clock, abilities, disengage, `since`, negated
   conditions, room paging**~~ — landed. Rooms turn pages now, so the menu
   cap stopped being a limit on how deep a room may go, and it caught three
   rooms that were one option over while the engine was hiding the thirteenth
   from the count as well as the player.
5. ~~**Seven rites**~~ — all seven, each hold resting by a different road:
   witness, trade, an act left undone, a sequence, a refusal, a sacrifice, a
   name, and now substitution (Pennywell, chained to the Shieldings) and a
   stand-down (the Shieldings, a real check where an auto-trigger was).
6. ~~**The fates**~~ — done, all three roads. Score stopped ranking them
   (0 of 15 holds, where it was 15 of 15); `reach_burned` wants a burned realm
   rather than a jar of oil and has the proof to show it; and `reach_bargained`
   is a seventh ending, gated on three holds bargained and nothing else,
   proven at 255 turns and **the only non-walkthrough proof in the realm that
   passes both real ceilings without an allowance**. Finishing it found the
   defect underneath: five holds settle their grief in an npc's topic, and
   both `audit-fates.ts` and its test scanned only room actions, so both
   showed a clean bar while those five paid +20 for a bargain against +25 for
   a rest. A blind spot in a measuring tool is worse than no tool.
7. ~~**The bar's gaps**~~ — the validator now rejects a gate whose key the
   world never cuts (it found one: a Kingswood quest stage that could never
   clear, one letter wrong) and an ability spending a pool nobody declared;
   the crawler holds a room's own option load to the cap; and the budget
   walks **every** proven road, not just the walkthrough, which found five
   over the ceiling and now ratchets each one down.
8. **The rooms still over the ceiling** — mc_north_road is done and the way
   it was done is the pattern: 1,448 to 812, not by cutting a word but by
   moving the four companions' answers out of one `onEnterOnce` and into
   region-gated remarks, which the engine has always spoken one a turn. The
   words are all still there. hl_north_lane (1,504) went the same way. The
   worst on any proven road is now `crowned_hollow#bloodied` at 1,295, and it
   is a fight screen — narration, a companion going down, and the menu — which
   is the one place width buys something. The widest the random crawler finds
   is 1,013 (hl_fields_0_1, 147 of 905 rooms in 60 walks). What is left is the
   climax screens off every proven road and every crawl walk: mg_hollow_throne
   and va_throne want careful cutting, not gating — the throne already lost 38
   characters that were its quest line re-listing four endings the menu shows
   with "(ends the tale)" on each. **Nothing measures an off-path screen
   today**, which is the real gap: `crawl --worst` prints the widest it
   happens to reach, and the climaxes are not reachable by a random walk.
9. ~~**Three classes of four, not four**~~ — four of four now, and twelve of
   twelve abilities. `reach_at_rest#scout` put a Scout on the grace road —
   locks, ledges, carved stone — and `crowned_hollow#envoy` is the first
   proven route to spend an Envoy's kit rather than carry it: `parley` on a
   gray husk, and seven gold walked into Wolf Scrape so `buy_off` could pay a
   wolf to stand down. `test/abilities.test.ts`'s `UNPROVEN` table is empty
   for the first time. Its last line had claimed "no proven route ever holds 5
   gold", which was true of the eleven routes measured and false of the
   realm's coin — the debt was never the gold, it was that no Envoy road had
   carried it past something that would kill it.
10. **A sixteenth hold, last** — and one whose problem is not a grief-hollow
    at all.
11. **The act gate, which is why three runs saw the same half of the realm.**
    Not a map problem: the region graph is a proper sprawl, 0-4 hops across,
    and six regions appear in all three wave-eight runs while five appear in
    none. The pilgrim stair at Coldpass opens on **any three holds rested**,
    Coldpass is two hops from the start through Wardmoor, and Marrowgate is
    through Coldpass — so a player rests the three nearest holds and walks
    into the endgame having seen a quarter of the realm. Unseen content in a
    large world is fine; three runs seeing the *same* unseen half is not. The
    lever is what the gate counts, not where the roads go.
12. **The router gives the shortest way, not the open one, and never says
    which.** A stage's `at` prints the walk to it from the same breadth-first
    search `bearings` uses, and that search crosses gated exits — right for a
    bearing, which says where a place *is*, and not always right for a route a
    player is told to follow. `scripts/audit-routes.ts`: of 1,120 routes
    printed along the walkthrough, 111 cross a shut exit and **80 are shut
    before the last leg** — sent through a door that is not the objective. All
    80 are at three doors, one of which is the honour guard's passage that
    wave nine's stand-down reports were also standing at. `walkFrom` is cached
    per room and state-independent, which is what makes the free `status`
    screen affordable, so this is a change with a budget consequence rather
    than a line edit.

## What landed on 2026-09-09, and the one thing it says

Fourteen changes, and reading them together says something the individual
commits do not: **every one of them was the game failing to tell a player
something it already knew.**

- A conversation stopped getting harder for being had. A lock gets harder as
  you work at it; a topic's DC now reads what was written, and the compound
  two waves reported — a dispute check costing regard with both companions on
  a miss, with the DC creeping under you — is gone.
- Every class got something to do outside a fight. Something stands there to
  fight on **4.1% of screens**, and nine of ten abilities required one, so a
  Warden's and a Scholar's whole kit sat behind a door that opens one screen
  in twenty-five. `scholar_name` wanted four conditions at once and stood on 1
  screen in 1,760; it now stands on 21, which is 29% of its road's fights and
  in line with every other class.
- A menu number means the same thing on every page, and the front end stopped
  refusing one it had shown a screen earlier.
- An option that sends a companion away says so before the turn is spent —
  and at the Oath-Ground, that it happens even if you *pass* the check.
- A check at the head of a live `if` branch is previewed, so "run the sacks
  past the tithe (will)" names its DC to the player who has to roll and stays
  quiet for the one who cannot fail.
- A standing cost already spent is not promised again.
- A room id stopped reaching the player: "You travel to ir_miners_hall."
- **286 hand-written bearing strings became one that cannot be wrong**, and
  2,621 lines went with them. Content still owns where a player can take their
  bearings, and the words the answer opens with; the engine owns the
  directions, because a grid has walls and a hop count is not a route.
- A quest stage can name the room it points at, and the free status check
  walks there. Every player of wave seven asked for this and two lost 30-60
  turns of a 620-turn run for want of it.
- The point of no return says how much you are leaving: eleven threads, on the
  realm's own walkthrough. The warning was already there; what it lacked was
  a number.
- Standing something down stopped implying the way is clear when it is not.
- Three companion lines stopped repeating on every entry, and the validator
  will not let a fourth.
- The blessing that vanished says why it is gone.
- The company says once that nobody caps it.

The measurement that made most of them possible is the pattern worth keeping:
`scripts/audit-abilities.ts` reads a share against the fight count rather than
against 100%, and read that way seven of nine abilities were fine and three
were broken for three different reasons. The vague number ("eight of nine
never offered") was true and useless.

## Wave eight, and what a trace says that a report cannot

Three blind players, three seeds, two classes. All three won. All three rated
it fun 5/5 and clarity 4/5, which is where clarity has sat for three waves
running. Their reports were useful; replaying their own traces through
`scripts/audit-play.ts` was better, and in two places it contradicted them.

**What the traces said, that no report did.** Six regions appear in all three
runs — the Vale, Thornwold, Fenmarch, Wardmoor, Coldpass, Marrowgate. Nine of
eighteen were touched by any run; five were touched by none. Each player saw
117-146 rooms of 905 and finished with the same full party of four and the
same ending. The map is not the reason: the region graph is a proper sprawl,
0-4 hops across. **The exit is the reason.** The pilgrim stair at Coldpass
opens on any three holds rested, Coldpass is two hops from the Vale through
Wardmoor, and Marrowgate is through Coldpass — so a player rests the three
nearest holds and walks into the endgame having seen a quarter of the realm.
Unseen content in a large world is fine; three runs seeing the *same* unseen
half is not. That one is still open, and the lever is the act gate, not the
map.

**Confirmed, and fixed.**

- A hold's grief is the thing a hold is built around, and **21 of 27 hold-grief
  quests gave no destination in the line a player reads first** — while their
  side quests routinely did. Seed 9901 finished two of the Hearthlands' side
  quests and left reporting the hold had no grief site at all. It has one, at
  the threshing floor, behind a flag set by entering the barn doors. Two region
  passes gave 131 quest stages the room they point at; the debt is 2 now, and
  both of those are stages waiting on a different quest to settle first.
- **Ten of fifteen holds could be walked without their grief ever opening** —
  the quest starts on standing in one particular room, or on one other flag.
  `audit-fates.ts` prints which, per hold, now.
- Directions written by hand: 52 quest stages carried a compass word, twelve of
  them a whole route. Seven remain, all of them place names. **Correction, made
  the same day:** the commit that landed this claimed two of those routes were
  "plainly wrong", and one of the two was not. Camp Gallows' "in to the muster
  ground, west to the cook-fire, south to the scout line" is a *sequence*, and
  walking it in the engine gives exactly that — `in`, then one west, then one
  south. I had read three legs of one route as three exits from one room and
  called a correct line wrong. Replacing it with a room the engine walks to is
  still the right change by §9; the reason given for it was not. (Cal's grave
  stands: he dies in the fire at the Gallows Glade, eight stands west, and
  three lines had him buried east of the camp — an inconsistency with his own
  death rather than with the map.)
- A single step through a door reads as the menu's own word now ("two west,
  then in"), not as a tally — a count answers "how many times do I press
  this?", which only a compass run raises.
- The escalation rule is stated once, on the line that states the rules, rather
  than after the first failure that teaches it.
- The Oath-Ground's "bring a living oath to the stone" was gated on
  `rep_watch >= 1` and its own miss spent `rep_watch -1`, so a missed roll at
  exactly 1 closed one of Wardmoor's three fates off the road with no
  explanation. `audit-choices` learned to find that shape, and to tell it from
  a spend that cannot cross its own gate.
- The first regard change had been printing "at -2 they are near leaving" for
  three waves. The floors live in each companion's `leaves` list: -5 plain, -2
  if you sided against them in a quarrel. The line says the shape now and
  leaves the number to the content that owns it.

**Retracted, with evidence.** Seed 9902 reported "non-Euclidean loop
connections" in the Ashwood. The grid is Euclidean: 1,423 compass exits between
generated cells, 0 that disagree with the geometry. What was real in that
report was the sentence after it — they could not route to the sunken shrine or
the old watchtower, because those stages named two places and pointed at
neither.

## The bar finally throws a punch

Measured across the walkthrough and every ending proof: **3,022 screens, 125 of
them offering a fight, 0 blows struck.** Hp, armor, damage, aggression, the
down-and-revive path and the disengage gate were enforced by nothing the bar
replays. Blind players fight — 13 attacks across the three wave-eight runs — so
this was a hole in the measurement, not in the content.

`crowned_hollow#bloodied` closes it: a Warden road that kills three wolves, a
gray husk and the barrow-wight guarding the crypt passage, has its companion
struck down mid-fight and hauls her back up with `warden_weight` before the
killing blow, and crosses the `lowHp` line doing it. That retired the last
"no companion has ever gone down on a proven route" debt. A disengage is still
unproven, and honestly so: nothing on that road ever goes badly enough.

What the road exposed is bigger than the road. `scripts/audit-fights.ts` runs
one fixed build against all 68 hostiles that strike back, through the engine's
own `step`:

    with 0 companions: median 7 rounds, 14 hp lost, 46 of 68 fights kill the player
    with 2 companions: median 3 rounds,  2 hp lost,  0 of 68 fights kill the player
    with 4 companions: median 2 rounds,  2 hp lost,  0 of 68 fights kill the player

Every companion standing with you swings on your turn, and the enemy's one blow
rotates between all of you: a party of four multiplies what you deal by five and
divides what you take by five, and nothing on the other side scales with the
crowd it faces. The realm tells the player "everyone who will come may come",
every blind player recruits all four, and from then on a fight is a formality.
That is why `warden_brace` and `warden_break` were offered 24 times to blind
players and taken none: an ability that spends a charge to soften one blow in
five is not worth the charge. **The next combat change should be about what
scales against a crowd, not about what the abilities say.**

## The afternoon, and three surfaces nobody was measuring

The morning's work came out of reading blind players' traces. The afternoon's
came out of noticing that three of the things a player touches most were not
on the bar at all: the turn counter, the journal, and the free `status` screen.

**A turn was being charged for opening a door.** `spentTurn` has always
exempted a `BROWSING` set — the travel menu, picking a region, backing out —
and the rule was written on the line above the code. `talkto` and `endtalk`
were missing from it, and both do exactly one thing: set or clear
`s.talking`. The topic you pick afterwards is the action. Leaving them out
cost two things that looked unrelated until they were the same bug:

- A folded npc's conversation was a turn dearer than an unfolded one's, for
  nothing but how the author laid the menu out.
- **A "+N for 2 turns" ability could never reach a check inside a topic.**
  Press on turn N, open the conversation on N+1, pick the topic on N+2 — and
  a two-turn buff granted at N is already gone. 65% of the realm's will checks
  live inside a topic (134 of 205). That is why `envoy_press` was offered 77
  times across two blind waves and pressed 0, and why the Envoy road written
  an hour earlier recorded `WILL d20:6+3=9 vs DC 11` on the very check it had
  just paid a charge to boost. The same die on the same road now reads
  `WILL d20:6+7 (+2 base, +1 Silver Tongue, +4 resolved)=13 vs DC 11 — success`,
  and clears it. That is the first time in this project's history that ability
  has done anything.

The realm's own walkthrough wins in **240 turns instead of 255** — fifteen
turns that were being spent opening doors to conversations — with the
act-response average unmoved at 439.48. A turn-economy bug is invisible to a
character budget, which is why it survived eight waves.

The road that exposed it is worth its own line. `crowned_hollow#envoy` is the
first proven route walked by an Envoy that spends its own kit rather than
carrying it: `parley` calms the gray husk at the Gray Cairn instead of
fighting it, a grace gamble and two searches carry seven gold into Wolf Scrape,
and `buy_off` pays a gaunt wolf to stand down — the first proven route ever to
hold five gold next to a live hostile. With it, `test/abilities.test.ts`'s
`UNPROVEN` table is **empty for the first time**: twelve abilities, twelve
proven. The table's last line had claimed "no proven route ever holds 5 gold",
which was true of the eleven routes it was measured against and false of the
realm's coin — `reach_bargained` already peaks at 8. The debt was never the
gold. It was that no Envoy road had ever carried it past something that would
kill it.

**Twelve ranks, and not one of them had a thread.** Six factions, two tiers
each, every rank granted by exactly one npc topic in exactly one room — and
nothing in the game told you which room. Three blind players collected two of
twelve between them across 1,669 turns. `world/reach/ranks.json` gives each
faction one ladder: the first stage names who can trust you and points at
their door, and once trusted it names who can swear you (for the Watch, a
different person in a different hall). The standing-gated three start on the
standing **and** on having met the granter — a rank is collected from a
person, so that is the right rule on its own, and it is also what kept the
Scout road inside its allowance, which had 0.07 characters of headroom. Twelve
of twelve have threads now. The file is a new part and the root's `include` is
a glob, so a system can be given its own file with no edit to the root at all.

**The free screen had grown to nine times the paid one.** `status` costs no
turn, a blind player reads it constantly, and nothing was measuring it: along
the walkthrough it averaged **3,924 characters and peaked at 6,705** against
an act-response held to 450 and 1,100. The largest single piece was the way to
somewhere far off — a journal carrying fifteen threads printed 234 characters
a line, and the long half was a nine-leg walk to a hold two regions away,
which is not the answer to "where do I go next" but a wall in front of it.
`bearingsHere` has always drawn the line at the region border, and a region's
name is what a player routes by at that distance, so a distant thread now
reads `(in Fenmarch)` and a near one keeps its walk. That also skips a
breadth-first search per distant thread on every call, fifteen times a look.

The surface has a ratchet now, in `test/format.test.ts` — **3,650 average,
5,650 worst**, currently 3,644 and 5,621. The numbers are deliberately large:
most of what is in there was asked for by name in three separate waves, so the
test holds *growth* rather than a small number, and may only turn down. It
exists because `status` grew twice in one day without anything noticing — the
`at` that 372 stages now carry (from 0 this morning) and six rank threads both
print there.

**A hold's grief now opens when you arrive, and closes on whatever you did.**
The morning gave 131 stages the room they point at; the afternoon closed the
other end. All fifteen holds open a thread on arriving now, rather than on
stumbling into one particular room. And eight of fifteen had no quest whose
`done` was the hold's own fate, so a player who bargained or burned could leave
the announced-grief thread open in their journal for the rest of the run.
Fourteen of fifteen close on the fate now — twelve read the three fate flags
directly, and the Iron Downs' reads a `resolved` flag that every one of its
five fate-setting actions raises in the same breath, verified by walking every
`fx` in the realm that touches an Irondowns fate rather than by reading the
one that looked authoritative. Pennywell is left alone on purpose: its open
thread tracks whose face strikes the coin, a question neither the rest nor the
burn road answers, so closing it on the hold's fate would print "done" over a
choice the player has not made. One dead stage fell out of the pass —
Wardmoor's default, unreachable since its two neighbours started partitioning
every state the quest can be open in.

**Three things the realm promised and never asked for.** `audit-items` learned
that a hint naming a place is a promise too, which turned one broken promise
into four; three were real. A notched belt knife pointed at a horse eight
stands west that was already written and never connected. A prior's altar
candle named an altar with no socket for it. Vell's cipher said it "might
unlock more of theirs, if you find any" — and nothing anywhere placed any, so
no player could ever have held one; it lies on the Keepers' Hall shelves now,
and the leaf Vell hands over at +8 regard can finally be read with them rather
than behind their back. Items read by something: 230 → 233 of 321. Broken
promises: 4 → 1, and the one left is a keepsake naming a place in order to say
the thing is finished, which is what a keepsake is allowed to do.

**The backlog, verified rather than trusted.** 130 open findings, read against
the code and content as they stand rather than against this file or the commit
log — both of which carry retractions and at least one corrected tool. 82 no
longer reproduce, most of them killed by a handful of systemic engine changes
rather than one fix each. 15 match the design once read carefully. 9 restate a
defect another item covers better. **23 are still real and stay open**, one of
them concretely re-verified in the process: an npc-given direction to
Thornwold's Rope Larder is unwalkable as stated. No file's contents changed —
every move is a rename, so the original report survives as its own evidence.

And four small ones, each found by something larger:
- "The blight rats stands down." One hostile in the realm is named plurally.
  A name test cannot fix that — three of the four hostiles whose names end in
  "s" are people — so the name is the object of the sentence now: "No more
  fight from the blight rats." Found by the Envoy road that finally spends
  `parley` on something.
- `scholars_tip` was a perk parked at `require: {level: 99}` with nothing
  anywhere granting it: defined, out of the rotation, holdable by nobody. Its
  description was wrong too. Deleted — `old_lore` and `keen_eye` already offer
  its effect twice over. Found while checking whether `status` could stop
  printing each perk's effect twice, which required reading all twenty-two.
- A companion you tell to wait here leaves your company; one who has had
  enough of you *walks out*, which is the word the menu preview has always
  used. The event now matches the warning that preceded it.
- `horrorHere`'s missing negated twin has been described in a comment for
  weeks. The two content uses want opposite quantifiers, so no negation fixes
  it — and of the 58 rooms holding something that strikes back, **one** is
  mixed. One room does not earn an op in a closed DSL. Left alone, with the
  number written down so the next author does not have to re-derive it.

## Wave nine, and the door three reports were standing at

Seeds 9911-9913, 505/565/568 turns. Three of three won, fun 5/5, clarity
**4/5 for the fourth wave running** — which now makes clarity the most stable
number in the project, and the one worth reading hardest.

23 new findings, 5 already known. Every player filed every one of its own
severities as P2; triage promoted eight to P1 on corroboration, and the
promotion is the interesting part, because three players hit the same thing
from three directions:

- the barrow-wight parleyed into standing down, and the passage it guarded
  still locked;
- the honour guard *named* into standing down, and then, the report says,
  attacking anyway;
- and in the confusions, plainly: "expected a stood-down enemy to no longer
  block a locked exit".

"Standing something down is not a key either" landed **this morning**, as a
line on the door naming which way stays locked. Three players read that line
and still expected the door to open. That makes it a design question, not a
wording one, and it is the strongest single signal this wave produced.

**One half of it was a real lie, and is fixed.** `scholar_name` calms the
honour guard; `aggressiveNow` reads `calm_<id>` and refuses a calmed npc its
turn, so nothing ever struck that player. But the rest-rite's own miss said
"It comes for you regardless" — about a thing that was never coming. The
player believed the line over the state, which is the right way round: the
line was wrong, and the miss reads the state now. Scanned before fixing:
exactly one action in the whole realm narrated an attack inside a branch a
calmed hostile could reach, and this was it.

**Retracted, with the measurement.** Menu pagination "cycling back to page 1
instead of advancing" is the intended cycle. `pageRoom` takes
`s.roomPage % pages`, the header prints `p2/3`, and `roomPage` resets on
entering a room. What that report actually wants is a way to know a two-page
room *has* two pages — which the marker gives, and which the player did not
mention seeing. That one is superseded, by rename, as the sweep's
not-a-defect items were; the inbox stands at 45 open (8 of them P1), which is
23 filed by this wave on top of the 23 the sweep left, less this one.

**Reframed, and it turned out to be the same door.** A player reported that
bearings "described paths that didn't match the actual room-to-room
connections encountered while following them, causing backtracking".
`audit-bearings` walks every leg in all 293 rooms that offer bearings: **0
lead anywhere but where they say.** So the legs are not the defect. But the
walk a stage's `at` prints comes from a breadth-first search that crosses
every exit in the graph, *gated ones included* — right for a bearing, which
says where a place is, and not always right for a route a player is told to
follow.

`scripts/audit-routes.ts` measures the split along the walkthrough:

    1,120 routes printed
      111 cross an exit shut at that moment (9.9%)
       80 shut somewhere other than the last leg (7.1%)

A shut **last** leg is the design working: the door is the objective. A shut
leg **before** it sends the player through a door that is not the point, and
costs them the walk back. All 80 are at three doors — the barrow doors under
the Vale, the pilgrim's door at Marrowgate, and **the honour guard's passage
in the Old Crypts**, which is the same door the stand-down reports were
standing at. Two findings filed by two players against two systems are one
place in the map.

The fix is not the content's: it is that the router prefers the shortest path
over the walkable one, and never says which it gave you. That wants its own
cycle — `walkFrom` is cached per room and state-independent by design, which
is what makes the free `status` screen affordable, so teaching it about gates
is a real change with a budget consequence rather than a line edit. Recorded
rather than rushed.

## The bar, and the two surfaces it grew to cover

`npm run verify` green — 314 tests: typecheck, tests, validator, crawler twice,
and `mock` and `measure` as well. CI ran those last two as separate steps, so a
green local verify was a false negative for them, and it cost a red bar to find
out. The walkthrough replays to a full-score win in 240 turns, every other
ending carries its own replay-proof, the token budget holds (avg act-response
≤ 450 chars, max ≤ 1100, currently 439.48 and 1,076), menus stay at or under
12, and determinism is sacred.

Two things it now holds that it did not this morning, both of them surfaces
that were free and therefore unwatched:

- **A fight.** `crowned_hollow#bloodied` strikes blows, takes them, has a
  companion go down and hauls her back up. Before it, 3,022 proven screens had
  offered 125 fights and struck 0.
- **The status screen**, at 3,650 average and 5,650 worst along the
  walkthrough. A ratchet on growth rather than a small number, because most of
  what is on that screen was asked for by name in three playtest waves — and,
  like every ratchet here, it may only turn down.

Never weaken it. A change that reads well and replays wrong is not done.
