# The Gray Reach — where the work is, and why

Date: 2026-09-09. Owner: project lead. Every number here was measured, and
the command that measures it is given so the next reader can re-check rather
than trust.

The goal: a text adventure as large and sprawling as Skyrim, with the depth
and choice-consequence of Baldur's Gate 3.

## Where the realm actually stands

The sprawl is done. 18 regions, 905 rooms, 265 npcs, 321 items, 135 quests,
68 stamped places, 5 companions, **7 endings and 13 replay-proofs**, 12 class
abilities, 320 tests green. Skyrim has about 340 named places. **Adding a
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
8. **The rooms still over the ceiling** — mc_north_road and hl_north_lane
   were done first (1,448 to 812, 1,504 down the same way), not by cutting a
   word but by moving the companions' answers out of one `onEnterOnce` and
   into region-gated remarks, which the engine has always spoken one a turn.
   mg_hollow_throne and va_throne are cut now too: a desc clause restating the
   exit line printed six lines beneath it, an ending's own prose saying a
   thing twice, an npc desc repeating the engine's own pierce warning, and the
   free "weigh the doors of the seat" action's nine readiness lines (written
   out twice, byte-identical, for a first press and a repeat press) were all
   carrying words the screen already said elsewhere. `regent_deposed`'s worst
   screen came down 1,180 to 1,092, `reach_burned`'s 1,154 to 1,094 (its
   ratchet entry is gone — it meets the real bar both ways now),
   `gray_crown`'s 1,125 to 1,097, `reach_at_rest#devoted`'s 1,130 to 1,076 —
   all four clear the real 1,100 with no allowance. th_wood_3_1 followed the
   same day: an 8%-a-cell wilderness ambush (a gray boar) happened to land,
   on this road's own proven seed, on the same cell as Rook, the room's own
   scripted encounter — two full hostile descriptions and both their opening
   lines on one screen by coincidence, not by either encounter's own design.
   Both npc descs and the quest stage's redundant restatement of its own name
   came down; `reach_at_rest#warden`'s worst screen 1,146 to 1,097, entry gone
   too. What is still over the real bar, realm-wide: `crowned_hollow#bloodied`
   at `va_crypt`, 1,295 — a fight screen, narration and a companion going down
   and the menu, which is the one place width buys something, kept at size on
   purpose rather than left uncut.

   **Nothing measures an off-path screen today** is half-answered, not closed.
   `test/budget.test.ts` now forces mg_hollow_throne's "weigh the doors"
   action to its worst case — every road ready, the founding ledger and the
   Vale's crown both carried, a companion along — and holds it under the
   ceiling by name: 1,040 and 1,064, a state no proof or `crawl --worst` has
   ever rendered. But the same forced state entering the room *fresh*, rather
   than pressing an action inside it, renders **1,344** even with no
   companion: the room's own `onEnterOnce` text, a quest-stage-change notice,
   the full desc, the Regent's npc desc, and two item hints each written for
   its own screen all converge because every one of the throne's roads
   happens to be open at once. That is content stacking, not a redundant
   line — the same shape as item 11's act-gate exposure, not this pass's
   cut-the-restatement fix. Recorded rather than rushed: measured, unfixed,
   and not asserted anywhere yet.
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
10. ~~**A sixteenth hold, last**~~ — Longford, and its problem is a toll
    captain, not a grief-hollow. `hollows_rested/burned/bargained` untouched
    by design.
11. **The act gate, which is why three runs saw the same half of the realm.**
    Not a map problem: the region graph is a proper sprawl, 0-4 hops across,
    and six regions appear in all three wave-eight runs while five appear in
    none. The pilgrim stair at Coldpass opens on **any three holds rested**,
    Coldpass is two hops from the start through Wardmoor, and Marrowgate is
    through Coldpass — so a player rests the three nearest holds and walks
    into the endgame having seen a quarter of the realm. Unseen content in a
    large world is fine; three runs seeing the *same* unseen half is not. The
    lever is what the gate counts, not where the roads go.
12. ~~**The router gives the shortest way, not the open one, and never says
    which.**~~ `pathTo` now tries an open route first (`routeTo(..., true)`)
    and only falls back to a shut one when no open way exists at all, saying
    so in `status` when it does. Of the 80 routes `audit-routes.ts` found shut
    before their last leg, 6 resolve to an open alternative; the other 74 have
    none — the dungeon really is linear there — and now say so instead of
    silently crossing a door that was never the objective. `bearingsHere`
    is untouched: a bearing still says where a place *is*, gates or not.
13. **A menu number means one thing per room, not one thing per turn.**
    `menuNumbers`/`actionByNumber` already fixed the page-boundary version of
    this (a number meaning two things across two pages of the *same* room
    view); nothing yet fixes the turn-boundary version, where the room's own
    option list changes because state changed — an enemy dies, an item is
    used up — and a number a player is holding in their head from the
    previous turn now names something else. Recorded rather than rushed
    (2026-09-15 note, below): the honest fix is non-contiguous numbering that
    survives a turn, which is a state-shape change (something has to
    remember which slot was whose), and one report doesn't yet justify that
    size of change against how it might read (gaps in a numbered list are
    their own confusion).

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

## "All flags true" is not an upper bound, and four rooms were over the cap

A suggested task claimed `hb_mere_shore`'s menu "grows to 13 options in some
reachable state (over MENU_CAP 12) — which the standard verify bar's shallow
crawl never samples deeply enough to catch". Both halves of the claim were
wrong. The gap it pointed at was real, and bigger than 13.

The first two measurements said there was nothing to find:

- `crawl --fork --deep`: **0 over cap in 48,868 steps across 564 of 905
  rooms.**
- Every room, every class, with **every flag in the world forced true** — the
  most permissive state anything could be read in: worst load **11**.

Both were honest and both were useless, because of one thing worth writing
down: **a state with every flag set is not an upper bound on a menu.** A topic
gated on `["!flag", x]` *disappears* when x is true. Forcing all flags on hides
as many options as it reveals, so that sweep measures one arbitrary corner of
the space, not its ceiling. It felt exhaustive, which is what made it
dangerous.

Hill-climbing the flag space instead — 4,000 iterations per class per room,
keeping any flip that does not lower the load — found four rooms over:

    th_quartermaster  16      wm_armoury   16
    th_muster         14      wm_barracks  14

One cause behind all four: an npc listing ten or twelve topics **flat** rather
than folded behind `talk to <name>`. Quartermaster Bray carries 12, Sergeant
Coe and Wardmoor's quartermaster and Corporal Fenn 10 each, Bram Otts 9. **132
npcs in the realm already fold**; these five had simply never been given
`dialogue: true`. Folding them:

    th_quartermaster 16 -> 9     wm_armoury  16 -> 11
    th_muster        14 -> 7     wm_barracks 14 -> 7
    sk_drowned_bell  13 -> 5

and the walkthrough got *cheaper* doing it — 439.4796 to 438.8699 — because
the proven road walks rooms that were printing those lines flat. Folding cost
nothing anywhere else either: none of the five is named by the walkthrough or
any of the 13 proofs, and since opening a conversation became browsing this
morning, a fold no longer costs the player a turn. That is the second time in
one day the browsing fix paid for something it was not aimed at.

**The test is the half that matters**, because the thing that failed here was
the bar, not the content. A hill-climb is far too slow to run on every push,
so `test/content.test.ts` bounds each room statically: exits, the travel entry,
every custom, everything that can end up on its floor, and per npc either one
folded entry or every topic it owns. It **over-counts on purpose** — mutually
exclusive options are counted together — which is what makes a bound within
the cap a *proof* that no state can exceed it rather than a sample that missed.
899 of 905 rooms are provably under the cap now, in every state that will ever
exist.

Getting the floor term right took two attempts, and the typechecker caught the
first. `ItemDef` has no `room` field — an item's start is `loc` — so the draft
silently counted zero items in every room and read clean. The corrected term
also walks `["move", item, dest]`, resolving `"here"` against the room whose
action or npc fires it, and that found three more rooms the first version had
passed.

Six rooms keep an argued allowance, each a climax whose customs are the endings
of one choice, each carrying the worst load the hill-climb could actually
build: `va_throne` 16/6, `mg_hollow_throne` 16/3, `fd_drowned_nave` 15/10,
`ir_company_store` 14/11, `va_inn` 13/11, `hb_kingsrest_throne` 13/9,
`me_hollow_chamber` 13/5 — and, in the Vale of Ash, `square` 27/11 and
`throne` 32/10. Like `crawl.ts`'s `CROWDED` and `budget.test.ts`'s
`PROOF_BUDGET`, the list may only ever shrink.

`va_inn` is the one flat-topic room left standing on purpose: the walkthrough
asks `"ask innkeep: rumors"` by name, so folding it would rewrite the proven
road to tidy a room that measures 11 against a cap of 12.

## An outside reviewer, ten findings, and the one that invalidated our numbers

Taking the pull request out of draft triggered an automated code review of the
whole branch. It returned ten findings, all P2. **All ten were real.** That is
worth sitting with, because this file is otherwise a record of measurement
overturning claims — and here the claims that needed overturning were the
project's own, in the parts of the toolchain nobody points a tool at.

Nine were fixed as described. Five of those share one shape, and it is a shape
to watch for in a closed DSL: **a check written for one spelling of an op,
while the DSL grew a second.**

- `clear` counted as a flag *write*, so content reading `["flag","opened"]`
  while only ever clearing it validated clean — precisely the gate-with-no-key
  the "reads with no writer" check exists to find.
- `!checkHere` validated neither its skill nor its DC. A misspelled skill is
  worse in the negated form: the nonexistent positive check is false
  everywhere, so the condition reads **true** everywhere and the ability it
  gates is offered across the realm.
- `turn` checked its comparator but not that its threshold was a number;
  `since` checked neither. World JSON is cast rather than type-checked, so
  `["since","march","=>",60]` loaded clean and fell through to equality — a
  scheduled event that fires on one exact turn, or never.
- the repeated-line check gave `chance` a `check`'s tuple offsets, but
  `["chance", pct, okFx, failFx]` keeps its branches one index left. The
  success branch was never searched, and index 4 was `undefined`.
- ending coverage demanded an exact `proofs[id]` key while the replay
  normalized `id#label` — so a world whose only witness for an ending carried
  a label was told it had none. The `#label` syntax was added here in this
  same push cycle; the coverage check was never taught about it.

All five now have tests, and two of those tests were checked by reverting the
fix to watch them fail first. That is the habit worth keeping: a test written
after a fix, and never seen to fail, is decoration.

Two were display counts. `travelMore` derived its total from the *already
paged* `travelActions`, so the top-level travel menu read "(0 more)" however
many regions were waiting — and the give-away was a dead `knownLandmarks` call
left in the function, the fingerprint of the refactor that broke it. The room
pager counted *itself* as content, reporting four hidden options as five. And
one was a phantom step per fork in the crawler, which put 253 imaginary steps
into the number every coverage comparison is read off (10,218 → 9,965).

**Where the reviewer's diagnosis was right and its prescription was wrong.**
It found that a `free` ability spends no turn but still runs the companion
remark pass, and proposed gating remarks on `spentTurn`. That gate would also
silence companions on free *customs* — deliberate acts, not page turns — and
`reach_at_rest#devoted` turns on exactly one of them, a remark answering
"weigh the doors of the seat". The real defect was narrower and was ours from
that morning: `talkto` and `endtalk` joined `BROWSING` (so they stopped costing
a turn) without joining the remark-silencing list, which made opening and
closing a conversation a **free, unlimited harvest of the remark pool** and of
whatever regard those remarks carry. A conversation can be reopened forever; an
ability spends a charge. So the exploit was in the half the report did not name.
`NAVIGATION` is derived from `BROWSING` now — one source of truth, so they
cannot drift again — with `leave` the single argued exception.

That broke the devoted road, which had been taking its paired Vell-and-Osk
remark from `talk to Vell` itself. Repaired with a `repeat`/`until` step, and
the two extra screens **paid for rather than ratcheted up**: weighing the
throne doors reprinted all six lines of its reckoning on every press, and now
explains what is missing once and thereafter confirms only what stands ready.
462.8 → 460.69. That is the fourth time this pattern has paid a bill — after
the item that explained itself in every room, the company that recited itself,
and the standing cost promised twice.

**And the one that invalidated our numbers.** The report said the budget *tool*
seeded its "seen" set with the start room even though a class-phase intro
describes no room, hiding that room's one full-description screen. True. What
the report could not see is that **`test/budget.test.ts` had the same bug in
three places** — so every budget figure this project has ever published was
short by one screen, and the ratchets were all set against under-measured
values. Correcting it adds ~700 characters to each road, and every delta is
700/screens to the character, which is the strongest possible evidence of a
single cause:

    reach_burned            318 screens  448.9 -> 451.1
    gray_crown              261 screens  451.0 -> 452.4
    reach_at_rest#devoted   352 screens  460.7 -> 462.4
    crowned_hollow#bloodied  50 screens  510.6 -> 524.5

**Four ratchets went up.** A ratchet may only turn down, so this needs saying
plainly rather than quietly: the bar now measures strictly *more* than it did,
no content got wordier, and leaving the old numbers would have left the bar
asserting something false. Raising a ceiling to match a corrected measurement
is not the same act as raising one to let content through. `reach_burned` is
the one that stings — it met the real 450 ceiling with no allowance at all, and
honestly measured it is 451.1, one character over.

The lesson is not "the tools were buggy". It is that **eight of these ten live
in the bar itself** — the validator, the crawler, the budget tool, the budget
test. Everything in this project is measured except the things that do the
measuring, and they had been accumulating exactly the kind of quiet error the
measurements exist to catch.

## The bar, and the three surfaces it grew to cover

`npm run verify` green — 320 tests: typecheck, tests, validator, crawler twice,
and `mock` and `measure` as well. CI ran those last two as separate steps, so a
green local verify was a false negative for them, and it cost a red bar to find
out. The walkthrough replays to a full-score win in 240 turns, every other
ending carries its own replay-proof, the token budget holds (avg act-response
≤ 450 chars, max ≤ 1100, currently 439.48 and 1,076), menus stay at or under
12, and determinism is sacred.

Three things it now holds that it did not this morning, each of them a surface
that was free, or unsampled, and therefore unwatched:

- **A fight.** `crowned_hollow#bloodied` strikes blows, takes them, has a
  companion go down and hauls her back up. Before it, 3,022 proven screens had
  offered 125 fights and struck 0.
- **The status screen**, at 3,650 average and 5,650 worst along the
  walkthrough. A ratchet on growth rather than a small number, because most of
  what is on that screen was asked for by name in three playtest waves — and,
  like every ratchet here, it may only turn down.
- **Every room's menu load**, bounded statically rather than sampled, so a
  crowded room cannot hide in a state no crawl walk reaches. 899 of 905 rooms
  are provably inside the cap; the six that are not are argued for by name with
  the worst load a flag search could build.

Never weaken it. A change that reads well and replays wrong is not done.

## 2026-09-15 — the queue, resumed

Picking the backlog back up. First item, `P1-issue-2872b769`, claimed
"get your bearings" hints in Thornwold/Camp Gallows described paths that
didn't match the real connections. Filed against `de27dd6`, which predates
the afternoon's bearings overhaul (§ "The afternoon, and three surfaces
nobody was measuring") — so the question was whether it still reproduces,
not whether it once did.

`scripts/audit-bearings.ts` says 0 of 293 rooms' "get your bearings" legs
are wrong, but 7 are prose-only and outside what it can check — Rook's
directions to the Rope Larder among them, and worth checking by hand since
they carry a count a player could actually follow. Traced through the real
engine (`th_settlement` --west--> `th_wood_4_2` --west--> `th_wood_3_2`
(Fox Crossing) --north--> `th_wood_3_1`, which is the Rope Larder): exactly
"two stands west of the gate, then one north past Fox Crossing," as both
copies of the line say. The Muster Ground npc's "Keepers hide west in the
wood, past five stands, at its far corner" also holds: five wests from the
gate lands on `th_wood_0_2`, the grid's west edge, which continues on into
`th_hollow_approach`. Superseded — moved to `queue/superseded/` by rename,
contents untouched, the way the pagination finding was.

### Standing something down is a key after all

Wave nine's stand-down findings never closed. `fbe235e` (2026-09-09) fixed
the honour guard's own lie — a calmed guard's failed rest-rite no longer
claimed an attack `aggressiveNow` had already made impossible — and left the
mechanic alone on purpose: *"standing something down is not a key, and the
exit says so."* The same wave still expected the door to open regardless,
and called it "a design question, not a wording one." Three more reports
arrived after that fix landed, not before: `P2-issue-195be48f`,
`P2-issue-74b45e30`, `P2-issue-fa597745`, all describing the same gap from
a different angle. A wording fix, tried once and measured against a live
wave, that still produces the same complaint is evidence about the design,
not about the wording.

`calmhostile` (`scholar_name`, `envoy_parley`) already reads as full
neutralization to the engine: `hostileNow` is false the instant something
is calmed, same as dead. A creature the engine no longer considers hostile
holding a door shut by content-only convention was the actual gap. Every
guarded passage that can be calmed now treats `calm_<id>` as equivalent to
however it was previously unlocked, `any`-joined onto the exit's existing
condition:

- the honour guard (`mg_old_crypts`) and the Vale barrow-wight (`va_crypt`),
  named in the P1s directly;
- the Hollowbrook grave-wight (`hb_kingsrest_hall`), same shape, not
  previously named;
- all three shared templates with a guardian in the doorway — barrow
  (wight), camp (captain), chapel (saint-shade) — so the fix reaches every
  stamp of each (9 + 10 + 13 = 32 places) in one change rather than one
  region at a time. The fourth guarded template, the tower's watcher, is a
  riddle gate with no `hostile` field at all — nothing to calm — and is
  untouched.

Every action that used to be the only way past now also gates on
`!calm_<id>`: a door already open has nothing left for "slip past" or "the
rest-rite" to open, and offering them anyway is the kind of option that
costs nothing, does nothing, and reads as a lie of its own. `test/conditions.test.ts`
now proves both halves on the honour guard: uncalmed, the rest-rite is
still there and the door still holds; calmed, neither redundant action is
offered and `go north` simply walks through.

One proof paid for it. `crowned_hollow#bloodied` kills the barrow-wight
outright and never touches the calm path, but it does sit in `va_crypt`
for three attack turns, and the locked exit's `hint` renders on every one
of them — `scripts/budget.ts` counts that line whether or not the exit
ever opens by it. Wording added to `hint`/`lockedMsg` on the two named
rooms pushed `va_crypt`'s screen from 1295 to 1304 and the proof's average
from 524 to 525.2. Reverted the wording, kept the `any` condition and the
new stood-down variant text (neither is on this proof's path, since the
kill sets `npcDead` and the pre-existing first-match variant wins): the
mechanic doesn't need the hint to say it works, and the ratchet only turns
down.

### An ability already says what it does

`P1-issue-79a74776` quoted "press him (+4 will, 2 turns)" as a menu option
offered "with no explanation of what it does or costs beyond the label;
never safe to try blind." That quote is half of the current line. Abilities
are global (`world.abilities`), so `envoy_press` renders identically
wherever its `if` holds — the finding's "various NPC dialogues, e.g. Old
Watchtower, Wardmoor" is the same one code path everywhere, not several
that could drift. `oddsHint`'s `ability` branch (`src/engine.ts`) appends
both the effect (`abilityEffect`, from `world.conditions`) and the pool
cost (`abilityCost`) to the same parenthetical, and
`test/abilities.test.ts` pins the full string: `/\+4 will, 2 turns; \d+ of
2 left/`. The player who filed this saw the effect half already landed;
the cost half was already there too, just not in what they quoted. Nothing
left to fix — superseded, moved to `queue/superseded/` by rename.

### A menu number surviving a turn, not just a page

`P1-issue-d3907169`: "an enemy dies or an item is consumed" and a number a
player was holding onto from the previous turn now names something else —
"I once meant to attack but hit 'use dried herbs'." `P2-issue-dd0b35f1`
asks for the same thing by a proposed fix: pin frequent actions to stable
numbers.

This reads at first like the bug `menuNumbers`/`actionByNumber` already
fixed — the comment on `menuNumbers` describes "'use dried herbs' silently
consumed the item on a page where I meant to pick a different numbered
option" almost word for word — but it is the adjacent problem, not the
same one. That fix stabilizes a number **within one room view**, across
pages of content that isn't changing. This report is about a number
**across a turn**, where the room's own option list changes because the
state actually did: `allActions` is rebuilt fresh from current state every
call, by design (a dead thing's attack option has to disappear, or the
menu lies), and whatever came after the removed entry shifts down. Reading
the actual fix (`src/engine.ts`'s `menuNumbers`) confirms it directly — it
renumbers off `allActions(world, s)` for the state *now*, which has no
memory of the state a turn ago.

A real fix is non-contiguous numbering that survives a turn: something in
`State` remembers which number was whose, and a removed option leaves a
gap rather than closing it. That's a state-shape change, not a line edit —
it touches determinism (`State` has to stay a plain, hashable, replayable
value), the crawler and mock player (both index into the list
positionally), and it trades one confusion (a number changes meaning) for
a different one (a numbered list with holes in it) that hasn't been
measured against real players either. One report, its own proposed fix
unevidenced beyond the report itself, doesn't clear the bar this project
holds engine changes to. Left in `queue/` rather than superseded — it
isn't false, it's real and larger than one cycle should attempt on this
much evidence — and recorded as item 13 in the order above.

### The travel menu gets the room menu's own fix

`P1-issue-05f453ff`: travel-to-known-place menus "paginate in inconsistent
groupings (sometimes by region, sometimes by recency)" and reaching a
known, far-off place "require[s] several 'more places' clicks." The
"inconsistent groupings" half is by design and stays: a short list of known
landmarks shows flat, a long one groups by region first, because nothing
fits fifteen-plus names under `MENU_CAP`. The "several blind clicks" half
was real, and had a second bug hiding under it.

Sorting the destinations alphabetically (`byTravelName`, dropping the
leading article so it reads the way `actionLabel` already prints the name)
turns hunting into guessing — a player can jump toward the right page by
name instead of paging through the whole list once just to learn where
discovery order put things. That alone broke two proofs
(`reach_burned`, `reach_bargained`): `no legal action labeled "to the
hunter's camp"`. The reason was `menuNumbers`'s own comment, read closely
— "a conversation and a travel list page by their own older rules and
number from 1 per page, so `allActions` holds only the page showing there."
`allActions` is what `actionByLabel` and `step`'s legality check both
judge against, and for travel it had only ever held the current page's
worth. Sorting didn't create that gap; it just meant page 2 might now hold
a name page 1 used to, which a walkthrough step frozen on the old order
walked straight into.

`allActions` now gives travel the same whole-list treatment the room menu
already has (that comment, in fact, had already flagged it as "worth the
same treatment when one of them is" reported — this is that report):
`legalActions` still shows one page via `travelActions`'s existing bespoke
pager, but `actionByLabel`, `actionByNumber`, and `menuNumbers` all read
off the full, sorted list now, so a number under a travel destination
means the same thing on every page, and a destination is legal whether or
not its page happens to be showing — exactly how a room's own menu has
worked since wave six. Confirmed live past the fix (walked the real
walkthrough to turn 71 in `va_square`): the travel menu reads `to the
barrow field / to the hunter's camp / to Last Light gate / to the old
watchtower / to the sunken shrine / to the Vale's west road / toward the
Vale of Ash / stay here` — alphabetical, landmarks first, the region
fallback and "stay here" still last.

verify green: 320 tests (`test/realm.test.ts`'s synthetic 13-region
pagination test covers the wrap-and-cross-page-number case directly), all
three worlds validate, crawler clean. `npm run mock`'s seed 7 now ends at a
different turn (226 instead of 398) — expected, not a regression: it's a
structural player whose choices follow menu position, and the menu itself
changed shape; determinism (same seed, same code, same result) is what
`test/determinism.test.ts` guards, and it still passes.

### Two P2s the stand-down and travel fixes already covered

`P2-issue-71bf34bb` asked for "a consistent, telegraphed signal for whether
a 'stood down'/'named' undead enemy is actually pacified or just delayed."
`calm_<id>` is now permanent (a plain flag, never a timed `cond`) and
`hostileNow` treats a calmed npc as not hostile at all, the same as dead;
the passage it guarded now opens on that same flag, and the room's own
description says so ("stood down now and no longer minded to stop you").
The signal is no longer just a line — it's the door. Superseded.

`P2-issue-dd0b35f1` asked to pin attack, talk, and travel to stable
numbers across turns. Travel's own case is fixed above, by the same
mechanism a room's menu has used since wave six (`allActions` off the
whole list, not the page). Attack and talk are the harder, still-open
half — a target dying or a topic being answered isn't a page boundary,
it's the legal-action set itself changing, and item 13 above records why
that needs more than this cycle. Half fixed, half tracked; closed here
since the travel half was this finding's own best evidence and the rest
is item 13's now.

### Six suggestions about a free action nobody thinks to use

`P2-issue-b3560b65`, `-b3855a6a`, `-ee5147e3` want "weigh what this grief
asks" surfaced earlier or automatically — at a hold's first room, not just
its grief-site, since a player route-planning a 40-70 turn hold has no way
to compare its three fates without walking there first. `-fe69d78e`,
`-61819ef7`, `-38d23d53` want the same for "get your bearings" — offered
in every hub, on every hold's first entry, on a loop-back — since it was
"the single most useful navigation tool in the game."

Checked what's already true before designing anything: both actions
already render with a literal `(free)` tag (`oddsHint`, confirmed live —
"weigh what this grief asks (free)", "get your bearings (free)" — at
`th_hollow_glade` and a Thornwold wilderness cell respectively), `bearings`
is offered 287 times across every wilderness and settlement file, and
`weigh what this grief asks` (or a hold's own equivalent phrasing) already
exists in all fifteen holds. The "is it free" and "does every hold have
one" halves of these six reports are already true; what's left is "a
player has to already be standing at the site to learn what it asks."

Tried the obvious fix: one `onEnterOnce` line at `va_gate` — the literal
first room of the game, where `get your bearings` already sits in the
menu — teaching both mechanics once, to every player, on turn one. It
broke budget on eight of the thirteen proofs simultaneously
(`crowned_hollow#bloodied: avg 528.9 > 524`, six others each 1-2 over),
because `va_gate` sits on all thirteen paths and several were already
inside a character or two of their own ceiling. A universal hint is only
free at the point it's shown if every proof that passes through has room
for it, and eight of them didn't. Reverted rather than pay for it by
trimming eight unrelated screens to make space — a bigger, separate change
this cluster doesn't justify on six single-corroboration suggestions.

Left as-is, on the evidence above: the specific "is this safe to try"
uncertainty these reports raise is already answered by the `(free)` tag
wherever the action is standing in front of a player, and both actions are
already about as widely placed as the fifteen-hold, single-hostile-per-room
conventions allow. What the reports actually want — knowing before the
walk — is a real, unclosed gap, but the fix is bigger than a line (it's
budget room that has to come from somewhere, or a mechanism that doesn't
cost a screen at all, like a `status` addition measured against its own,
different ratchet) and six reports at one each don't clear the bar this
project holds a cross-cutting content change to. Superseded, with the
attempt and its budget cost on the record so the next pass doesn't retry
the same shape.

### The prose bearings audit-bearings.ts can't check — checked by hand

Five P2s about wayfinding: `0b662d30` and `76ca71fc` name specific places
("the Rope Larder, flooded quarry/slag-hound den, Gallows Glade", "the
Hundred Gallery, the Drowned Nave, the oath-stone") reached wrong off
hand-written directions; `1cfd3cf4` wants `get your bearings` to match
traversal 1:1 or say when it's approximate; `1cab03fa` says the "stands"
unit doesn't reliably equal one room-hop; `3ddba1f3` wants a persistent
compass note on top of it.

`audit-bearings.ts` already proves the *generated* `["bearings"]` system
0% wrong (293 rooms, every leg walked through real exits). What it cannot
check is exactly what these five are about — prose written by hand outside
that system, seven instances realm-wide by its own count. Swept for all
of them directly: every string in every world file carrying two or more
"number (stands?) direction" phrases, plus the single-leg ones a manual
read had already flagged. Five multi-leg claims, one single-leg:

- Thornwold's "two stands west of the gate, then one north past Fox
  Crossing" (the Rope Larder, both copies) — walks exactly there.
- Wardmoor's "Opened Cairn one stand north" and "four stands north of
  Highward... one east to the Last Cairn, then north" (to the oath-stone)
  — both correct once "out onto the moor" is read as the implicit first
  step, which is how the room's own exit is named (`out`, not a compass
  direction) and how every hand-written hint in this hold already treats
  it.
- Fenmarch's eel-trader — "past my landing, one stand west then one
  south, by the Eel-Run" — walked to the Wayside Shrine, nowhere near a
  bog-thing. Wrong. The real path (`pathTo`, engine-computed) is out, one
  south, one west. Fixed to match.
- The Iron Downs' "three north of the head-frame, then three east" to the
  flooded quarry (0b662d30's own "slag-hound den") — real path is three
  north, two east. Off by one. Wrong. Fixed.

Two wrong out of seven checked, both now fixed and reverified (verify
green). That is a real, if small, error rate specific to hand-authored
prose — worth knowing, since it says the seven `audit-bearings.ts` already
flags as unchecked are exactly where an error would hide, and worth a real
tool if the realm keeps growing hand-written route text; not built now;
noted as a gap rather than promised as covered.

`1cfd3cf4`, `0b662d30` superseded on the strength of a complete sweep, not
a sample. `76ca71fc`'s "easy to not think to use bearings" half is the
same ask as the six-report cluster above and is covered by that entry.
`1cab03fa` closes with the two fixes as its evidence: "stands" itself was
never the problem in any of the five multi-leg claims — every one used it
(or a bare direction) to mean exactly one room-hop — the two real errors
were in the specific directions given, not the unit. `3ddba1f3`'s compass
note is a real, separate feature (bearing-angle output, not exit-walking)
that nothing here builds; left open rather than superseded.

### A companion quarrel already shows its odds

`P2-issue-8d096dce` wants odds shown before a companion-mediation will
check, "similar to how normal skill checks show 'roll X+ on the die'."
`P2-issue-b9dd9dd4` wants a clear signal for which approach — backing one
side or mediating — is safer, since failing "cost standing with both
companions with no warning of the odds beforehand." Both name will, DC~11.

That check exists — every companion-pair quarrel offers a `talk` topic
like `quarrel_lys_osk_settle_b`, "try to settle the sexton's roll (will)",
DC 11, that mediates instead of taking a side — and it already previews
through the same generic path every other check in the realm does. Read
live, mid-quarrel:

    side with her against the roll-book (Lys +2, Brother Osk -2)
    try to settle the sexton's roll (will) (DC 11, roll 11+ on the die; a miss costs standing with Lys and Brother Osk)

The DC, the roll target, and which two companions a miss costs are all
already in the line, and the deterministic "side with" option prints its
own exact effect right beside it — a direct comparison, not a guess.
Neither finding's premise survives a live check of the current build.
Superseded.

### Four P2s about weighing an irreversible choice

`P2-issue-c1c437de` and `P2-issue-748f4551` are the same ask twice: warn
about the Pass Gate's permanence earlier than the gate itself — "when
Coldpass first opens" or "at Coldpass' outer approach." `P2-issue-79614253`
wants binding, character-altering oaths flagged more distinctly from
ordinary rank grants. `P2-issue-85d9c61a` wants "wait here (leaves the
party for now)" renamed or confirmed, since it "reads as reversible small
talk."

Checked `85d9c61a` first, since it's the cheapest to settle: "wait here"
*is* reversible small talk. `["party", id, "leave"]` only clears
`inParty`; rejoining is the same generic "join" topic that first recruited
them, gated on nothing but being met and not having actually walked out
(`!flag <id>_left`, a completely different, unconditional event). The
label already says "for now" and means it literally. No change — the
premise doesn't hold.

Checked `79614253` against the Ironbound oath (the clearest binding,
faction-switching choice in the realm): live, mid-conversation with
Preceptor Aldous, "ask to swear the Preceptor's oath" already renders as
"(costs standing with the Barrow-Keepers and the Gray Church)" — the same
generic outright-cost preview every action gets, reaching inside the `if`
branch that gates the oath on `rep_iron >= 9` to find it. A two-faction
standing hit previewed before the turn is spent is a real, quantified
signal that this is not a small choice, even without a literal
"irreversible" tag; building a second, separate distinctness marker on
top of an already-working generic mechanism isn't a small change for one
single-report suggestion.

`c1c437de`/`748f4551` are the one real, actionable half of this cluster —
and the one this session already has hard evidence about. `cp_south_stair`
(Coldpass' own entry) is on the same shape of problem as `va_gate` two
entries above: a quick replay check found it on 9 of 11 proofs that could
be simulated cleanly (the other two, `reach_burned` and `reach_bargained`,
didn't replay in the quick check but are full-realm endings that reach
Marrowgate and so almost certainly cross it too) — a near-universal
critical-path room, exactly the shape that broke eight ratchets for one
sentence at `va_gate`. Worse here: `status`'s own separate ratchet, the
one surface with a different budget pool a hint could hide in, was
measured at 3,644/3,650 average and 5,621/5,650 worst the day it was
written — six characters of slack. Any new line, conditional or not,
sized to fit either pool is not a realistic ask right now. Not re-run as
a second experiment (the mechanism and the numbers are already on the
record above); left open rather than superseded, since both reports are
correct that the warning arrives late.

### The choice text was lying about the win-condition math

`P2-issue-c13e4bc4`: "Label 'bargain' outcomes inline as counting toward
the hollow-rested tally, matching what status already says, so the choice
text and win-condition math agree." Checked `hollowRoute` (`src/engine.ts`,
the function behind every "(settles this hold's grief: …)" preview) — it
matched a hold's `_hollow_bargained` flag and returned "a bargain:
quieter, not rested" unconditionally, before ever looking at whether the
same effect list also touched `hollows_rested`.

It always does. Swept every fx array in the loaded world containing an
`addvar hollows_bargained`: 21 sites, all fifteen holds, and every one
also carries `addvar hollows_rested` in the same list — universal, not a
sample. `status`'s own track label already said so ("Hollows rested
(holds only; a bargain counts)"); the in-the-moment preview was the one
piece of text that hadn't caught up. Fixed to "a bargain: quieter, but it
counts" — three characters longer, accurate, and `test/party.test.ts`'s
synthetic fixture (which had `hollows_rested` in its own "vow" action's fx
the whole time, and asserted the old text anyway) updated to match.
verify green, no proof or walkthrough budget moved measurably.

`P2-issue-df45b972` wanted the "counts vs doesn't" distinction visible in
the moment rather than only in `status`, for grief sites smaller than a
whole hold. That contrast already exists two ways: `hollowRoute`'s tag
appears only on actions that actually touch a hold's fate, so its absence
on a side quest's own resolution is itself the signal, and the journal
marks a quest whose `done` settles a hollow "(this hold's grief)" apart
from a hold's ordinary side threads. Superseded on the strength of the
bargain fix plus these two existing, already-contrasting signals.

`P2-issue-f5fa61c0` wants the tally in the main HUD line, not just
`status`. `world.hud` carries exactly one entry (`gold`) on purpose — the
turn header used to also restate the running score and that cost 2,328
characters along the walkthrough "to tell a player something no turn of
theirs had changed," so it moved to `status`, where a whole telling is
free. A hollows-rested counter is the same shape of always-present,
rarely-changing number the header was already trimmed of once; adding it
back costs roughly what removing the score saved, multiplied across every
turn rather than paid once. Left open rather than superseded — the ask is
reasonable, but reintroducing the pattern the header was deliberately
cleared of is a bigger call than this cycle should make alone.

### One real bug, and six P2s whose content already answers them

**A real, small bug, found running the realm's own tool rather than
chasing a report.** `scripts/audit-items.ts` — which checks that every
item's hint matches what the realm actually does with it — flagged
`em_watch_castoff` ("a corroded bell-key") as the one item realm-wide
whose hint promises a use nothing reads: it named Glasswick, and nothing
in Glasswick answers to it. The hint already said "fits no bell anyone in
Glasswick still owns," which is true and was the point — a dead
watchman's discarded souvenir — but naming the place is what tripped the
heuristic. Reworded to read unambiguously as a keepsake ("a dead
watchman's souvenir, not a working key; a keepsake, nothing more"); the
audit now reports 0 broken promises across all 321 items, 233 read by
something and the other 88 correctly signaled as keepsakes.

**`P2-issue-36c1f5b4`, `-52f2b4d2`, `-c99fbcd7`, `-5f43e89c`** all want
clearer signposting of which items are functional keys before a player
experiments. Ran the audit as the check: 233/321 items are mechanically
read, and — after the fix above — every one of the 88 that aren't reads
as a keepsake and only as a keepsake. The named example that still has
real texture, the Prior's rite ("said to ease even a barrow's grief,
once, wherever it's carried"), is deliberately less specific than the
Keeper's Key ("the Kings' Rest door and the pilgrims' stair at Coldpass
both know it") — some puzzle items name their lock outright and some
don't, and that's a design choice about how much a hint pre-solves,
not an oversight this tool catches. Superseded on the strength of the
audit and the one fix it found.

**`P2-issue-16a0c98c`** named its own example: "oath-stone pleas." Read it
directly — `wm_oath_plea` ("plead the ring down, plain (will)") carries no
`once`, only `["flag","wm_oath_heard"],["!flag","wm_oath_resolved"]`, so a
miss leaves it standing exactly like every other retryable check in the
realm (the fail text: "Whatever it's still waiting on, a plain ask wasn't
it" — not "never again"). The finding's own named case doesn't reproduce.
Superseded.

**`P2-issue-3e37a3a3`** and **`P2-issue-4d5671a3`** are the reeve/priest
barrow-doors sequencing, both saying it wasn't clear promising the reeve
first forecloses the priest's blessing until after the fact. Read the
reeve's own dialogue in the path to the promise: "the priest wants the
opposite, and he won't bless a door sworn shut, so see him first if you
want both" — said once on the way to the offer, and again, verbatim in
substance, the moment the promise is actually made. Both are told inline,
before commitment, not gated behind a side topic a player might miss.
Superseded.

**`P2-issue-7fcae6e7`** (companion grief vs. a hold's own grief-rite,
unclear until `status` spells it out) and **`P2-issue-3a765580`** (a
turn-pace indicator that "the status text mentions... but only if the
player thinks to check it") are both the same shape as the six-report
cluster closed earlier this session: real information, already in
`status` (a quest whose `done` settles a hollow is marked "(this hold's
grief)"; `world.objectives`' staged recap already carries pacing text),
gated on a player choosing to look. That cluster's budget finding — a
universal or near-universal hint costs more than the walkthrough or the
status ratchet currently have room for — applies here without needing a
second experiment. Superseded on the same evidence, not re-tested.

Left open, not superseded: `P2-issue-85e6fcd4` (dialogue recognizing an
answer learned elsewhere) and `P2-issue-5109e8d6` (flagging a one-time
offer about to close) are genuine, broader mechanisms nothing in the
realm does today, each touching many topics rather than one room; neither
is a quick fix and neither has more than its own single report behind it.
`P2-issue-1c7364d4` (an on-screen breadcrumb mid-walk) is the same shape
as `3ddba1f3`'s compass note above — a real feature, not built.

### Item 10: a sixteenth hold, and its problem is not a grief-hollow

Longford (`lf`), a toll crossing on the Lastwater between Pennywell and the
Shieldings. Per the order's own item 10, its crisis is deliberately not a
grief-hollow: Captain Voss holds the last free ford behind a barred rail and
a toll he keeps doubling, and nothing rests, burns, or bargains here —
`hollows_rested/burned/bargained` are untouched by design, so Coldpass's
three-hollow gate reads exactly as it did before this hold existed. The
region still follows the brief's shape (a settlement, one wilderness grid,
three stamps, an authored crisis site, a quest web, faction and companion
consequences, an epilogue) built around a different verb: not *rested*, but
*settled*.

**The three roads**, all at `lf_tollgate`, mutually exclusive on a shared
`lf_ford_done` gate:

- **force** — break the rail (might 10), or kill Voss outright (both route
  through the same flags). `lf_ford_broken`: score 15, `rep_crown` −2,
  `rep_free` +2, Tamsin +1.
- **bargain** — pay 8 gold, or talk him down (will 11). `lf_ford_bought`:
  score 20, `rep_crown` +2, `rep_free` −2, Lys +1.
- **words** — confront him with proof the toll was never his: the
  keeping-fee grant (Nan's strong-box, wits 10 to find) or his own writ
  (pressed out of him in conversation, gated on a hint from Marren).
  Confronting is wits 8/11 alone, 6/9 with Corporal Nye backing (he needs
  the same proof shown to him first). `lf_ford_freed`: score 25, `rep_crown`
  −2, `rep_watch` +2, Vell +1, Osk +1. The highest-scoring road is also the
  one that asks the most legwork — evidence, then a witness — same shape as
  the fifteen holds' own rest-over-burn incentive.

**Numbers**: 31 rooms (6 settlement, 16 wilderness cells all named, 2 in the
crisis site, plus 3 stamped side-trips), 10 npcs (6 with dialogue, 29
topics), 6 items, 5 quests (1 main, 4 side — the evidence thread, the
corporal's arc, a pilgrim's deadline, the ferrywoman's closure), 3 stamps
(cave, hut, chapel — the chapel is deliberately the pilgrim's own
destination), 14 variants, 7 epilogue lines. Two gateway links, both
declared from the neighbor's side for a reason below: Pennywell's south
bank and the Shieldings' boundary hedge.

Shipped at 0% corridors for every class (blind and per-class both), after
the first pass came in at 26–35% per class — worse than any of the fifteen
holds, because a 31-room region has less room to absorb a bare cell than a
50-room one does. Fixed by giving every flagged cell either a free beat or a
second, unguarded action alongside its original class-gated one, per the
brief's "gate four ways or fill it for everyone." `audit-echo` caught two
names reused from elsewhere in the realm (an npc "Sella" already in
Ironholt, a "Ferry Chapel" already in Pennywell) — renamed to Marren and
the Broken Oar Chapel rather than left to collide. `audit-choices` caught
one genuinely dead flag (`lf_box_searched`, redundant with the item check
that already gated the same topic) — deleted rather than kept for show.

**The one thing the DSL didn't stop me from getting wrong**: a `gen`
region's `links[].back` field adds the return exit onto the *target* room,
but only if that room already exists — and `world.gen` expands in file
order, alphabetical by filename. Longford's own wilderness file sorts
before Pennywell's and the Shieldings', so a link declared from Longford's
side reaching into either neighbor silently dropped its own back-exit: no
error, just an unreachable region, because the neighbor's cell didn't exist
yet when Longford's link tried to write to it. The fix that shipped is
mechanical — declare the link from the later-sorting file instead, reaching
back into the one already expanded — but the silence is a real gap:
`worldgen.ts`'s own header promises "a world that cannot expand cannot
load," and this was a world that half-expanded and loaded anyway.
`expandRegion`'s back-link branch now throws by name when the target isn't
there yet (`test/worldgen.test.ts`, "a back link into a gen region
processed later throws instead of silently dropping the exit"), so the next
region whose name sorts early gets a pointed error instead of a validator
report three steps removed from the cause.

### Item 11: the act gate, and the budget that wouldn't move

Landed the DSL side and reverted the content side. Two new conds ship:
`["regions", cmp, n]` (the count of distinct regions among every room the
player has ever stood in — breadth, not any one place) and `["all", Cond[]]`
(an AND that can sit inside an `any` branch, which the surrounding if-array's
own implicit AND cannot reach). Both are tested directly against `condOk`
in `test/engine.test.ts`, independent of any specific gate. The gate itself —
`cp_pass`'s stair, changed from `hollows_rested>=3` to
`["all",[["var","hollows_rested",">=",3],["regions",">=",6]]]`, one more
region than any proof's natural path carries at that point — is not in this
commit. Here is why, measured rather than asserted, because the reasoning
cost most of a day and the next person to pick this up should not have to
re-spend it.

**The shape of the problem, confirmed.** Every proof that reaches the stair
does so having visited exactly 5 regions (`va,th,ir,sk,cp`) at hollows_rested
3, save `reach_bargained` (6, one extra hold on its own road) and
`reach_at_rest#devoted` (7, a deliberately wider road). Raising the bar to 6
regions is a real, working lever — the engine change is correct and the
gate change alone validates clean, breaking exactly the walkthrough and six
proofs that sat at 5, exactly as intended.

**Where it breaks, and why trimming the detour didn't fix it.** Fixing the
six meant walking each to a sixth region and back before the stair check.
The cheapest true round trip — live BFS over `legalActions`, not the
static, gate-blind graph `pathTo` uses — is 6 hops out to Fosterfell's gate
(`ff_east_road`) and 1 hop back by fast travel (`travel` excludes a
standing region's own landmarks from its list, so the outbound leg cannot
be shortened the same way). Every hold's gateway sets a flag that starts a
quest — surveyed all 18 reachable regions' `_entered`-gated quests, and
none is exempt — so the detour cannot avoid adding one live "Left undone"
line to every status screen from that point on. Measured the actual
`renderStatus` output at the stair (not estimated): one added quest line
costs 131 characters there — the stage text plus `" (this hold's grief): "`
and `" (in Fosterfell)"`, both shared formatting, already tuned once (the
comment on `format.ts`'s `way()` records that pass: "3,924 -> 3,713
average"). Cutting that stage text from 114 to 47 characters moved the
walkthrough's status average by 2 characters. The real cost is not the
line's length: `crawl`'s own per-turn trace shows every screen from
turn ~210 to the stair sits at 4,900-5,100 characters, nearly 1,300 over
the 3,650 ceiling on its own, so the 7 turns the detour adds there are not
neutral — each one is already the most expensive kind of turn in the game,
with or without a new quest line on it.

**Moving the detour earlier made it worse, not better, and that is the
real finding.** The same 4-hop round trip run right after leaving the Vale
(turn ~85, hl reachable from th_east_edge in 2 hops each way) lands on
screens costing 2,500-3,300 — a third of the late detour's cost per turn.
Status average still rose, from 3,703 to 3,757, because the traded cost is
duration: a quest started at turn 85 reads as "Left undone" on every
status call for the rest of a ~250-turn run, not the ~30 turns it would
cover started at the stair. Cheap-per-turn and short-lived pull the same
average in opposite directions, and late-and-short currently wins by a
smaller margin (52 characters over) than early-and-long loses by (107). Four
splice attempts, two insertion points, and a from-scratch perk-pick and
travel-pagination healer (`heal_perkpicks_v2.mjs` in scratch, not
committed — it detects an unscripted level-up moved earlier by the detour's
xp, reuses the original script's own later pick for the same level rather
than inventing one, and inserts the `toward <region>` step travel needs
once a second region makes its top menu group by region) all confirm the
same number: every version of "visit one more hold, anywhere, by any
route" costs 45-110 status-average characters, against a ratchet that had
6 characters of slack before this item touched it (3,644 measured against
a 3,650 ceiling, on the commit this item started from).

**What would actually close it, and why none of it belongs in this
change.** The status ratchet is "may only turn down" by design — trimming
existing prose to make room for new content is the intended mechanism, not
a workaround — but closing 45-110 characters of average needs roughly
450-1,100 raw characters trimmed somewhere (the observed transfer rate is
about one average-character per ten cut), which means several quest
stages across several holds, not two. `way()`'s own shared formatting
(`" (this hold's grief): "`, `" (in X)"`) is the one place a single cut
would move every journal line at once, and it is also the one place
already carrying a previous, deliberate optimization pass's comment
explaining exactly what it costs to touch — the wrong place for a change
motivated by one gate three files away. That trim is real, future work,
sized on its own terms; bundling it into an act-gate fix would hide a
budget-policy decision inside a content-routing one.

**Left in place**: `["regions", cmp, n]` and `["all", Cond[]]` in
`src/types.ts` / `src/engine.ts` / `src/validate.ts`, tested in
`test/engine.test.ts`. `cp_pass` still opens on `hollows_rested>=3` alone.
The next attempt at this item should start from a status-budget trim
sized to actually clear ~100 characters of average headroom — or from a
lever that does not cost a new "Left undone" line at all, if one can be
found — not from re-deriving the numbers above.

**One candidate lever, checked and ruled out (2026-09-15, later the same
day):** does every region's border have to cost a quest thread, or would
touching just the outermost wilderness cell — without walking on to the
region's own settlement — dodge it? Checked directly: it does not.
`ff_south_road` and `ff_east_road`, Fosterfell's two outermost border
rooms (literally named for the boundary — "The Bound-Stone," "The
Goat-Track's Foot"), each carry their own `onEnterOnce` setting
`ff_entered` and opening `ff_hollow`'s quest on the first step across,
before any settlement is in sight. There is no undefended edge to brush
past; the region-entry cost above is priced at the border itself, for
Fosterfell and (per the same survey, unre-checked here) presumably every
region alongside it. Doesn't change the verdict, saves the next reader
from checking the same thing.

### Item 12: the router, and the three doors that were never the objective

`pathTo` — the search behind a quest stage's `(the way there: ...)`, the one
thing `way()` in `format.ts` calls it for — now tries a currently-open route
first and only falls back to one that crosses a shut exit when no open route
exists at all. `bearingsHere` is untouched: it still uses the older,
gate-blind `walkFrom`, correctly, because a bearing answers "where is this
place", not "how do I get there right now", and crossing a locked door
doesn't move the barrow.

**The fix, and what it actually resolved.** `audit-routes.ts` now calls the
real `pathTo` instead of re-implementing a bearing-style search of its own,
so it measures what ships rather than a fixed baseline. Of the 80 routes
along the walkthrough that crossed a shut exit before the last leg, only 6
now resolve to an open alternative — not 80, because two of the three doors
`audit-routes.ts` named (`mg_old_crypts north`, `mg_chapel_of_ash down`) lead
to rooms whose only other entrances (`mg_hollow_throne`, `mg_cistern`) sit
*behind the same gate*, later in the same dungeon: a proper from-here search
correctly finds no way around, because narratively there isn't one yet. The
third (`va_barrow_field in`, into `va_antechamber`) has three other,
genuinely ungated entrances, but all three are themselves locked this early
in the Vale, so the same thing holds there too. The fix was never going to
make the crypts non-linear; what it does is stop lying about it.

**"Say which."** The remaining 74 are exactly the case a route search can't
solve by searching harder — no open way exists, so the door has to be
crossed — and `pathTo` now returns `{ text, blocked }` instead of a bare
string so `way()` can tell the player rather than stay silent about it: `(the
way there, shut: two south, then east)` in place of `(the way there: ...)`.
Checked against the status ratchet the way item 11 should have been checked
against sooner: the note is not free (104 occurrences along the
walkthrough), landed at 3,650.03 average on the first phrasing tried and
3,650.0 flat after trimming the added clause from ", past a shut door: " to
", shut: " — a targeted, bounded cost (one short clause, only on the routes
that actually cross something shut) rather than item 11's, which was a new
quest thread staying in "Left undone" for the rest of the game. The
difference is why this item closed in one session and the other didn't.

### The queue's last four P2s, and a correction to this document

Four of the seven P2s still open after this session's earlier passes,
closed or corrected on a fresh, live re-check of every number this
document had recorded against them.

**A correction first.** The "Four P2s about weighing an irreversible
choice" entry above left `c1c437de`/`748f4551` open on the strength of
`cp_south_stair` being "on 9 of 11 proofs that could be simulated
cleanly." Replayed against the current tree: **`cp_south_stair` is on 2 of
13 proofs.** The near-universal room approaching the Pass Gate is
`cp_spine_2_0`, "the Col" (`world/reach/cp_coldpass.json`, the `cp_spine`
gen grid, cell `[2,0]`) — every first approach to the gate crosses it, 10
of 13 proofs plus the walkthrough. The verdict the earlier entry reached
was right; the room it named was wrong. Left as a correction rather than
a silent edit, per this document's own habit.

**`c1c437de` and `748f4551`, fixed — and not at either room.** A room-based
warning was never the right shape: different roads approach the gate by
different doors (the Col for most, `cp_south_stair` for two), so any one
room's text reaches only the players who happen to walk through it. The
fix instead edits `quests.main`'s three Coldpass-opening stages
(`world/reach.json`), which `journalEvents` prints the turn the stage's
own condition — three hollows rested, the Regent's writ, or the Free
Companies' passage — first becomes true, wherever the player is standing,
and which `status` then carries for as long as that stage is current.
That is "when Coldpass first opens," literally, which satisfies
`c1c437de`; a player who reads it before ever nearing the gate has it
earlier than "the outer approach," which satisfies `748f4551` too.

    "Three hollows rested: the pilgrim stair at Coldpass opens for you.
    Highward's north road leaves from its record-house."          (118)
    -> "Three hollows rested: the pilgrim stair at Coldpass opens
    for you — crossing is final."                                  (86)

    "The Regent's writ is yours. Coldpass will let you through to
    Marrowgate."                                                    (72)
    -> "The Regent's writ is yours: Coldpass opens — crossing is
    final."                                                         (63)

    "The Free Companies will take you under the pass, by the
    Saltkerns caves."                                               (72)
    -> "The Free Companies take you under the pass — crossing is
    final."                                                         (63)

Each rewrite is shorter than what it replaces — the Highward pointer and
the Saltkerns caves name are the words that paid for it, on the same
"careful cutting" terms as item 8 — so every road's ratchet moved down or
held flat: `regent_deposed` 451.11 -> 451.07, `reach_burned` 450.37 ->
450.34, `gray_crown` 451.84 -> 451.81, `reach_at_rest#scout` 450.95 ->
450.92, `reach_at_rest#devoted` 461.53 -> 461.51. `748f4551` is the same
finding as `c1c437de` from the same report (`s9913`, `confusions[1]` and
`suggestions[2]`), so one fix closes both.

**`85e6fcd4`, fixed — this document under-scoped it.** "Genuine, broader
mechanisms... touching many topics rather than one room" was true of the
general ask and false of the report's own named case: Keeper Wren telling
the player "you've not reached Rowan yet" after the player had already
found and fully talked with Keeper Rowan at the Understory
(`world/reach/hb_hollowbrook.json`, topic `wren_covenant_pending`, which
checked only whether the specific errand was settled, never whether Rowan
had been met at all). The realm already has the convention this needed —
mutually-exclusive topic variants gated on what the player knows, the
same shape `lys`'s four "ask after her brother" topics and
`va_gray_priest`'s three blessing variants already use. Split into two:
the original text stays for a player who genuinely hasn't found Rowan
yet, gated additionally on `!flag said_th_rowan_greet`; a new topic,
`wren_covenant_pending_met`, covers a player who has, gated on that same
flag. No label a proof or the walkthrough presses (`"tell Wren"` appears
0 times in `world.walkthrough` or any `world.proofs` entry), so the fix
costs nothing on any ratchet. Re-file the general "recognizes an answer
learned anywhere" mechanism separately if it's still wanted — this closes
only the one topic that stated something false.

**`1c7364d4`, already resolved — moved to `done/`, not newly built.**
"Add a lightweight on-screen breadcrumb... following multi-hop NPC
directions through a wilderness area" reads as unmet, but `wildBearing`
(`src/engine.ts`, landed `c6a1665`, 2026-09-09) already prints a live
position line — "Black Thorn Stand: one west," updated fresh — on every
wilderness screen, walking real exits to the nearest landmark the player
has already stood in. The issue was filed against rev `e166432`, before
that commit. One honest caveat: `wildBearing` is the way *back* to a
known place, not a literal step-counter along a direction an NPC gave,
and it prints nothing where no anchor in the current grid has been
visited yet — the player's underlying need (confirm progress without
counting hops by hand) is met; the literal wording of the ask is not.

**`f5fa61c0`, re-measured, still open — so the next pass doesn't retry
it blind.** The cheapest possible form of this ask — one hud entry,
`{"var":"hollows_rested","label":" rested"}`, 8 characters, no
denominator — pushed onto `world.hud` and replayed live: **11 of 13
roads fail their ratchet**, and three break the hard 1,100-character cap
outright (`gray_crown` to 1,106, `reach_at_rest#warden` to 1,106,
`crowned_hollow#bloodied` to 1,304). This matches the entry above almost
exactly and sharpens it from argument to measurement: the header was
cleared of an always-present, rarely-changing number once already (the
running score, 2,328 characters along the walkthrough), and the cheapest
possible version of putting one back still costs more than every road but
two can pay. Left open. `3ddba1f3` and `5109e8d6` were re-checked against
the current tree on the same pass and neither's reasoning above moved.

### Four small defects, found running the realm's own tools

Not from a report — every audit script run cold against the current tree,
the same discipline that found `em_watch_castoff` earlier. Three came back
clean (`audit-abilities`, `audit-bearings` at 0% wrong, `audit-items` at 0
broken promises); `audit-choices` did not.

**Two dead flags, set and read by nothing, not even their own topic's
gating.** `em_heard_history` (Prior Wenlock's "the chapel that burned," in
`world/reach/em_emberfall.json`) and `ff_bell_keeper_bg` (Garth's "why
he's never pulled it," in `world/reach/ff_folk_b.json`) were each set by
exactly the topic that reveals them and checked by nothing anywhere in the
realm — visibility is already handled by `once: true`'s own auto-flag, so
the custom flag did nothing at all. Both topics stay; both dead `set`s are
gone. (Wenlock's suspicion — "I have never fully believed the wind was to
blame" — is in fact vindicated later, in the hold's own rested/bargained/
burned resolution text: a real hook a future pass could pay off on
purpose, not a defect this one fixes.)

**Two mistyped vars, silently opted out of a working mechanic.** Eleven
sites across the realm feed `or_warden_word`, a Warden-only tally read at
`>=2` by one of the class-flavor epilogue lines in `templates.json`
("gave the old watch's answer on the stairs and at the fires of the
Reach"). Two more sites — `world/reach/ff_folk_a.json`'s `ff_warden_writ`
and `world/reach/mc_folk_a.json`'s `mc_warden_osric` — incremented
`or_warden_ff_word` and `or_warden_mc_word` instead: real, gated,
class-specific content, correctly written and reachable, quietly opted
out of the tally it was supposed to feed by one character of
region-scoping that the other nine sites don't carry. Renamed to match.
Neither typo could have shown up in any budget check — this is what
`audit-choices` is for, and running it cold is what found it.

`npm run verify` green throughout; none of the four touches a label, a
proof step, or any rendered string a ratchet measures.

### A fresh wave, one player, and what ten new issues were actually worth

With the roadmap's own numbered list and the P1/P2 queue both largely
worked through this session, the next input the repo's own operations call
for is a new playtest, not more mechanical auditing — `loop/playtest.sh`
is exactly that step, and it hadn't run at all this session. One player,
seed 68938, a bounded 300-game-turn budget (half the wave default) rather
than a full wave: `verdict: stuck` (hit the turn cap, no ending), fun 5,
clarity 4, cost $10.55. Triage exploded it into 3 P1 bugs and 7 P2
suggestions/confusions restating the same three findings from different
angles. Investigated each against the checked-out tree and the player's
own recorded trace before acting on any of it — a single, uncorroborated
report is evidence to check, not a fact to implement.

**The Washed Ford's flavor text lied.** `world/reach/fd_fenmarch.json`'s
`fd_ford_detour` ("backtrack for the long way round") set a flag and said
"you cross dry" — but the room has one exit, `up`, back the way the
player came; nothing moves, nothing unlocks. Intentional design (the
same might/grace/free-fallback triad the Saltkerns use at three other
hazard crossings), but the free option was the only one of the three that
claimed a crossing while paying nothing and changing nothing. Fixed: the
line now says there is no other way and the ford wants paying. One
string, zero budget cost (off every proof and the walkthrough).

**The Three Verses could stay "active" after the choice that closed it.**
Real defect, not the one reported, but the shape underneath it. `va_verses`
(`world/reach/va_barrow.json`) had `start`/`done` but no `failed` — so a
player who returns the crown, breaks it, forsakes it, or kills the king
(four of the barrow's six resolutions; only speaking the verses sets
`va_verses_all`) left the quest with no way to ever close. `status` would
keep naming the sunken shrine and the old watchtower as the next step
forever, in a hold whose grief is already settled. Gave it the same
`failed` clause its sibling quests already use, matching an existing
pattern used by 34 quests realm-wide.

That fix cost more than expected: two quests (`va_barrow`'s own "Barrow
Doors" plus the newly-added "Three Verses") can close on the same turn,
and the shared `Quest closed: X — its asker's wish can no longer be met.`
event line, unchanged since it was written, pushed `gray_crown`'s worst
screen 1,097 -> 1,169. Rather than gate the fix or eat the overage,
trimmed the shared line itself — `src/engine.ts`'s `journalEvents`, the
one place a change moves every one of those 34 quests at once, the same
lever `way()`'s formatting was for item 12. `Quest closed: X.`, matching
`Quest done: X.`'s own terseness exactly; `status`'s free recap already
just says `Closed: X` with no explanation, so the one-time announcement
being equally plain is consistent, not a cut corner. `gray_crown` 1,169
-> 1,089, clear of the real 1,100 with margin. `test/realm.test.ts`'s
assertion on the old wording updated to match.

**The sunken shrine and old watchtower were never actually unreachable.**
Both rooms exist, both are ungated, the walkthrough itself stands in
both, and an earlier blind player (seed 191) found both in ordinary
play. What this player hit was one specific clue (the innkeeper's
rumors, the only one of four in-Vale sources that names the locations
without a direction) and then never returned to the notice board for its
second reading, which does give one. Cheapest real fix: the innkeeper's
line now says "east in the wood" — a net-**neutral** rewrite (209
characters before, 209 after), so it cost nothing on the eleven roads
that press it. Considered the fuller fix too — a `get your bearings`
action on Twin Stones, the wood's one busy junction with no wayfinding
of its own, matching the convention the Hearthlands already use on
nearly every wilderness cell — and reverted it: `crowned_hollow#bloodied`
walks a three-wolf hunt straight through that cell across four screens,
and the added menu line pushed its average 523.10 -> 525.32. That road's
`va_crypt` max is exempted by design (a fight screen, item 8's own
carve-out); its average is not, and the ratchet may only turn down.
Recorded rather than forced: a bearings pass across the Ashwood's other
fifteen cells is real, affordable-elsewhere work this session didn't do.

**The Fenmarch pacing finding doesn't survive its own trace.** Filed as
"a single hold (Fenmarch) alone consumed ~100 turns... the game's own
guidance (a 300-turn ceiling) makes the big ending unreachable in one
sitting." Replayed the player's own 301-turn trace room by room: Fenmarch
cost 92 turns, but the Vale — the tutorial hold — cost 137, already the
documented outlier from three earlier traces (`docs/roadmap.md`, "What
landed on 2026-09-09"). `audit-shape` puts Fenmarch below the 53-room
median on every count but items. There is no "300-turn ceiling" anywhere
in the current build (`world/reach.json`'s intro states no turn figure at
all); the wave gave this player 600 and they stopped at 301, `stop_reason:
end_turn`, not cut off. Five straight waves have won the full ending at
505-640 turns. Not fixed, because there is nothing here to fix: the
finding misattributes its own evidence, and the ask underneath it — some
cheap way to tell mid-run whether you're ahead of the arithmetic — is the
same design-level ask five earlier P2s already lost to the same budget
argument (`docs/roadmap.md`, "One real bug, and six P2s"). Filed to
`done/` with this reasoning rather than left to confuse a future pass.

Two P2s were left open above, "not checked this pass" — checked immediately
after, and they were real. `partyLeavesHint`'s own docstring already
recorded the design intent (wave six: "Regard is a number that goes back
up; a companion walking out is not, and the preview said the same kind of
thing about both") but the implementation only ever covered half of it:
`partyLeaves` scanned an action's own `fx` for an explicit `["party", id,
"leave"]`, which is what the Oath-Ground uses and what that wave-six fix
closed. It never checked whether a plain `addvar appr_vell` — no scripted
departure anywhere — would cross the companion's own `leaves` floor, the
thing `partyRemarks` checks automatically, every turn, for every
companion present, and acts on the moment it reads true. A regard drop
that happens to land exactly on that floor sent the companion off with no
warning at all, the label reading only "(Vell -2)" the same as any other
turn. That is the wave-ten report, precisely: "the status screen was the
only place this surfaced, and only when explicitly checked."

Fixed the same way the scripted half was: `partyLeaves` now also nets
every `appr_*` delta an effect list moves (reusing `regardMoves`, which
already follows the same `if`-branch logic) and checks each present
companion's own `leaves` conditions against that hypothetical total,
skipping anyone already past their floor regardless of this fx (that
departure has a different cause and does not need a second warning). No
die roll involved — a plain `addvar`'s result is a fact the instant the fx
is chosen, the same "not a guess about the roll" standard the docstring
already held itself to for the scripted case. `test/party.test.ts` gets
the sibling test the original was missing: a companion with a real
`leaves` floor and zero scripted departure, three cases (crosses it,
doesn't, already past it). Measured against all 13 roads and the
walkthrough: every number unchanged — nothing currently proven crosses an
implicit floor this way, so the fix is free today and only pays for
itself the next time content does. `npm run verify` green throughout.

### Four more quests with the same shape as `va_verses`, found by pattern

`va_verses`'s bug — `done` satisfied by only some of several
mutually-exclusive resolutions, no `failed` for the rest — was found by
accident, chasing a different report. Once it had a name, it was
checkable: every quest in the realm without a `failed` clause (106 of
140), asking for each whether the situation it tracks has a resolution
path that sets neither `done` nor anything else. Four real ones, all
reachable, none of them the report that started the search:

- **`rank_watch`** (`world/reach/ranks.json`) — swearing the first Reeve's
  oath at the stone (`wm_oathsworn`) forecloses the Watch's own
  commission outright; the Captain-General's reply is already written for
  it ("I won't put my seal on the first Reeve's. Wear the one you've
  got.") and sets nothing. `watch_sworn` could never follow.
- **`me_q_dams`** (`world/reach/me_folk.json`) — the Ironbound's own march
  (`iron_march_burn_me`, an automated `clock` event, not a player choice)
  can burn the Meres' hall without the player ever picking what happens
  to the dams. The quest already had a stage written for exactly this —
  *"The Hall's burning already answered the dams' question. Nothing left
  to decide there."* — the author saw the dead end and wrote around it
  instead of closing it.
- **`rank_iron`** (`world/reach/ranks.json`) — exposing, cornering,
  denouncing, or killing Aldous (Tamsin's companion arc; all four set
  `ir_aldous_gone`) removes him from the world before he can swear
  `iron_sworn`. A companion's own arc stranding an unrelated rank quest
  is the least obvious of the four.
- **`ir_hound`** (`world/reach/ir_irondowns.json`) — `done` was a bare
  `["npcDead", "ir_cave1_beast"]`, but the `cave` stamp's three
  non-lethal resolutions (slip past it, trace its spoor, feed it the
  carcass) all move the beast out of the world without killing it —
  `npcDead` can never become true. The exact same stamp shape at
  `kw_q_hounds` already has the right form, `["any", [["flag",
  "kw_hound_barrow_done"], ["npcDead", "kw_hound_barrow_wight"]]]`;
  `ir_hound` is the one quest in the realm that didn't accept its own
  stamp's `$done`, so it was fixed to match rather than invented fresh.

Three got a `failed` clause naming the foreclosing flag; `ir_hound` got
its `done` widened to the stamp's own convention. `test/realm.test.ts`
gets one test covering all four, forcing only the killer flags directly
(the reachability of each is a content fact already traced by hand
against the actual actions that set them, not re-proven by a route in the
test). Measured against all 13 roads and the walkthrough: no number
moved. What was **not** re-checked, and is worth a future pass: `var`/
reputation-threshold completions (`rank_church`, `rank_free`, `rank_crown`
all gate their only `done`-setter behind `rep_* >= 9`, unmodeled here),
class-exclusive completion paths, the undercity/palace act-3 quests
(width-only pass), and the five stamp templates besides `cave` and
`barrow` (`tower`, `mine`, `camp`, `chapel`, `hut`) — `ir_hound` was
exactly this class of bug, so the others are worth walking the same way.
`npm run verify` green throughout.

### The four unchecked areas, walked — one sixth quest, one template fix

Reputation-threshold completions, class-exclusive paths, and the act-3
undercity/palace quests: **nothing.** `rank_church`, `rank_free`,
`rank_crown` each gate their only `done`-setter behind `rep_* >= 9`, but
none of the three grantor npcs can die or leave, no flag ever hides the
offer, and no faction pool is tight enough to be floored below 9 by
anything the realm does (the tightest, `rep_crown`, has 66 positive sites
totalling +84; the mutual quarrel penalties between the three cost at
most 3). Class-gated completions are real in exactly one place
(`va_sortie`, warden-only) and that quest's own `start` is equally
warden-gated, so it simply never opens for the other three classes — not
a lock. The act-3 quests are sound by a stronger property than the others
checked so far: every action in `mg_hollow_throne` that resolves
`mg_throne_resolved` also ends the run, so there is no continued play in
which that journal entry could go stale.

The five remaining stamp templates: **one more real bug, one template
inconsistency that degrades without locking.**

- **`fd_q_bog`** (`world/reach/fd_hollow.json`) is the sixth instance of
  the pattern, on a `cave` stamp the first pass didn't reach. Earning
  either the Watch's or the Crown's trust — `rank_watch`'s own stage-1
  condition, a mainstream mid-game milestone — permanently stops the
  bog-thing from ever spawning again (the spawn roll itself is gated
  `!watch_trusted, !crown_trusted`), which is the only source of the hide
  the bounty needs. The in-fiction "or raid its den for proof" alternative
  doesn't save it either: that loot pays a *different* flag
  (`fd_bog_charm_paid`), and the quest's own stage 0 is written for
  exactly that gap — the author saw it and wrote around it, the same
  shape as `me_q_dams`'s dead-end stage. Given the same `failed` form as
  the others.
- **`tower`, `mine`, `camp`, `hut`** are all correctly built — every
  `done`-setter pairs with removing the tracked npc from the world in the
  same effect list, so a quest can never be told an npc is gone before
  the flag says so. `chapel` is the exception: `$rite` and `$read`, the
  two peaceful, class-neutral endings, both carried `["!flag",
  "calm_$saint_shade"]` — so an envoy who calms the shade (the one class
  that can) loses every non-lethal way to finish it, `$rite_named` being
  scholar-only. The `barrow` template's equivalent actions (`$read`,
  `$oath`, `$verse_lintel`) carry no such gate, which is what makes this
  read as an authoring slip rather than intent: calming an entity first
  and then formally ending its vigil is not a contradiction, and the
  fiction of both actions ("finally hears the end of its own vigil,"
  "does not kneel again") reads the same whether the shade fought first
  or not. Not a lock — `cp_q_shrine`, the one quest built on this
  template, still closes by killing what was just calmed, which is the
  worse outcome, not a stuck one. Fixed by deleting the gate from both
  actions, matching `barrow`; one change, all 14 chapel stamps at once.

`test/realm.test.ts`'s quest-lock test grows its fifth case. Measured
against all 13 roads and the walkthrough: no number moved. `npm run
verify` green throughout.

### `scholar_read` and `scout_hands`, unstarved

Two more class abilities close to dead, found the way `scout_ground` and
`envoy_press`'s odds-preview were: not from a report, from replaying the
traces this session's own playtest waves already paid for.
`scripts/audit-play.ts`, replaying both real blind sessions against the
world, showed `scholar_read` — the Scholar's "read it twice" — offered 0
times, pressed 0 times, across either run: "never once offered," the
tool's own label for a menu line a real player's trace never once put in
front of them. `scripts/audit-abilities.ts` then measured it exactly, on
the menu 13 of 2,038 scholar screens (0.6%), and the Scout's matching
ability, `scout_hands` ("steady your hands"), 2 of 271 (0.7%). The
Warden's `warden_set` and the Envoy's `envoy_press` — the same shape of
ability, a resource spent to force a check — stood at 10 of 481 (2.1%)
and 7 of 342 (2.0%) by the same measure.

All four gate on `checkHere <skill> 11`: a check of that skill at DC 11
or higher legally available in the room, right now. The gate was never
the problem — the DC was. A census of every `check` fx in the world by
skill and DC: wits runs 181 checks total, 16 of them (8.8%) at DC>=11,
the mode at DC9; grace runs 126, 9 (7.1%) at DC>=11, also DC9-dominant;
will runs 229, 95 (41.5%) at DC>=11; might runs 148, 32 (21.6%) at
DC>=11. The realm's own authored content asks wits and grace at DC 9-10
almost everywhere it asks them at all, and asks will and might
considerably harder — not a decision anyone made about these two
abilities, a fact about the other content they happened to be measured
against.

Both thresholds dropped one point, DC 11 to DC 10 — the smallest change
that closes the gap without touching the DSL, the fx, or either
ability's cost. Measured again: `scholar_read` 50 of 2,038 (2.5%),
`scout_hands` 10 of 271 (3.7%), both now the same order of magnitude as
`warden_set` and `envoy_press` rather than a fourth of it. Replayed
against the same two real traces: `scholar_read` now offered 3 times
(still pressed 0 — "offered and never taken" is a different, honest
outcome from never being shown the choice at all). Neither trace ever
ran a Scout, so `scout_hands` stays unexercised by these two specifically;
the proof-level measurement is what speaks for it.

An ability legally available on more screens is legally offered on more
screens, and the menu line costs width there. Looked for the money
first, the way fast travel's did — no repeated boilerplate to trim here,
since the added text is the option itself, not a redundant word inside
it. Four proven roads moved, all still clear of the real 1,100 max:
`reach_burned` 450.3 -> 451.2, `gray_crown` 451.8 -> 452.7,
`reach_at_rest#scout` 450.9 -> 452.5, `reach_at_rest#devoted` 461.5 ->
462.3 — the last two are the Scout and Scholar roads specifically, the
only two that carry a resourced companion of the matching class for the
whole route, so they were the two expected to move, and did. Recorded
in `test/budget.test.ts`'s ratchet table rather than hidden or worked
around: `PROOF_BUDGET` only ever moves down except when a change like
this one earns the exception honestly, the same standard fast travel's
three-road bump set.

`npm run verify` green throughout.

### What scales against a crowd

"The bar finally throws a punch" (above) left one line unfinished: **the
next combat change should be about what scales against a crowd, not about
what the abilities say.** Every companion standing with the player swings
on the player's own turn, but an aggressive npc's own blow only ever
rotated once, one-for-one among however many stood there — `npcStrike`,
unchanged since the day it was written. A full party multiplied what it
dealt by five and divided what it took by five: 48 of 72 hostiles killed a
solo player, 0 of 72 killed one carrying 2 or 4 companions, and
`warden_brace`/`warden_break` — which soften a blow aimed at the player —
were offered 24 times to blind players and pressed 0, because so little of
a fight ever reached the one target they help.

Fixed at the root `audit-fights.ts` named: the hostile now lands one extra
blow for every two companions standing (`strikesPerRound` in
`src/engine.ts`, `1 + Math.floor(standing / 2)`), still always fewer blows
than there are attackers, so a full party stays safer than fighting alone —
the reason to recruit at all, just not immune to it. Solo, the count is
unchanged (`1 + floor(0/2) = 1`), so every death and every
fight-abandonment path already proven at party size zero is untouched.
Measured again: 2 companions now cost 4hp median instead of 2, put 3 of the
72 fights' companions on the ground where none went down before, and kill
the player in 2 of 72 rather than 0; 4 companions stay comfortably safer
still (median 2 rounds, 2hp lost, 0 killed) — the damage a bigger crowd
draws is spread thinner across more standing targets in the short fights a
full party wins, not absent. A full party is not meant to feel like a solo
one, and does not; it is no longer meant to feel like nothing is in the
room, and now it doesn't always.

No proof or the walkthrough had ever swung an attack with more than one
companion standing to begin with — `crowned_hollow#bloodied`, the realm's
only fight proof, carries just Lys throughout, the same shape of gap
`ir_hound` and the rest were in quest logic, this time in combat. Proven
instead the way the single-companion rotation always was: two new cases in
`test/party.test.ts`, a `mini()` world with two and then four companions
standing, asserting the exact rotation (who gets hit, in what order, that
the shared counter keeps advancing round to round rather than resetting)
rather than just the count.

The realm's own content had already walked into this gap once, unproven:
`reach_at_rest#devoted` carries its full four-companion company past six
on-sight ambushes (two gray boars, a slag-hound, two cutpurses, the Old
Crypts' honour guard), and every one of them now lands three blows instead
of one — real content, immediately exercising the fix the day it landed.
It cost the road two struck-lines a screen on those six, 462.33 -> 464.04
average, and pushed the Old Crypts screen itself to 1,103, over the real
max. Looked for the money first: that room's own desc closed with "It
lunges at the first living step, at whoever stands nearest" — restating,
on the exact screen where the guard's on-sight strike had just landed
three times in the event log two lines above it, what the "(attacks on
sight)" tag already says once. The same "restating itself" shape item 8
found in `mg_hollow_throne`'s npc desc, which said what the engine's own
pierce warning already said on the same screen — cut, and it paid for the
whole of the max overage (1,103 -> back to 1,087 elsewhere) and, since
three other roads pass through the same room, shaved `reach_burned`,
`gray_crown` and `reach_at_rest#scout` too. Not enough on its own to cover
six screens' worth of new struck-lines on one road, so the rest —
462.33 -> 464.04 — is recorded in `test/budget.test.ts`'s ratchet rather
than chased into a trim that would cut something no screen restates.

`npm run verify` green throughout (329 tests).

### A correction: `audit-bearings.ts` had been checking almost nothing

Not from a report — a fresh sweep of every audit script, cold against the
current tree, the same discipline "not from a report" always means here.
This document has said, more than once, that `audit-bearings.ts` proves
"the generated `[\"bearings\"]` system 0% wrong (293 rooms, every leg
walked through real exits)". That sentence was true of its arithmetic and
false of what it implied: the tool's leg-extractor only ever recognized
`fx[0] === "say"` — literal text sitting in the JSON — and the engine
rewrite that introduced the computed `[\"bearings\"]` macro (see "the bar
finally throws a punch"'s neighbor, the turn-economy afternoon) moved 290
of 297 bearings actions onto it. Those 290 went dark the day it landed:
not wrong, just invisible, landing in neither the "legs" nor the "prose"
bucket the tool prints, so "0 wrong" was 0 of a denominator that was
effectively zero. Nobody checked the denominator before repeating the
number; this is that check.

Fixed at the tool, not the engine: `bearingsHere()` already has synthetic
unit coverage and the crawler already exercises it at the real 936-room
scale for crash-safety, so the missing piece was independent verification
of its *rendered text* against the real graph — the same claim the tool
always made about hand-authored prose, extended to the macro that replaced
most of it. Its output is a fixed, deterministic template (not free-form
prose), which makes this easier than the original job, not harder: a
second grammar, parsed and walked through raw exits exactly like the first,
sharing nothing with `bearingsHere`'s own internal BFS so a bug in that BFS
would still be caught rather than checked against itself.

Writing the second grammar found two real bugs — in the new check, not the
game. First pass: `legsOf` counts a repeated non-compass step ("two in") the
same as any compass one, but the new regex only allowed counted compass
legs or a bare single non-compass word, so every multi-step "in"/"out" leg
came back UNPARSEABLE — 45 of `kw`'s 90 legs alone. Second: Longford's ford
crossing uses a ninth exit word, "across" (`world/reach/lf_ford.json`,
`lf_longford.json`), never in this tool's `DIRS` list because nothing had
ever needed it named. Both are exactly the class of thing an untested new
check gets wrong on its first real data, which is what running it against
the whole world immediately rather than a sample was for.

Fixed both, and the real number: **868 legs walked across all 297 bearings
actions, 0 wrong.** That is the first time this project has actually
checked the generated system at scale rather than asserted it. What it
still cannot check: `bearingsHere`'s other half, naming an active quest's
own destination (`wanted` in the function), which needs a state with that
specific quest mid-stage — not built here, the same honestly-unmeasured gap
the old tool always had for prose. `docs/authoring.md` and
`docs/region-brief.md` carried the same "0% wrong" framing and a stale
room count; both corrected to the real numbers. The scattered mentions
across this document's own earlier, dated entries are left as they were
written — a record of what was believed then, not silently rewritten now.

`npm run verify` green (script-only change; nothing in `src/` or `world/`
moved).

### The rest of a fresh audit sweep: two non-findings, one tool blind spot, one dead flag

The same cold sweep of every `scripts/audit-*.ts` that found the bearings
gap above also surfaced smaller leads. Worked through in order:

**The one echo `audit-echo.ts` still flags, and the region that reuses
three names, are both intentional.** The Vale epilogue's two barrow-doors
lines ("...the barrow doors stay shut, as you promised..." /
"...as you chose...") score 0.60 similar because they are the same
outcome — `va_king_rested` + `va_sealed` — reached two ways, distinguished
by whether `va_promised_seal` was set beforehand; the differing clause is
the whole point, not an accident. Fosterfell and Mootcombe each have their
own "The Chantry", "The Recorder's Loft" and "The Tally-House" (`ff_chantry`
etc., `mc_chantry` etc.) with entirely distinct desks, keepers and reveals
underneath the shared labels — checked every in-fiction reference to any
of the three names realm-wide (`ff_hollow.json`, `mc_hollow.json`,
`sh_hollow.json` each reference only their own region's copy; a stray
`hb_hollowbrook.json` line about "the chantry out past the damp hollow" is
unplaced flavor, not a pointer to either), and none crosses regions. Twin
market towns, not copy-paste.

**`audit-choices.ts`'s "forgotten fork" list undercounts real payoffs by
design, and it is worth knowing why.** The tool calls a flag forgotten
when nothing outside the npc or room that set it ever reads it back — which
is the right bar for *this* project's five-P2 wayfinding sweep and the
`em_heard_history`/`ff_bell_keeper_bg` dead-flag cleanup above, both about
flags nothing read at all. It is the wrong bar for "did this ever get a
payoff", because a same-npc follow-up topic is a completely legitimate
payoff and the tool cannot see it: `em_heard_history` itself, given exactly
that shape of fix (`em_wenlock_vindicated`, above), still reads "0 reads
outside" today and always will. Pennywell and Mootcombe's fourteen flagged
forks turned out to be fourteen instances of this, checked one at a time
by hand against the actual topic text and its npc's own
`react_hollow_rested/bargained/burned` reaction:

- Ten (`pw_warden_bg`, `pw_smelter_bg`, `pw_tithe_bg`, `pw_assayer_bg`,
  `pw_descendant_bg`, `mc_hedda_bg`, `mc_rendel_bg`, `mc_aldith_bg`,
  `mc_ingrith_bg`, `mc_oswin_bg`) are backstory an npc states once, and
  every one of their region's holds already closes the loop in an
  unconditional reaction line — Sarel's "I won't be the one who strikes a
  lie with his work" (`pw_folk_b.json:311`) is answered, word for word, by
  her own "Hann's own die, struck true at last, by someone who wasn't
  lying with it" the day the hold rests (`:382`). Ten for ten, the
  callback was already there. Left alone.
- Two (`pw_knows_sh_debt`, `or_warden_pw_cold`) already have a real,
  distinct same-npc payoff topic gated on the flag plus an external
  condition — structurally identical to `em_wenlock_vindicated`, just
  invisible to the tool for the reason above. Nothing to fix.
- One (`mc_nell_closure`) was the exact dead-flag shape from "four small
  defects" (above): a topic gated and marked by its own custom flag that
  `once: true` was already handling by itself. Removed, text and topic
  untouched — the fifteenth instance of a pattern this project has now
  found and fixed three separate times.
- One (`mc_trays_searched`) is a wits-gated loot pull with a mood line,
  using its own flag instead of `once: true` on purpose so a *failed*
  attempt can be retried. It only reads as a "fork" because the room's
  other action doesn't share the flag — a side effect of how the tool
  counts branches, not a narrative choice with nothing at the other end.
  Nothing to pay off; it is a keepsake, the same carve-out the tool's own
  docstring already grants one.

Zero of fourteen were an authoring gap. `npm run verify` green throughout
(329 tests).

**One more from the same sweep, the other kind of name reuse.** Of the
realm's 14 `tower` stamps, 13 give `WATCHER` its own role tied to what
that specific tower was for — "a bell-ringer's shade", "a toll-keeper's
shade", "the shade of a hanged tallyman", and so on. `mc_beacon` and
`sh_beacon` both used "a beacon-keeper's shade" verbatim — the one exact
duplicate among fourteen otherwise-distinct lines, and unlike the
Chantry/Recorder's-Loft/Tally-House case (above), nothing else about
these two towers is shared: different `NAME`, `VIEW`, `SIGN` and `LOOT`
throughout, just this one field left uncustomized. `sh_beacon`'s is now
"a levy-caller's shade", matching what "the Levies' Beacon" and the
cavalry gear already scattered around it (`sh_wild.json`) are about.
`npm run verify` green (no proven road passes through either tower).

**Last item from the same report, and it needed no change at all.**
`scripts/audit-shape.ts --rites` still names three holds "plain" —
Hearthlands, Irondowns, Skerrow — and the tool's own docstring already
warns exactly why that can be misleading: a witness or a trade recorded
as an ordinary flag reads identically to no rite at all, and an earlier
attempt to auto-detect trades this way was reverted on purpose after it
started calling an incidental standing cost a trade too. Read the three
gates by hand rather than trust the column, the way the docstring asks:
`hl_rest_hollow` needs `hl_due_paid` *and* `hl_order_known` — a trade
and a name, gated on flags the seven-rites work already set (`Seven
rites`, above, was never wrong; the tool just can't see through a flag
to what set it). `ir_hundred_rest` needs `tamsin_mine_truth` — a
companion's own arc, not the original collection mechanic at all; Irondowns
and Skerrow were never among the seven holds that shared it. `sk_rest_fleet`
needs `sk_verse_known` *and* `sk_lighthouse_lit` — a name and an act left
undone (a dark lighthouse, relit). Three distinct, already-real rites,
zero of them boring, all three invisible to `--rites` for the reason its
own comment names. Nothing to fix in the world; nothing to fix in the
tool either — it was tried once and correctly reverted. Closes the audit
sweep this document has been working through since the bearings fix.

### The same shape, one step earlier: a quest that never starts

Every quest this session had fixed so far shared one shape: `done`
satisfied by only some of several ways a situation resolves, no `failed`
for the rest, so the quest sits "active" forever. `journal()` checks
`start` before any of that (`src/engine.ts` — a quest whose `start` never
passes never shows, not active, not done, not failed, regardless of what
its `done`/`failed` later become). That is a *second*, worse-shaped
version of the same bug: not stuck open, gone before it ever opened.

`th_q_cal` ("Cal's Reckoning", `world/reach/th_thornwold.json`) started on
`lys_brother_found` — set in exactly one place, Cal's own `greet` topic at
the scout line. `th_burn` (gated only on carrying pitch-oil, nothing
Cal-related) can resolve his fate first: `th_cal_dead`,
`lys_brother_lost` or `_buried`, `npcgo th_cal null`, all with no
dependency on ever having met him. A player who buys the oil and burns
Thornwold's hollow before finding the scout line — a wholly separate
branch of the room graph, no shared prerequisite — gets Cal killed with
`lys_brother_found` never set, and `th_q_cal` never starts. Not stuck:
absent. Its own `failed` clause (`th_cal_dead`) and two stages of
ready-written text for exactly this outcome (`lys_brother_buried` at
line 3282, `lys_brother_lost` at 3286) sat there, permanently unreachable
through this quest, for as long as the quest has existed.

What kept this from being a total blackout: `q_lys` ("A Brother in the
Company," `world/reach/companions.json`), the overarching companion-arc
quest, starts on `lys_joined` alone and already lists every one of Cal's
outcomes correctly across its own `done`/`failed`. `th_q_cal` is a second,
Thornwold-local quest layered on top of it (it adds room directions via
`at`), and it is specifically that duplicate whose gate was too narrow —
a player burning first would still see Cal's fate through `q_lys`, just
lose the local one.

Fixed the same way the six `done`-side cases were: widened, not
rewritten. `start` is now `["any", [["flag", "lys_brother_found"],
["flag", "th_cal_dead"]]]` — the same flag `failed` already reads, so the
quest becomes visible the instant its failure condition would apply.
`done`, `failed` and every stage are untouched; they already covered
every outcome correctly, they just never got the chance to run.
`test/realm.test.ts` gets a dedicated case (distinct from the six-quest
one above — that test is about quests that show and never close, this one
about a quest that never showed at all) forcing the burn-first state
directly and confirming `failed`, plus a sanity check that meeting Cal
first and the not-yet-resolved case both still read exactly as before.
Neither the walkthrough nor any of the 13 proofs visits Thornwold in this
order, so no number moved.

Found by the same discipline as the first six, aimed one level earlier:
not from a report, a `start`-side pattern search across all 140 quests'
`start` conditions, checked by hand against the actual actions that set
each relevant flag rather than asserted from the shape of the JSON alone.
About twenty more quests start on a `said_<npc>_greet`-style flag and
share the *shape* of risk (an npc who could resolve or leave before ever
being greeted) without yet being individually traced; left open rather
than claimed clean, the same honest incompleteness the six-quest sweep
above already models. `npm run verify` green (330 tests).

### The twenty, traced — sixteen real, eight clean, one already fixed

The full sweep. Every quest realm-wide (24, not twenty) whose `start`
depends on a `said_<npc>_greet`-style flag, checked by hand: for each one,
every place anywhere in `world/reach/` that sets a flag its own
`done`/`failed` reads, and whether reaching it requires greeting the npc
first. Two sub-shapes turned up:

- **the th_q_cal shape** — the situation resolves through a wholly
  different room, npc, clock, companion arc, or class action; a player
  could finish the realm never having a reason to visit this npc at all.
- **a narrower sibling** — the *same* npc has a later topic in their own
  menu that does not itself require the greet-chain flag, so picking it
  first (out of the normal order) triggers the same gap without avoiding
  the npc at all, just the "who are you" topic specifically.

Sixteen real gaps, both shapes, ten files:

- `ir_hound` — separate from that quest's already-fixed `done`-side bug
  (above): the cave stamp's non-lethal resolutions still needed
  `said_ir_ness_greet` on the *start* side, and the Irondowns wild grid has
  two entrances that never pass through Ness's own room at all.
- `hb_q_ledger`, `hb_q_mound_robber` — a chest forceable on sight and a
  robber fought or bribed outright, neither gated on greeting anyone;
  `hb_q_ledger` doubly so, since `iron_march_burn_hb` is a clock entry
  that fires from elapsed turns with no player action at all.
- `lf_q_nye`, `mg_q_third_bell`, `sk_q_nets`, `wm_q_writ`, `fl_q_muster`,
  `fl_q_stakes`, `ir_hobs_pick`, `me_q_saint`, `me_q_ledger` — each a
  variant of the same shape: a toll paid, a chapel rite spoken, nets sold
  to a *different* npc entirely, a writ grantable from two other regions
  (Cinderhall on any hollow burned, Marrowgate on Crown trust — neither
  mentions Wardmoor), a Warden's own class order, a scholar's own reading
  of a shrine or a ledger — all reachable without the greet topic.
- `rank_watch`, `rank_iron` — the narrow-start half of the exact two rank
  quests the earlier done-side sweep gave a `failed` clause to
  (`e1d823d`); that pass widened `done`/`failed` and left `start` exactly
  as narrow as `th_q_cal`'s was.
- `rank_church`, `rank_free` — the sibling narrower shape: each npc's own
  "swear me in" topic already reads the real threshold (`rep_* >= 9`) and
  nothing else, so a player who reached that standing elsewhere and opens
  the conversation fresh can pick it as their first topic.

Every fix is the same one line, widening `start` to an `any` of the
existing greet-flag plus whatever `done`/`failed` already read — nothing
else touched, because in every one of the sixteen `done`/`failed` and
every stage were already correct; they just never got the chance to run.
This shape of fix is asymmetric-safe by construction: the added flags only
ever become true through the content that already legitimately sets them,
so widening `start` can make a quest visible when it should be and cannot
make one visible when it should not be. `test/realm.test.ts` gets one
combined case forcing each foreclosing flag alone, greet-flag deliberately
unset, checked against all sixteen; `rank_church`'s own remaining
threshold is checked separately to confirm the widening didn't loosen it.

Eight checked clean: `cp_q_envoy`, `cp_q_bray`, `hb_q_surveyor`,
`hl_q_widow`, `ir_wenna`, `lf_q_aldric`, `rank_keepers` all have exactly
one setter for their relevant flag, and it requires the greet-chain
directly — no competing path exists. The last, `mg_q_rites_night`, was
already correctly written this way (`start` already an `any` of the
watch's own auto-set flag and the novice's greet flag) — a real, live
example in the shipped realm that the fix pattern itself is sound, found
rather than assumed.

Measured against all 13 roads and the walkthrough: no number moved; none
of the sixteen orderings sits on a proven path. `npm run verify` green
(331 tests).

**The lead that closed the vein.** `world/reach/ir_irondowns.json` carries
the realm's only `clock` entries (16, all of them — no other file defines
any), one silent auto-burn per hold, 40 turns apart starting at 60. Two of
the twenty-two fixes above were this clock's doing (`hb_q_ledger`;
`me_q_dams`, from the earlier done-side wave, not the sixteen). Checked
whether it was owed a third: every quest gating `start` on a hollow flag
fires on an unconditional room-entry trigger the clock never touches;
every `done`/`failed` that reads one already reads the umbrella
`_done`/`_resolved` flag or names `_burned` explicitly, the clock's
own vocabulary is `set`/`addvar`/`say` only — never `npcgo`, never a room
or exit edit — so it cannot itself delete access to anything. One
quest that looked like a candidate at a glance, `mc_q_order`, traced
clean: its prerequisites come from ordinary village dialogue with no gate
on the hollow's state at all. One genuine but minor loose end, not this
shape of bug: four holds' own "grief npc" (`wm_oath_captain`,
`me_maren`, `hb_eldest_king`/`hb_grave_wight`, `sk_admiral`) stays put and
fully talkable after a silent auto-burn, where a player-driven resolution
would have moved them on — narrative continuity, not a dead end, since
nothing reads their presence in a `done`/`failed`. Nothing to fix. The
march clock is checked and clean.

### A fresh wave against all of today's changes, and six P1s that all check out clean

Two blind players, seeds 84497 and 84498, first real play since today's
DC-threshold, combat-scaling and twenty-two quest-logic fixes landed.
Both won, both rated fun 5 and clarity 4, both reports verified against
their own trace. `src/triage.ts` promotes every reported bug to P1
regardless of the player's own rating — all six the wave filed as bugs
were self-rated P2, worth knowing before reading "six P1s" as six severe
findings. All six checked against the real trace (`runs/g1-84497-*.json`,
`runs/g1-84498-*.json`) and the live code, not just the report text.
**All six are not bugs**, filed to `done/` with the finding rather than
a fix:

- **Skiff-drag DC "escalating to 22 with no warning"** — the report's own
  numbers were wrong (actual DC 14, not 10); the cap **was** previewed
  ("raised 1 by failed tries, and stops at 22") before the player's 2nd
  and 3rd press; the escalation is `checkSourceId`'s documented, deliberate
  design for room actions ("a lock does get harder as you work at it"),
  narrower in scope than the one DC-creep bug already fixed this project's
  history (that one was `tp:` conversation checks compounding with a
  double regard cost — a different mechanism this never touched); and the
  skiff was never gating anything the player needed.
- **"Never found a path to Iron Downs after 25 turns"** — the route
  (`th_settlement`'s unconditional "north" exit) was offered to this exact
  player twice and declined both times in favor of a dead-end side-wood.
  The *other* player in the same wave saw the identical option and took
  it, reaching Iron Downs without incident. Report vs. trace, cleanly.
- **"Bearings sometimes don't match the room graph, Iron Downs/Barrowmere"**
  — all three mechanisms it could mean, checked: `bearingsHere` (868/868,
  unchanged from the fix above), the wilderness header line `wildBearing`
  (not covered by `audit-bearings.ts` — a fresh, equivalent sweep across
  all 461 gen cells realm-wide found 0 of 377 checkable renders wrong),
  and hand-authored NPC hints (the report's own two cited examples, both
  walked by hand against the live graph: correct, to the room). Nothing
  wrong found anywhere the report could have meant.
- **"Collected lore items with no action to consume them"** — every cited
  item traced to a real payoff already in code: two evidence flags read
  by a "settle on the name" action this same player used; a takeable item
  this same player explicitly declined (a theft warning shown four times);
  a two-part pickup (cipher notes plus a still-unfound second item) working
  as designed, just not completed in this run.
- **"Ambiguous 'costs standing, hit or miss' phrasing"** — centrally
  generated (`costsStandingHint`, not hand-typed per room), worded that
  way on purpose per its own code comment specifically to prevent this
  exact misreading, and shown correctly alongside "a hit costs" and
  "a miss costs" variants on the very same menu the trace captured.
- **"Den/lair rooms feel copy-pasted"** — the `cave` template, seven
  instances, exactly the same shared-structure tradeoff already accepted
  for barrow/tower/camp/chapel; every instance-specific field checked by
  hand and found distinct (unlike the beacon-keeper case above, which
  *was* a real verbatim duplicate and got fixed).

One claim surfaced and retracted in the same pass: investigating the
bearings finding turned up a hand-authored hint (the eel-trader's bog-thing
bounty, `world/reach/fd_fenmarch.json`) that looked wrong on a first
programmatic check. Re-walked directly through the real engine —
`newState` → clear class-pick → teleport to `fd_settlement` → legal-action
lookups for `out`, `south`, `west` (not hand-built action objects, which is
exactly where the first check went wrong: skipping class-pick leaves every
`go` illegal and the room never moves, which reads as "broken" if the
silent no-op isn't noticed) — and it lands exactly on "The Eel-Run," name
and all. Correct. Not filed; the retraction is the record.

No code or content changed this section — six queue files moved to
`done/`, nothing else; no verify needed.

### The fresh wave's P2 backlog: eleven asked, eight already true, four left open

The eleven P2s the same wave filed alongside its six P1s, plus one older
ticket revisited for a reason below, went to two independent
investigations — each checked every claim against `runs/g1-84497-mu2svd0q.json`
/ `runs/g1-84498-mu2svd7s.json` and live code rather than trusting report
text, the same discipline as the P1 pass above. I spot-checked the
load-bearing claims in both reports against the source directly before
writing any of this down.

**Iron Downs, the sequel.** `1423c536` ("no signposted route... despite
two companion quests pointing there") and `b3db44ea` ("surface a route
hint earlier") are the same report (`s84498`) as the already-closed
`done/P1-issue-4929c06b.json` — three triage units off one paragraph, not
three signals. Both companion quests are fully wired, not dialogue-only:
`wm_q_ring` ("Aldric's Ring", `world/reach/wm_wardmoor.json:1884`) and
`q_tamsin` ("What the Mine Took", `world/reach/companions.json:5318`) both
carry an `at` of `ir_company_store`/`ir_south_track`, and `q_tamsin`'s own
hand-written hint already says "find Cinderhall in the Iron Downs, past
Thornwold — before Coldpass." The reason neither prints a walked route
while the player stands in Thornwold is `way()` (`src/format.ts:364-376`):
it deliberately prints only a region name, never a walked path, once a
quest's target region differs from the player's own — a fix for a real,
cited problem (a nine-leg cross-region walk once ate 234 characters on a
status line) — and `bearingsHere` draws the identical line. Not a bug; a
documented, deliberate scope cut that both these tickets are, in effect,
asking to re-open. Both of Iron Downs' unconditional entrances
(`th_settlement`→north→`th_north_track`→north→`ir_south_track`, confirmed
ungated at `world/reach/th_thornwold.json:48-58`; `wm_west_road`→west→
`ir_east_road`) already carry the realm's standard "place lies/waits
<direction>" desc convention one room short of the junction. Replayed
`s84498` directly: `th_settlement`'s "go north" was on the menu at turns
188 and 220; the player chose the dead-end wood both times and never
returned a third time to take it. The other player in the same wave,
offered the identical menu, circled back on their third visit and reached
Iron Downs three turns later — exploration variance, not a broken sign.
Non-findings; both moved to `done/`.

**The direction-hint sweep.** `775bfe01` ("two stands west, then one
north" not matching real links) names Captain Vane's Rope Larder hint
(`world/reach/th_thornwold.json:1651-1657`); walked by hand against the
live graph (`th_settlement`→west→`th_wood_4_2`→west→`th_wood_3_2`, "Fox
Crossing"→north→`th_wood_3_1`, "The Rope Larder") — exact match, and the
`s84497` trace shows the player walking exactly that path and arriving,
turns 244-247. The check went past the ticket's own example: every
hand-authored multi-step direction line in the `s84497` trace (five, not
one — innkeep→Lys, Sergeant Coe→Cal, Vane→Rope Larder, Ness→Flooded
Quarry, eel-trader→the Eel-Run) checked correct by hand against the room
graph, zero illegal actions anywhere in 601 turns. `804a253a` ("not
obvious that 'travel to' and compass directions cover different graphs")
is already answered, verbatim, by an existing one-time tutorial line
(`src/engine.ts:3384-3386`) that fires the instant fast travel first
becomes available — turn 3 in `s84497`'s own trace, before the player
could have been confused. Non-findings; both moved to `done/` alongside
`775bfe01`.

**Evidence items, re-checked.** `29c6dca3` asks for an in-fiction hint on
when collected evidence gets used. `scripts/audit-items.ts` — the house
tool built for exactly this question — reports 327 items, 238 read by
something, 89 correctly-signaled keepsakes, 0 broken promises, 0 mute,
right now. The ticket's own three named examples (curling survey map, the
causeway-stone/mere's-answer pair, cipher notes) each check out
individually: the map is an honest keepsake nothing reads; the causeway
evidence isn't even an item, it's a flag set and consumed in the same
action that finds it; the cipher notes are read
(`world/reach/companions.json:4793-4796`) and their hint already says a
second piece is needed without overclaiming where. Moved to `done/`.

**The skiff-drag ceiling, once more.** `ca46b6d4` asks for a friendlier DC
ceiling or an earlier warning on escalating retries — the same room, same
player (`s84498`), as the already-closed `done/P1-issue-02610d63.json`.
Lowering the ceiling was rejected outright: `escalatedDc`'s natural-20
floor (`src/engine.ts:1207-1231`) is a documented, deliberate design
constant. The "warn earlier" half traced clean against `s84498`'s own
turns 403-406: the ceiling preview (`"raised N by failed tries, and stops
at {ceiling}"`, `src/engine.ts:3005-3007`) showed on both the 2nd and 3rd
of the player's three presses, before they walked away at 35% odds rather
than trying a fourth time — the warning this ticket asks for was already
shown to this exact player twice. Extending the preview to a check's
first, unfailed offering (currently gated `tries > 0` on purpose, per its
own code comment, from an earlier playtest fix) would be a system-wide
change to every escalating check in the realm, not a minimal one, and one
player seeing the warning twice and quitting anyway isn't evidence that
showing it once earlier would have changed anything. Moved to `done/`.

**Hollow Path, read start to finish.** `47755605`/`80205b5a` claim the
Vale wood's "east" exit doesn't lead where its desc says. Read the full
chain by hand: Hollow Path's desc names the drowned shrine and watchtower
as visible "through a gap in the trees" — a horizon view, not a promise
about the next room — and Wolf Scrape (the real east neighbor, one hop)
and Tower Shadow (two hops) both keep describing the same landmarks as
still further on, honestly, until Tower Shadow's own exits resolve the
fork (east to the watchtower, south to the shrine). Every room in the
chain agrees with the next; nothing here is inconsistent, and the
grid-computed adjacency underneath it is the same kind the fuller
`audit-bearings.ts` sweep already verified elsewhere in the realm.
Non-finding; moved to `done/`.

**Four left open, on the standing evidence bar.** `d2780f5c`'s "hints
don't match" half is the same false premise as the sweep above; its other
half — auto-offering a multi-step "travel to" for a landmark only heard
named, never visited — is a real, distinct idea, deliberately foreclosed
today by `knownLandmarks`/`travelAvailable`'s strict `s.visited` gate
(`src/engine.ts:892-1007`), and single-report. `be79b069` and `fc1a4039`
are two framings of one ask from one report (`s84498` again: a numeric
turn-cost estimate before an irreversible crossing) — no "turns to
resolve a quest" concept exists anywhere in the engine (`way()`/`pathTo`
only ever solved travel *distance*, a different problem), and the
cheapest measurable stand-in (a bare open-quest count on `status`) is free
against the walkthrough ratchet but doesn't actually answer either
ticket's question, so it wasn't shipped. `3ddba1f3` (the older,
independently-sourced compass/waypoint-note ticket, seed 717) was
re-checked directly against the post-router-work tree rather than trusted
from its last triage: `bearingsHere` still only ever outputs walked legs,
never a compass bearing, unchanged by anything landed this session. All
four stay in `queue/`, open, on the same "genuine, single-report, nothing
built yet" bar as `f5fa61c0`/`5109e8d6` below — not superseded, not
forgotten.

`P2-issue-5109e8d6` and `P2-issue-f5fa61c0` were checked for new
corroboration from this wave and found none — nothing this wave filed
touches either's topic (a missable one-time-offer flag, a HUD
hollow-count). Left exactly as they were; not re-investigated.

No code or content changed this section — eight queue files moved to
`done/`, four fresh P2s plus one older one confirmed and left open in
`queue/`, nothing else; no verify needed.

### Item 8's residual, measured again: one real duplicate, the rest confirmed as stacking

Went back to the one piece of item 8 left "measured, unfixed, and not
asserted anywhere" — `mg_hollow_throne`'s first-visit entry screen, forced
to the same maxed state (`test/budget.test.ts`) as the "weigh the doors"
action already guards. Re-measuring by hand first, rather than trusting the
1,344 this document had recorded: with no companion and the guard-flanked
line withheld, the same state now renders 1,300, not 1,344 — close enough
to be the same finding, not close enough to assert from memory, so this
pass's own number replaces the old one rather than repeating it.

Went through the five converging pieces the earlier note named looking for
an actual duplicate, the way item 8's other four cuts were duplicates, not
just short things that could theoretically be shorter. Four hold up: the
`onEnterOnce` dialogue is the Regent's first appearance, the desc sets the
room nothing else does, her npc desc plants the ledger/burn imagery both
resolution roads pay off, and the two item hints (the founding ledger's,
the iron crown's) are the same shared strings every other room shows them
with — cutting any of those here would either lose the only place that says
it or inconsistently shorten an item's hint everywhere it appears, neither
of which is what item 8's cuts did. This screen's size is what the original
note called it: content stacking, not redundancy, and that verdict stands.

The fifth piece wasn't clean, though. The quest stage that opens the moment
`mg_at_throne` is set read "What you do with the seat is the end of it" —
and the engine's own generic end-of-room warning, one line above it on the
same screen, already says "An ending waits in this room. What you have left
undone elsewhere stays undone." Two mechanisms, the room's voice and the
engine's, independently telling the player the same fact. Trimmed the quest
line to "Choosing here is final" (`world/reach/mg_marrowgate.json`, quest
`mg_throne`) — short enough to drop the restatement, specific enough to
keep the one thing the engine's line doesn't say, that the choice itself
is what can't be undone, not merely that the room contains an ending.
1,300 -> 1,280 with no companion; 1,575 -> 1,555 in the full forced state
(party + flanked) the existing test already builds. The forced-state test
itself carried a small measurement bug fixed in the same pass: it never
pre-set `iron_march`, so forcing `hollows_burned` to 3 directly (rather
than reaching it through play) made the Ironbound clock fire its one-time
announcement on this exact step — a scene no real player would ever see
stacked here, since in genuine play that clock fires turns earlier, the
first time `hollows_burned` reaches 1. Pre-set now, with a comment saying
why; the 1,575/1,555 figures above are measured with that fixed.

Still 1,555 against the real 1,100 ceiling on the maxed-party path — this
was never going to close from one line — so the entry screen is asserted
now (it was "deliberately not asserted on" before) against a new named
allowance, `THRONE_ENTRY_MAX = 1555`, the same shape as a `PROOF_BUDGET`
entry: above the true ceiling, on the record, ratchets down only. Better
than leaving a known 1,555-character screen to `crawl --worst`'s own blind
spot (the room is `noTravel`, gated behind the whole Marrowgate admission
chain — a random walk that reaches it at all renders whatever flags it
happens to be carrying, never the maximum) where it would stay invisible
until a proof happened to hit it by accident.

`npm run verify` green: 331 tests, all three worlds still validate (reach's
walkthrough still wins at 240 turns, untouched by a one-line quest-text
edit), both crawls clean, 0 over-cap menus. `budget.ts`'s own walkthrough
average moved 439.53 -> 439.45, a small real improvement from the same
edit landing on the walkthrough's own path through the stage, separate
from the forced-state numbers above.

### A fresh audit-echo/audit-choices pass against today's whole batch

Neither tool had run since today's twenty-two quest-logic fixes, the DC and
combat-scaling changes, or the bearings-macro fix — all real edits across
many files, any one of which could in principle have introduced a new
duplicate sentence or a newly-dead flag. Ran both fresh rather than assume.

`audit-echo.ts`: 7 echoes at or above its own 0.5 threshold, out of 3,801
authored lines, all epilogue/room-desc pairs that are parallel writing by
design (the same sentence shape for two different companions, two variants
of one room's desc before/after a later event) — the same character the
tool already reports as expected, not new. The room/npc-name-reuse list (11
room names, 1 npc name) is entirely generic functional names — "The Trade
Counter," "The South Track," "barrow-wight" — the tool's own distinction
("a road name may be fine; a distinctive one is not") already covers these;
none read as a name collision the way the beacon-keeper case earlier this
session did. Nothing new.

`audit-choices.ts`: the forgotten-fork list is unchanged in kind from the
tool's own documented limitation (same-container reads don't count — see
`em_heard_history` above), and the new "standings and tallies" section it
also prints — reputation and approval vars that keep accumulating past the
highest threshold anything reads — is a reputation-system property, not a
defect; nothing reads it as a bug signal and the tool doesn't flag it as
one. "No option in the realm closes its own door on a miss" still holds.

No code or content changed this section — a verification pass, confirming
today's batch introduced no new echo or choice-consequence regressions;
no verify needed.

### Item 11, a second attempt: measure where the ratchet's budget goes before cutting

The first pass at this item (above) found the lever — `["regions", ">=",
6]` — and the wall: ~100 characters of status-ratchet average headroom
needed, 6 in hand at the time, a day spent finding little more by trimming
whatever was already in view. Its own advice for the next attempt was to
start from a budget trim sized to actually matter, not re-derive the
numbers. Took that literally: rather than keep reading quest text and
guessing which line was worth cutting, built a tool that measures it —
`scripts/audit-status-weight.ts`, walking the same walkthrough the ratchet
test does, summing `text.length x timesShown` per quest stage via
`journal()`. That is the same unit the ratchet itself is in, so the
ranking says, directly, where a character actually pays and where it
doesn't — a quest shown on 3 status calls and one shown on 130 cost the
same per character but nothing alike in total, and nothing before this
measured which was which.

The single largest line in the realm, by that measure: `ir_writ`'s fallback
stage (`world/reach/ir_irondowns.json`), 120 characters shown 130 times —
every status call from entering Iron Downs until a first hold burns, which
most roads never do. "The Regent's writ opens Coldpass: Highward's envoy
writes it for one hollow burned, or two honest services to the Watch."
Checked, not assumed: confirmed by direct replay that `main`'s own stage 4
("Fifteen holds, fifteen griefs. Rest three, earn the Regent's writ, or buy
the Companies' road — any opens Coldpass") is co-active for all 130 of
those calls — the road quest is shown on every status screen this side
quest is. Between the road quest already saying the writ opens Coldpass and
the side quest's own name already being "The Regent's Writ" (`- The
Regent's Writ:` prefixes every line of it), the side quest's text restating
both was the same shape as `mg_hollow_throne`'s fix earlier today — one
fact, said twice, on the same screen — just on a line worth 40x more than
that one was. Trimmed to the one thing only this text says: who grants it,
what it costs. "Highward's envoy writes it for one hollow burned, or two
honest services to the Watch." Ratchet average: 3,632.5 -> 3,616.2 (one
edit moved as much as the entire first pass's day did) and the headroom
this item needs went from 17.5 to 33.9 characters — real progress, still
short of ~100.

Checked the next three biggest contributors by the same tool — `th_q_rook`
(173 calls, the single most-shown side quest in the realm), `th_q_after`
(148), `ir_q_after` (107) — against the same question (does this restate
something already on screen?) and found no. Each is a self-contained line:
a location plus named options, a person to find and why, nothing an
adjacent quest or the road already says. Shortening any of them further
would be cutting content for the sake of a number, which this project's
own bar does not ask for and `mg_hollow_throne`'s residual note explicitly
warned against doing. Left as they are.

`npm run verify` green: 331 tests (including the ratchet test itself, now
passing with more room than before), all three worlds validate unchanged
(reach still wins at 240 turns), both crawls clean. `scripts/fmt-json.mjs`
run on the one content file touched.

Not closed — the tool this pass built is the more durable result. A future
pass (this item's own, or whatever next needs the same headroom) can run
`audit-status-weight.ts` and start from a ranked list instead of a blind
read, the same way `audit-bearings.ts` now saves the next person from
re-checking 868 legs by hand.

### A third wave (seeds 91553/91554): Iron Downs a third time, and two checks traced by name

`62936555`/`6362b945`/`f419c621` are one report again — `s91553`'s
bugs[0]/suggestions[0]/confusions[0], the same "one paragraph, three triage
units" shape as the second wave's `1423c536`/`b3db44ea` — but a third
independently-simulated player hitting the same friction, worded more
sharply this time ("extensive exploration of Thornwold's forest fringes...
never surfaced an exit"), so it earned a fresh trace rather than the
standing verdict.

**Iron Downs, a third time.** Replayed `s91553`
(`runs/g1-91553-mu2x2l9e.json`) turn by turn. The player visited
`th_settlement` exactly twice — turn 166 (arrival: "get your bearings",
then "go in" to the muster) and turn 196 (a pass-through: "go west"
straight into the deep wood) — and on both visits "go north (toward the
north track)" sat on the menu, unconditional, plainly labelled
(`th_thornwold.json:146`, no `if` gate on the exit). The player never took
it and never visited `th_north_track` at all. Instead they spent turns
197-413 in the deep-wood grid off `th_settlement`'s west exit: 13 of its 22
cells, including 9 visits to Spoil Verge alone and 3 each to Deer Break and
Black Thorn Stand — precisely the rooms the ticket names. They finished the
game to a full win (`reach_at_rest`) without ever setting foot in the Iron
Downs region.

Checked every wilderness cell the ticket could mean for a false or missing
promise, not just the three it names, reading the whole `th_wood` grid
(`th_thornwold.json:2626-2896`; `walls` at 2632, `links` at 2638). None
misleads: Spoil Verge's "off the Iron Downs... A deer track bends east; the
wood thickens south" (2652-2653) names only its two real exits — its north
side is the 5x5 grid's own edge, no cell there, nothing offered. Ridge's
End (2726), the row's actual dead end, says so outright — "the ridge runs
out... a long view north over gray spoil-heaps that were never Thornwold's
own. South the trees close again; west the holloway continues" — a horizon
view named as one, the same shape as the already-settled Hollow Path
finding, not a claim of a path. Black Thorn Stand (2754-2755) does have a
real north exit ("a gap shows north between the thorns") — but it leads to
`th_understory_root`/"The Black Thorn Gap" (the `links` entry at 2638-2645,
`dir: north`), a grace/wits-gated entrance to the unrelated Understory Hall
dungeon, which this player found and explored (3 and 9 visits) — plausibly
satisfying whatever sent them looking for "a way north" in the first place,
just not the way they reported missing. No broken or miscommunicated sign
anywhere in the branch the player exhaustively explored; it simply doesn't
connect to Iron Downs, and the branch that does (north from the same hub)
was offered to them plainly, twice, and declined both times — a third
independent instance of the "exploration variance, not a broken sign" shape
the first two waves found, on if anything stronger evidence (shown twice
this time, not once).

Took the "third occurrence" question seriously rather than re-citing the
old verdict, and went looking for the specific low-cost fix the ticket
itself points at: does any companion's own dialogue give a direction, not
just a name, to their home region, and is there realm precedent for that
shape of hint? There isn't, and it isn't close. Every companion's
pre-departure "go find your region" quest stage uses the identical
template, word for word in shape: `q_lys`'s "Ask after Lys's brother at
Camp Gallows, in Thornwold — before Coldpass" (`companions.json:5292`),
`q_osk`'s "...then find Fenmarch — before Coldpass" (5314), `q_tamsin`'s
"...then find Cinderhall in the Iron Downs, past Thornwold — before
Coldpass" (5339), `q_vell`'s "...then find the Keepers' Hall in Hollowbrook
— before Coldpass" (5363): region name plus narrative ordering, zero
compass directions, four for four. Adding "north past the Palisade Gate" to
Tamsin's line alone would not be the single low-cost sentence it looks
like; it would be the one companion out of four whose hint suddenly reads
differently from her siblings', for no in-fiction reason, breaking a clean,
deliberate, four-instance convention to fix a room this exact player had
already been shown twice. That is a real cost, not a budget-ratchet one,
and it is exactly what this pass was asked to check for before proposing
the edit — found it, and it rules the edit out. No `scripts/budget.ts` run
needed; no text changed.

Verdict: non-finding, third time, on stronger evidence than either prior
wave. `P1-issue-62936555.json`, `P2-issue-6362b945.json`,
`P2-issue-f419c621.json` moved to `done/`.

**The skiff and the robbed mounds.** `a0a6195b` names two actions: "drag
the skiff free" (already checked twice) and "talk him into leaving" (not
previously checked by name). The second turned out to matter: despite the
conversational label, `hb_robber_talk` (`hb_wild.json:382-412`, "The Robbed
Mounds") is a room action, not a topic — its `kind` is `custom`, so
`checkSourceId` (`engine.ts:1172-1185`) keys it `act:hb_robber_talk`, not
`tp:...`. The `tp:` exemption (`engine.ts:1222`) was never in play for this
check; it was always going to escalate on repeated failure, the same
documented design as the skiff. So the ticket's framing — DC creep with "no
in-fiction alternative offered" — doesn't hold up either half, traced
against `s91553`:

- `fd_free_skiff` (`fd_fenmarch.json:509-537`): offered at DC 14 (turn
  335), failed at turn 347 (hp-1), and the very next offering (turn 348)
  already read "raised 1 by failed tries, and stops at 21" — shown
  correctly, before the second attempt, exactly as designed. Failed again
  at turn 353 (DC 15 by then), ceiling text updated to "raised 2... stops
  at 21" at turn 354, and the player then left for Reedholm and never tried
  it a third time. Two tries, the warning shown both times, then walked
  away — not a spiral, and (confirmed fresh) the skiff still gates nothing:
  `fd_ironbound_skiff_freed` is read in exactly one other place in the
  whole realm (`fd_fenmarch.json:1617`, a flavor variant), no quest.
- `hb_robber_talk`: one try (turn 414, DC 10, failed — "So close"), and the
  very next turn (415) the menu already showed the escalated DC (11,
  "stops at 23") on "talk," DC 10 still unescalated on the neighboring
  "snatch his spade away (grace)" — and the player picked the grace option
  instead of retrying talk. That failed too (turn 415), and the turn after
  (416) the player simply attacked and killed the robber in ordinary combat
  — a third, always-available option requiring no check at all. Resolved
  two turns past the first failure, using two of the three in-fiction
  alternatives the room already offers side by side with the failing one
  ("take a cut and look away," a no-check bribe, and "snatch his spade
  away," a separate grace check, both `hb_wild.json:413-448`) — the
  opposite of "no alternative offered."

`0cb1aaea`'s first half (cap/soften the ceiling) is the same ask `ca46b6d4`
already settled, on the same `escalatedDc` reasoning
(`engine.ts:1196-1206`), and this trace gives no new reason to revisit it.
Its second half — "surface the 'ask a companion for help' option sooner" —
describes a mechanic that doesn't exist anywhere in the engine or content:
`checkMod` (`engine.ts:448-452`) sums skill, attribute, perks and
conditions, never party composition or a companion-assist action, and
nothing in `world/` is labelled anything like "ask ... for help." (The roll
breakdowns the trace shows, e.g. "+1 Grave Sense, +1 Iron Will," are
passive perks already folded into the modifier automatically — closer to
what the ticket may be picturing than a hidden menu option.) Nothing to
surface sooner; the feature doesn't exist to surface.

Verdict: both non-findings. `P1-issue-a0a6195b.json`,
`P2-issue-0cb1aaea.json` moved to `done/`.

**`d9ce0768`, the ash-boy's hint.** The ceiling-preview question ("does
'stops at N' show before the player gives up") was re-asked for this wave
and re-confirmed, fresh, above. `d9ce0768` asks something else — a hint
toward an alternate route after repeated failure on a *repeatable social
check*, modelled explicitly on the "go X (locked: ...)" pattern. Its likely
source is named in `s91554`'s own bug report: "the ash-boy's will check to
slip past the palace gate," Marrowgate — traced against
`runs/g1-91554-mu2x2l72.json`.

`mg_ashboy`'s `favor` topic (`mg_undercity.json:616-635`) is a real `tp:`
check (`tp:mg_ashboy:favor`), and the exemption holds under fresh, direct
observation: failed three times running (turns 509, 510, 511 — rolls of 4,
7, 5 against DC 11, +3 mod), `checkAttempts` climbing 0→1→2→3, while the
displayed and rolled DC stayed flat at 11 every time — no "raised" text
ever appeared, because none should. Watched the number itself not move,
three times, in this trace, rather than trusting the exemption from its
code comment alone.

The alternate-route information — "the writ, the Marshal's escort, the
servants' door, or force" — already exists, as the locked hint on
`mg_palace_gate`'s own north exit (`mg_marrowgate.json:366`), and in this
trace it was on screen from the player's first view of that room (turn
507), before a single failure anywhere. So the concrete instance behind
this ticket doesn't show the harm the suggestion is worried about: the
player failed the ash-boy three times, gave up, walked one room back east,
tried the servants' door once, then headed toward the Regent's Way and
found Lord Marshal Tarn (`mg_marrowgate.json:2386-2405`, at
`mg_watch_house`) — the NPC the hint had already named by title — inside 6
turns, no dead ends. "Only discoverable by wandering to an unrelated
location" overstates it; the location is the one the hint points at.

That said, the ask itself is real and distinct from the ceiling preview,
and isn't fully met: the hint lives on the exit, not on the failing check.
A player who fixates on retrying a topic without walking back to re-read
the gated room's own menu gets nothing from `mg_ashboy`'s own fail text
("Try again when you mean it") pointing them anywhere else, and nothing in
the engine attaches an alternate-route hint to a `tp:` check's own
repeated-failure branch in general — it works here only because this
particular check happens to sit one room from an exit that already has a
hint. A repeatable social check not tied to a locked exit (out of scope to
survey in this pass) would get no such assist. Building that generally
would be system-wide work, not a minimal fix, and this is a single,
uncorroborated report making the ask. Left in `queue/`, open, on the same
bar as `b3db44ea` above — a real idea, not yet justified, not a
non-finding.

No code or content changed this section — five queue files moved to
`done/`, one (`d9ce0768`) confirmed and left open in `queue/`, nothing
else; no verify needed.

### "Name it" isn't the universal free pass it reads as

`P1-issue-a6bc207d` and its companion suggestion `P2-issue-f73a00c5` called
the Scholar's "name it" (`scholar_name`) a free, no-roll pacify that
trivializes "nearly every" armor-useless undead guardian in the realm — gray
husk, barrow-wight x2, gray sergeant, grave-wight, honour guard, all named
from one `s91553` report. Checked against the world data and that exact
player's own trace (`runs/g1-91553-mu2x2l9e.json`) rather than the report's
list.

No-roll is right; free and universal are not. `scholar_name`
(`world/reach.json:238-247`) is gated `class scholar` and spends a real,
displayed resource — `res_scholar`, capped at 2 (`world/reach.json:183`),
one per use, refilled only by resting; the menu line names what's left, the
same pattern `test/abilities.test.ts:118` proves for its sibling
`envoy_press`. Its other gate, `horrorHere`, only reads true where a
`pierce`-flagged hostile stands (`src/engine.ts:363-364`), and realm-wide
that's **8** hostiles, every one hand-authored, none of them a stamp:
barrow-wight (`va_barrow.json`, `hb_wild.json`), grave-wight
(`hb_hollow.json`), the gray sergeant (`th_thornwold.json`), honour guard
(`mg_marrowgate.json`), the Lost Sentry (`wm_wild.json`), hound of the hunt
(`kw_wild.json`), glass-ash wraith (`em_wild.json`). The 32 template-stamped
guardians the ticket's own "barrow/camp/chapel" framing evokes — `$wight`,
`$captain`, `$saint_shade` (`world/reach/templates.json:180`, `878`,
`1162`) — carry no `pierce` field at all, so "name it" never appears on any
of them; a camp captain is already paid off in gold or slipped past on a
grace check instead (`templates.json:794-824`), varied and lore-tied by
template, not by this ability.

The trace settles "nearly every." `scholar_name` fires 4 times in 547 turns
(actions 156, 290, 521, 673) — both barrow-wights, the gray sergeant, the
honour guard. The other two of the ticket's six never went through it: the
gray husk is attacked twice, plainly (actions 88-89) — it carries no
`pierce`, so "name it" was never on its menu to begin with — and the
grave-wight is bypassed outright with the Keeper's Key (`hb_wight_key`,
action 564), never fought or named. A third of the ticket's own examples
weren't resolved by the option it blames.

The breadth that does exist is on purpose, and recent, not an oversight.
Sept 9 widened `scholar_name`'s own gate from four conditions to three
specifically so a Scholar's kit stood on more than 1 screen in 1,760 (above,
"What landed on 2026-09-09"); this session's own `calm_<id>` passage-unlock
fix (barrow/camp/chapel, 32 stamps) exists to stop the engine and the door
from disagreeing about whether a calmed enemy still counts as a threat — a
fairness fix, not this one, and `f73a00c5` asks to unwind exactly that kind
of decision on the strength of a report that overcounts its own examples.
Both non-findings; moved to `done/`.

### Hollow Throne's kneel already gets the two-step warning

`P2-issue-79b78bd8` worried that `mg_hollow_throne`'s four win paths are
summarized only by the free "weigh the doors" action, so a first-time player
could stumble into "kneel" — an instant loss — without warning. Checked the
room itself (`world/reach/mg_marrowgate.json:873-1283`, touched twice
already today) rather than trust the framing.

`mg_kneel` doesn't end anything on the first press. Its own menu label
already reads "kneel to the hollow seat (**ends the tale**)" before it's
chosen; pressing it only sets `mg_kneel_warned` and prints "This is the one
door here that does not open back... and there is no dawn on the other side
of it. Kneel again to go through it" (`mg_marrowgate.json:1264-1272`) — the
loss itself sits behind a second, separately labeled action,
`mg_kneel_confirm` ("finish kneeling", lines 1274-1280). That's the exact
warn-then-confirm shape of `va_kneel`/`va_kneel_confirm`
(`world/reach/va_barrow.json:564-579`), the precedent this session already
built for the same kind of ending. Underneath both, the engine's own
generic, automatic warning (`_warnedEnd_`, `src/engine.ts:3398-3404`) fires
on first entry to any room holding an ending action — `mg_hollow_throne`
qualifies — printing "An ending waits in this room" before the player can
act at all, no "weigh" required. "Weigh" adds detail (which win road is
ready); it was never the only guard standing between a first-time player and
kneel. Non-finding; moved to `done/`.

### "A hit costs standing" — the same settled question, a different branch

`P2-issue-cfb5bd14` read "a hit costs standing" as backwards — succeeding
shouldn't cost you — which is worth checking apart from the "fine once
shown" half of its own complaint (the timing question this ticket itself
doesn't press). It's the same `costsStandingHint`
(`src/engine.ts:2333-2348`) wave one closed under "Ambiguous 'costs
standing, hit or miss' phrasing" (above, line 2592), just its `hitOnly`
branch instead of the `both` branch that report hit — same function, same
reasoning, a different one of its three output shapes.

The reasoning is in the call site's own comment: "a miss that costs standing
or regard is said before the die is thrown... so is a hit that costs it, so
the warning never reads as 'only a miss'" (`src/engine.ts:3009-3010`) —
worded that way specifically so a player never assumes success is free.
Checked against this ticket's own example: `mg_read_founding` ("find the
founding ledger (wits)", `world/reach/mg_marrowgate.json:466-494`) costs
`appr_vell` only in the hit branch (line 484) — finding the ledger is what
exposes Vell's lineage, not failing to find it — so "a hit costs standing
with Vell" is the only accurate sentence available, and it prints in the
same pre-roll line as the DC, before the player commits, same as everywhere
else in the realm. Non-finding, same settled shape as wave one's; moved to
`done/`.

No game code or content changed across these three — four queue tickets
checked against world data and their own players' traces, all four closed
as non-findings and moved to `done/`; no verify needed.

### Room paging resets the display, not the number — the danger the ticket describes was already closed

`P1-issue-d8b33576`/`P2-issue-b0833856` (one incident, `s91554`, a bug and its
paired suggestion) say paginated room menus reset to page 1 on re-entry or
"returning from a submenu," so a remembered "more in this room" option
number can silently point to the wrong thing. Built a throwaway repro
directly on `newState`/`legalActions`/`step` — a synthetic room with 14
actions, no world file needed — rather than trust the claim's own framing.

Half the mechanical claim holds: `enterRoom` (`src/engine.ts:1620-1622`)
sets `s.roomPage = 0` unconditionally on every successful `go`/`travelto` —
"a new room opens on its first page" — so leaving a paged room and walking
straight back does reset the display; confirmed with the repro (paged to
2/2, left, returned, back to 1/2). Paging itself is real in this exact run
too: `s91554` turned pages at `va_crypt`, `va_square`, `wm_parade` and
`mg_hollow_throne` during play. The other half of the claim doesn't hold:
`endtalk` (`engine.ts:3205-3208`) and `traveldone` (`:3232-3235`) never
touch `s.roomPage` at all, since the room itself never changes underneath a
conversation or a closed travel menu — the same repro held a room at page
2/2 straight through opening and closing both a `talk` and a `travel`
submenu without it moving. "Returning from a submenu" resets nothing.

More to the point, neither half actually causes the harm described. A menu
number has meant a position in the room's *whole* option list, not the page
showing, since `menuNumbers` (`engine.ts:2424-2427`); a number the current
page doesn't show still resolves to the same action via `actionByNumber`'s
whole-list lookup (`:2444-2447`) — and, decisively, in the interface this
wave's agents actually ran on: `mcp.ts`'s `act` handler (`src/mcp.ts:135-
148`) tries the currently-displayed page first and falls back to the whole
list when the number isn't on it, and its own comment names this exact
scenario, fixed after two wave-six players hit "No action N" typing a
number they'd read a screen earlier. A remembered number cannot silently
name the wrong thing; there is no report anywhere of a wrong action being
taken this way, in this wave or any prior one.

The reset-on-reentry behavior is also not an oversight to fix — it's the
exact, deliberately named case `test/menu.test.ts:93-102` asserts, "walking
into a room opens it on its first page," with its own comment: "the hall
opens where it opened the first time." Making a room remember its own
last-viewed page would mean reversing that test on the strength of one
report, and the state-shape change it needs (`roomPage` keyed per room
rather than one global counter) runs into a second, harder guard:
`test/statecopy.test.ts:56-71` pins the state-canonicalization hash exactly
so every receipt any report has ever quoted keeps verifying, and says
plainly that changing it is "a decision, not a refactor" — spent once
already, when `roomPage` itself was born. Spending it again to save one
keypress after leaving and returning to a crowded room, against a danger
that turns out not to exist, isn't that decision.

Verdict: non-finding on the safety claim (`d8b33576`) — the display reset
is real but working as designed and tested, and cannot cause a wrong pick.
The suggestion (`b0833856`) is genuine but its real cost is a receipt-format
break for a single P2 report solving a problem that doesn't occur —
considered and declined, not merely under-corroborated, the same shape as
the skiff-drag ceiling's rejection above. Both moved to `done/`.

### The Parade Ground has five exits, not four, and "go north" is the one the desc names

`P1-issue-3269f0aa` (`s91554`) says "go north" from Highward's Parade Ground
led back to the Captain-General's Hall rather than onto the moor "as
expected from the bearings readout" — the same shape of claim `Hollow Path`
(above) already settled: read the room and the bearing by hand rather than
assume a mismatch.

`wm_parade`'s authored exits (`world/reach/wm_wardmoor.json:66-71`) are
unconditional and exactly as reported: south to the gate, west to the
armoury, east to the barracks, **north to `wm_hall`** — the
Captain-General's Hall — whose own `south` exit (`:247`) returns the same
way, an ordinary two-way door, not a loop. The room's own desc (`:62`) says
so itself: "...the Captain-General's hall north; south is the gate, and a
track worn pale by boots leads **out** onto the moor" — the moor exit is
real, but it's a fifth exit, `out`, stitched in at world-gen time by
`wm_wild.json`'s gen-grid back-link (`cell [2,4]`, `"back": "out"`, line
17, applied by `src/worldgen.ts:93-106`) rather than authored inline on the
room — and the room's own prose already names it by its real direction
word. `scripts/audit-bearings.ts`, the house tool built for exactly this
claim, finds 0 of 78 `wm`-region legs wrong, `wm_parade` included — the
full walked sweep, not a hand spot-check.

The bearings action (`wm_bearings`, `:108-114`, "North across the moor,
then east at the height...") reads a compass for the wider moor's own
geography, the same kind every bearings macro in the realm gives, not a
claim about which of the room's own exits to take — the same horizon-vs-
promise distinction `Hollow Path` turned on. Replayed `s91554`
(`runs/g1-91554-mu2x2l72.json`) through the real moment: the player read
the bearing, went north into the Hall, came back south, went north again,
immediately back south — one genuine wrong guess, corrected in a single
free step — then "go out" landed them on the moor the very next try. Two
extra, costless turns, self-corrected before any harm; not evidence of a
broken or misleading graph.

Non-finding, same rigor and same shape as `Hollow Path`; moved to `done/`.

### The ash-boy's hint: the bug half of the incident `d9ce0768` already traced

`P1-issue-f3d5b35d` is the "bug" unit of the same `s91554` incident
`P2-issue-d9ce0768` (above, this document) already investigated as a
"suggestion" — one paragraph in the source report, two triage units, the
shape this document has named before. Traced it independently against the
same run (`runs/g1-91554-mu2x2l72.json`) before finding the write-up
already on record: the same three `mg_ashboy`/`favor` failures (will DC 11,
+3 mod, no escalation — `tp:` checks are exempt, `engine.ts:1222`), the
same locked-exit hint on `mg_palace_gate`'s own north exit ("the writ, the
Marshal's escort, the servants' door, or force", `mg_marrowgate.json:366`),
the same walk to Lord Marshal Tarn (`:2386-2405`) once the player gave up
and went back the only way `mg_servants_way` (`mg_undercity.json:118-125`)
opens onto — a dead end with one exit, so the hint isn't merely nearby, it
is unavoidable on the way out. Confirmed with a literal render one action
before the player's own locked "go north" attempt: `2 go north (locked: the
writ, the Marshal's escort, the servants' door, or force)` was already on
their menu, printed there since their first view of the room.

`f3d5b35d`'s specific claims — "no visible alternate solution hinted at"
and "only discoverable by wandering to an unrelated location" — are exactly
what this trace disproves: the hint is visible, and Tarn sits two ordinary
hops from a room the player had just walked out of, not somewhere
unrelated. `d9ce0768`'s narrower, correctly-scoped ask — a hint on a
failing check's *own* text, for the general case where it isn't lucky
enough to sit next to an already-hinted exit — is real and stays open
there, on its own single-report bar; nothing here changes that verdict, and
nothing needs to.

Non-finding on `f3d5b35d`'s own claims; moved to `done/`. (`d9ce0768` is
untouched — not this ticket, already correctly left in `queue/`.)

### The travel list's cheap win already shipped; what's left is a bigger feature

`P2-issue-39b85b76` (`s91554`) says travel-to-known-place lists get very
long (30+ entries, several 10-item pages) once a lot is explored, making a
specific far-off landmark slow to find by name. Checked
`travelList`/`travelActions` (`src/engine.ts:1046-1131`) for the obvious
cheap win — sorting — before assuming one was still missing.

It's already done. `byTravelName` (`:1075-1076`) sorts every list this menu
ever shows, flat or region-drilled, alphabetically by the same display name
the label prints (article dropped) — landed, per its own comment,
specifically because "two playtest reports two waves apart" made this exact
complaint, "so a player can guess which page a name falls on the way a
phonebook lets them." The menu also already groups by region once known
landmarks exceed one page (`:1088-1092`), so the top-level screen stayed
small all through this wave's own trace (`s91554`, e.g. `wm_record_house`:
5 regions plus "stay here"). The 30-entries case the ticket describes is
real, but it's one region's *local* travel list (`localTravel`, `:1046-
1047`) once heavily walked — deliberately ungated, the same comment
explains why ("made no difference to the cost" to gate it; doing so would
be "narrowing a gate to hide a price") — sorted the same way, and still
genuinely long.

The remaining ask, a search or filter, is a real UX idea but a materially
bigger one: the interface is numbered-menu-only front to back, no free-text
action anywhere in `Action`'s type (`src/types.ts:502-522`), so "search"
needs a new interaction primitive, not a content edit. Single report, real,
not yet justified against that size of change — the same bar this document
already holds `d2780f5c`'s twin half to, above.

Left in `queue/`, open; not moved.

### The Pass Gate already does what `P2-issue-58169e05` is asking for

`P2-issue-58169e05` (`s91553`) is praise more than a bug report — keep
surfacing `status`/`look` proactively, e.g. at "other point-of-no-return
rooms like the Pass Gate." Checked `cp_pass`
(`world/reach/cp_coldpass.json:36-48`) for what it already does before
treating this as a gap.

It already does more than the ticket asks for. `cp_pass`'s `onEnterOnce`
fires for free on first arrival — no `weigh`, no `status` call required —
printing both a room-authored warning ("Past this gate the holds fall
behind you. A companion's grief left unfinished there stays unfinished
unless you walk back for it") and `questsopen` (`:47`), an engine effect
(`src/engine.ts:1582-1594`) built for exactly this ask: it counts the
player's open quests and says, explicitly, "Read them in your status before
you cross" — its own comment names the same motivation this ticket gives,
a playtester who "named why — 'this is stated once in passing dialogue but
easy to miss, and irreversible.'" `questsopen` is used nowhere else in the
realm; `cp_pass` is the one true point-of-no-return it was built for.
Confirmed live in this ticket's own source run: replaying
`runs/g1-91553-mu2x2l9e.json` to the player's actual crossing prints
precisely this — the open-thread count and the "read your status" line —
automatically, before they went through.

The realm's other genuine point-of-no-return, `mg_hollow_throne`, gets the
parallel treatment this document already recorded elsewhere today: a free
"weigh" action, the engine's own generic ending warning, and (item 8's
residual, above) a quest-stage line trimmed to say the one thing those
don't. Every true crossing in the realm already gets a tailored, automatic
nudge toward `status`; there is no point-of-no-return left bare for this
suggestion to fill.

Satisfied; closed. Moved to `done/`.

Verified across all five tickets above: `npm run -s typecheck` clean,
`npm run -s test` 331/331, `npm run -s validate` all three worlds still
win-proven, `scripts/lint-world.ts` clean (all text within budget),
`scripts/budget.ts world/reach.json` unchanged from its last-recorded
figures, `npm run -s crawl` 0 over-cap menus on all three worlds. No game
code or content changed this section — five queue files (`d8b33576`,
`b0833856`, `3269f0aa`, `f3d5b35d`, `58169e05`) moved to `done/`, one
(`39b85b76`) confirmed and left open in `queue/`.

### Item 11, closing the redundancy hunt: a systematic pass, not just a manual one

The `ir_writ` fix above came from reading the top of `audit-status-weight.ts`'s
ranking by eye and recognizing a restated fact. Before calling that vein
exhausted, ran the same question the other way: instead of a person reading
ranked text and judging it, a script checking every pair of quest texts that
are ever co-active on the same status call for any shared run of 3+
consecutive words, weighted by how often the pair actually appears together
— the same "measure, don't guess" discipline the ranking tool itself used,
applied one level deeper.

228 co-active pairs exist along the walkthrough; 10 share a run that long.
None is a second `ir_writ`. The highest-weighted (`ir_q_after` vs.
`th_q_after`, co-active 107 times, sharing "a stone for the") is the
realm's own deliberate template for a hold's "after" quest — two different
holds' two different grief-objects, both routed through the same sentence
shape on purpose (item 4 in this document's order, "the fifteen holds
rhyme"); cutting either would remove information, not repetition. The rest
(`"at the throne"`, `"first then the"`, `"under the palace"`) are the same
shape: connective phrasing two unrelated sentences happen to share, not one
fact stated twice. The `main`/`mg_throne` pair ("under the palace," 6
calls) is the only one that even reads as informational overlap on a
second look, and at 6 calls its total weight (18) would move the ratchet
by hundredths of a character — not worth the risk to a screen already cut
twice today for touching it more than the evidence asks. Nothing here
clears the bar `ir_writ` cleared. Checked, not left unlooked-at; the vein
this specific technique can reach is exhausted for now.

### A small, honest gap: scholar_read's fix, checked against real play, inconclusively

The 11→10 DC drop for `scholar_read`/`scout_hands` (earlier today) aimed at
starved content, not at making either ability universally chosen — so
"did it work" was never going to be a clean yes/no from four traces. Still
worth looking rather than assuming. All four blind players across waves
two and three picked Scholar; none picked Scout, so `scout_hands`' half of
the fix has no data to check against yet, real gap, not filled here.
`scholar_read` fired once each in two of the four scholar traces (`s84498`,
`s91554`) and zero times in the other two (`s84497`, `s91553`) — consistent
with "now viable, not now favored," which is what the fix was for, but
four data points at one-or-zero uses each cannot distinguish that from
noise. Recorded as checked-and-thin rather than left silently unverified;
a wave with a Scout player, whenever one happens, is worth the same look.

No code or content changed across these two checks; no verify needed.

### Seven for seven: every blind wave this project has ever run picked Scholar

Checking `scholar_read` against real play (above) only used the four most
recent traces. Widened it to every real playtest-wave trace `runs/`
still holds — every `g1-*.json` file whose seed is not `7` (that seed is
`npm run mock`/`measure`'s own fixed fixture, not a blind wave; filtered
out) — and checked which class each player picked, not just whether one
ability fired.

    seed 4242    scholar
    seed 68938   scholar
    seed 71223   scholar
    seed 84497   scholar
    seed 84498   scholar
    seed 91553   scholar
    seed 91554   scholar

Seven waves, seven Scholars, zero Wardens, Scouts, or Envoys. Not a
four-trace coincidence — this project has never once had a blind AI
playtester pick anything else, in every recorded run that still exists.
Whatever bugs are specific to Warden's forced-combat routes, Scout's
grace-heavy checks at scale, or Envoy's talk-economy have had zero blind
coverage this project's whole history — the class balance work itself
(this session's DC fix included) has leaned on the deterministic crawler
and proofs, which do exercise all four, but the *playtest* half of "AI-
coded, AI-playtested" has effectively been testing one class in a
four-class game.

Rendered the literal first screen every blind player sees
(`renderIntro`, seed 1, via `new_game`) rather than guess at what drives
the pick:

    The barrow on the hill above Last Light has opened, and a gray blight
    creeps down the Vale of Ash — crops first, then cattle, then the will
    to stay. Someone must go up and settle the Hollow King, by verse or by
    crown or by steel. [...]
    1 be a Warden — [...] steel opens what words cannot (might) [...]
    2 be a Scout — [...] locks, ledges and carved stone give to careful
      hands (grace) [...]
    3 be a Scholar — reads the old tongue outright — verses, ledgers and
      the dead's own words come easy (wits) [...]
    4 be an Envoy — [...] doors, coffers and old grudges open to talk
      (will) [...]

A hypothesis, held as one, not asserted as the finding: the intro's own
framing ("by verse or by crown or by steel") pre-names two of the four
specialties, and Scholar's line is the one that keeps going past its own
match — "verses, ledgers **and the dead's own words**" — landing on a
phrase that echoes the intro's own grief-and-haunting register (barrow,
blight, Hollow King) more directly than any other class's line touches
its own domain. If that is what is happening, it would explain why
Scholar wins over Warden too, despite "steel" being named in the same
sentence: thematic resonance with the setting, not raw match to the
stated solution paths, doing the steering. Menu position doesn't explain
it either — Scholar sits third of four, neither the primacy nor recency
slot.

Not fixed, deliberately. This is the realm's very first screen, read by
every player before anything else exists to correct a bad guess against,
and the cause above is a plausible reading of one paragraph, not a
confirmed mechanism — rewriting it on a hypothesis this size, with no way
to cheaply verify the rewrite actually changes what a future blind wave
picks, is exactly the "cut on a theory" this document's own habit warns
against elsewhere. Recorded so the next pass doesn't have to rediscover
that seven for seven is real: if a future wave (or a deliberate, small
set of them, watched for class pick alone) still comes back all Scholar
after this is known, that is the point to act, with evidence of what
changing the wording actually does rather than a guess about what it
might.

No code or content changed; a measurement, not a fix.

### The stray `pierce` flag wasn't stray

One of the flags surfaced this session ("worth a look later," `va_hollow_king`
in `world/reach/va_barrow.json:786`, carrying `pierce: true` despite not
being `hostile`) turned out not to need one. `pierce` isn't only the
`horrorHere`/`scholar_name` gate that earlier check read it as — it also
sets the player's effective armor to 0 against that npc's own attacks
(`src/engine.ts:1890`, `const armor = def.pierce ? 0 : armorOf(world, s);`),
independent of the `hostile` flag entirely. The king has real combat stats
(`hp:16 atk:4 df:13`) and an `onDeath` block, so fighting him is a genuine,
reachable path, and his own desc already promises exactly this: "Cross him,
and the cold that answers goes through mail." `pierce: true` is that
promise kept, not a leftover from copying a hostile template. Correctly
inert for the one mechanism the earlier check was looking at, correctly
live for the one it wasn't asked about. Left as is — checked, not a
finding, and worth recording so it isn't flagged as a loose end twice.

### The reference docs, read cold against everything landed today

`docs/roadmap.md` is the journal — every number in it is correct for the
day it was written and stays that way on purpose. `docs/authoring.md`,
`README.md`, and `scripts/`' own doc-comments are not journals; they
describe the realm as it stands right now, and today changed the realm
twice in ways they still described the old shape of. Read cold rather than
assumed current, since nothing this session had checked them against
today's own edits yet.

**The escalating-retry section stated the pre-fix behavior as current
design.** `docs/authoring.md` said escalation "has no ceiling: a check
retried enough times keeps getting harder, never impossible-in-principle"
— true of the bug a playtester once reported, false of `escalatedDc`
(`src/engine.ts`) today, which has capped every escalating check at
`modifier + 20` for a while now and previews exactly where a check will
stop once it has failed at least once. Confirmed against the live code
before touching the prose, the same discipline as every finding above.
Rewrote the section to describe the cap and its preview; left the
`scholar_read` code sample's `checkHere` DC at its old value of 11 too —
updated to 10, matching today's earlier fix elsewhere in this document.

**`scripts/audit-fights.ts` asserted, unconditionally and in its own
source, that "nothing on the other side scales with the crowd it faces."**
That was the finding that justified building `strikesPerRound` earlier
today — true when the tool was written, false of the engine it now
measures, and the tool kept saying it anyway because the closing summary
was a hand-written sentence, not a value read back from the fight it had
just simulated. Exported `strikesPerRound` from `src/engine.ts` (it was
already there, just not `export`ed) and had the script's own closing
paragraph compute the real numbers from it — "the hostile strikes back 2
times at party 2, 3 times at party 4" — instead of asserting a number by
hand. Live now: `3 companion knockdowns total across every fight above`,
which could not have been said honestly by the old, hardcoded paragraph
regardless of what the engine did. Updated `docs/authoring.md`'s own
quoted numbers to match a fresh run (72 hostiles now, not 68 — four more
were added since; 4 hp lost at party 2, not 2 — the scaling fix's own
effect, most visible at the smaller party where one extra blow is the
biggest relative jump) and its prose to describe the current rule instead
of the one that predated it.

**One smaller, unrelated staleness caught in the same pass**:
`README.md`'s file-tree comment still said "313 tests" against the
current, repeatedly-measured 331. Fixed.

`npm run -s typecheck` clean (the export changes a function's visibility,
nothing else), `npm run verify` green: 331 tests, all three worlds
validate unchanged, both crawls clean. No test, validator, or budget
touched — this section corrects prose and one export keyword, not
behavior.

### A missing var, in the two docs that are supposed to name every one

Kept reading reference material cold rather than trusted. `docs/region-brief.md`
(the brief a new region's author reads first) and
`docs/superpowers/specs/2026-09-05-realm-design.md` (the spec it points them
to for "the state contract — the only non-prefixed names you may read or
write") both describe hollow resolution as two tracks: `hollows_rested` and
`hollows_burned`, with a bargain folded into `hollows_rested` and no var of
its own. The brief's own example said so outright:
`["set","<code>_hollow_bargained"], ["addvar","hollows_rested",1]`.

The realm has moved past that. `hollows_bargained` is a real, independent
var today — 22 `addvar` calls across 15 region files, always alongside the
matching `hollows_rested` increment, not instead of it (confirmed directly
in `world/reach/fd_hollow.json` before writing any of this down, not
assumed from the brief's own description). It backs two things neither
doc named: `mg_hollow_throne`'s bargain road (`["var", "hollows_bargained",
">=", 3]`) and `status`'s own "Hollows bargained: N/15" line. A region
written strictly to the old example would set the flag, credit
`hollows_rested` correctly, and never touch `hollows_bargained` at all —
its bargain path would work everywhere a player could see, and be invisible
to the one gate built to count it specifically.

Fixed both: the brief's example now shows the second `addvar` the real
convention always pairs with the flag, with a line explaining why both
exist; the spec's state contract now lists `hollows_bargained` alongside
the other two, with the same one-line explanation so a reader does not
have to reverse-engineer it from a region file the way this pass did.

Neither doc is loaded by any test or the validator — a docs-only fix, no
verify needed — but the gap was real: the next region built strictly to
the old wording would have shipped a bargain path invisible to the one
place that counts bargains by name.

### The four 2026-09-08 proposals, read cold against what shipped

`docs/superpowers/specs/2026-09-08-a-fate-worth-choosing.md`,
`2026-09-08-seven-rites.md`, `2026-09-08-standing-and-ranks.md`, and
`2026-09-08-the-realm-moves.md` — all four still headed `Status: proposed`
— read in full against the tools and world files they describe, the same
discipline as the entry above. None of the four claims to be the realm as
it stands today the way `docs/authoring.md` or `docs/region-brief.md` do:
this directory's own convention for that is stated explicitly in
`2026-09-01-rpg-foundations-design.md`'s header — "kept as the design
record... where it and `world/vale.json` disagree, the world file is the
truth" — and none of the four claims an exception to it the way
`2026-09-05-realm-design.md`'s state-contract section does (fixed above,
because it explicitly is one: "the names are fixed here and nowhere
else"). So every enumerated list, mechanism, and number in all four was
checked against the live code for one thing: whether the specific claim,
not the proposal's fate, would mislead a reader about today. Three came
back clean. One found something real enough to flag, not fix.

**`a-fate-worth-choosing.md`** shipped close to whole. `audit-fates.ts`
today prints all three fates at score +25 in all fifteen holds — `0 of 15`
ranked, the doc's own bar for done — and `reach_bargained` exists, a
seventh ending gated on `["var","hollows_bargained",">=",3]`
(`world/reach/mg_marrowgate.json:1149`), both confirmed independently and
matching `docs/roadmap.md:449-458`'s own account of the same work.
`hollows_bargained` is real (`world/reach.json:3538`, 22 `addvar` calls
across 15 files — the same count the entry above measured), which
falsifies the spec's own line 76-77 ("`hollows_bargained` does not exist
yet as a var") — but that line is the proposal's justification for adding
the var, written the week before it landed, not a claim about the present.
`maxScore` is still 366 (`world/reach.json:21`, `test/engine.test.ts:54-59`)
— the one number in the doc a reader implementing something adjacent
might actually still load-bear on — unchanged.

**`seven-rites.md`** named seven holds sharing one three-token rite.
`node --import tsx scripts/audit-shape.ts world/reach.json --rites`, run
fresh, shows three of the seven already moved off it — the Meres to
`witness`, Mootcombe to `order`, the Hearthlands off the shared shape
entirely — all three named in `docs/roadmap.md:142-168` and `:445-448`,
which also accounts for the two still in flight (Embermoor, the
Kingswood). The finding's room and quest-count ranges (43-58 rooms, 6-8
quests) still match `--rites`'s live output exactly, seven days on.

**`standing-and-ranks.md`** carries the one section of the four built the
way `realm-design.md`'s state contract is — "the names are fixed here and
nowhere else" — so it got the same scrutiny that section got. Half of it
shipped exactly as specified: `world/reach/ranks.json`'s six quest ladders
use the doc's six faction codes verbatim, and the cross-pressure table's
numbers are live, checked against a granting scene rather than trusted —
`world/reach/ir_irondowns.json:911-919` gates `iron_sworn` on `rep_iron >=
9` and applies `rep_keepers -3`, `rep_church -3`, matching the table's
`iron_sworn` row and the `sworn (+9)` threshold exactly. The other half of
the same contract did not ship: `<code>_hunted` (line 132) has zero
matches anywhere under `world/`, and `statusPaths`
(`world/reach.json:3464-3520`) still reads the two states — `>= 2`,
`<= -2` — the doc's own finding named as the problem, not the five named
states proposed to replace them. Not a docs bug — the spec never claims
either shipped, and nothing else in the project claims it either — but
real enough to flag: a region file gated on `["flag", "iron_hunted"]`
today would be gating on something nothing will ever set, and nothing
currently says so anywhere but this audit.

**`the-realm-moves.md`** proposed `world.clock` and a `["turn", op, n]`
condition. Both shipped as described, concatenation-by-file and the
one-entry-per-turn rule included (`src/engine.ts:1982-1994`;
`docs/authoring.md` §13, which the spec's own line 115 points at and which
exists and matches). The march's own schedule did not ship on the
primitive the spec's example used: `world/reach/ir_irondowns.json:2448-2449`
carries an entry with the *same id* as the spec's own worked example,
`iron_march_warned`, but its `if` now reads `["flag","iron_march"],
["since","iron_march",">=",10],["!flag","iron_march_stopped"]` against the
spec's own `["flag","iron_march"],["turn",">=",40]` at its own line 86 — a
different op, a different number, and a guard the spec never had. This is
exactly the shape of drift the audit brief warned against auto-fixing on
sight, and correctly: `docs/roadmap.md:428-431` names the switch to
`since` in the same sentence it says the march landed, and gives the
reason — an absolute-turn schedule, it says, "drops ten holds in ten
turns" if the march starts late. Left alone; the honest account already
lives where a reader would find it.

No prose changed in any of the four specs this pass. Every mismatch that
looked, on first read, like the `hollows_bargained` or `strikesPerRound`
bugs above turned out to be a dated finding inside a document that never
claimed to still be current, or drift `docs/roadmap.md` already narrates
honestly — which is exactly the distinction this audit's own brief asked
to be drawn rather than assumed. One thing is flagged above for a human
rather than fixed: `standing-and-ranks.md`'s `hunted` tier and its
`statusPaths` redesign are proposed and unbuilt, not shipped and
undocumented, and deciding whether to build them, drop them from the
spec, or leave them as the unfinished third of an otherwise-shipped
proposal is a product call, not a staleness bug. Docs-only pass, nothing
under `world/`, `src/`, or `test/` touched; markdown checked by eye, no
`npm run verify` needed.

### Three more reference docs, read cold: two stale ending lists, a misattributed gate, and a review that outlived its own default world

Same brief as the two entries above, applied to three docs that hadn't had this pass yet: the foundations design (`docs/superpowers/specs/2026-09-01-rpg-foundations-design.md`), the Reach's region assignments (`docs/superpowers/specs/2026-09-05-region-assignments.md`), and the outside review's suggested fixes (`docs/reviews/2026-09-04-suggested-fixes.md`). Every enumerated list, specific mechanism, and specific number in all three was checked against the live `world/*.json` or `src/*.ts`, not trusted from the doc's own account of itself. Four findings were real and got fixed; two more were considered and left alone, for reasons recorded below rather than assumed.

**The foundations doc's ending roster undercounted by more than its own drift note fixed.** Its header already flags that the lore ending shipped as `king_at_rest`, not `blight_bound`, and names `crown_broken`, `true_rest`, and `king_forsaken` as later additions — but System 7's body was never updated to match: it still read "Three ways to win," listed only the original three ids (one of them the already-disclaimed `blight_bound`), gave two lose endings, and said `proofs` "carry the other three endings." `world/vale.json`'s own `proofs` object (`:2796`) has six keys — `king_slain`, `debt_paid`, `crown_broken`, `true_rest`, `crowned_hollow`, `king_forsaken` — on top of the unproven primary, `king_at_rest`: five `["end","win",…]`-tagged endings (`world/vale.json:1474`, `:1669`, `:1696`, `:1731`, `:2768`) and two lose endings beyond the built-in `dead` (`:1799`, `:1824`), not three and two. A reader trusting the body's count would think the game has one fewer win path than it does and would look for three proofs where six exist. Fixed: the list now names all five wins and all three lose endings, and "the other three" reads "the other six," with the `proofs` keys quoted directly.

**The same doc's "Companions that follow the player," under "Out of scope (on purpose)," reads as false if taken as a claim about today** — `CompanionDef`, the `party` effect, and the `inParty`/`companionDown` conditions (`src/types.ts:21`, `:36`, `:65`, `:176`, `:565`) are a core, heavily-used system now, not a deferred feature. Left alone, not fixed: the section's own closing line — "every one of these can be added later as data plus one small engine change" — already frames the list as the 2026-09-01 build's scope, not a permanent promise, and companions shipping later is exactly what that sentence anticipated. Flagged here rather than edited; a "(built later)" gloss would be a style improvement, not the correction of a false claim.

**The region-assignments doc put the `act2_open` gate on the wrong exit of `wm_south_gate`.** It said the gateway to `va_north_road` (`south`) is the one gated on `["flag","act2_open"]` with a lockedMsg about blighted holds. `world/reach/wm_wardmoor.json`'s `wm_south_gate` room does carry that exact flag and lockedMsg, but on its `in` exit to `wm_parade`, Highward's own interior (`:11-16`) — the `south` exit to `va_north_road` (`:10`) carries no `if` at all. The room's own desc agrees: "South the road drops back toward the Vale; within, Highward keeps its own roads." Fixed: the gateway line now says `south` is open and names the exit that actually carries the gate.

**The same doc's eight assigned regions are no longer the whole Reach.** `world/reach.json`'s `regions` object (`:24`) still has exactly the doc's nine entries (`va` plus the eight assigned codes) with matching names, and every assigned region's file exists — nothing renamed, merged, or dropped among the eight. But `world/reach/` now also holds ten more built regions in the same settlement/wild/hollow shape (`em`, `ff`, `fl`, `hl`, `kw`, `lf`, `mc`, `me`, `pw`, `sh` — e.g. `em_emberfall.json`, `em_wild.json`, `em_hollow.json`), none in `world.regions`, none in this doc, none assigned to an author here. One even reaches back into an original region's own file: `cp_pass`'s pilgrim-stair action also now opens on `["flag","me_covenant_carried"]` (`world/reach/cp_coldpass.json:82`), a condition only the unlisted `me` region can set. Left alone, not fixed: this doc reads as a point-in-time assignment sheet for one wave of authors ("One author per region, each writing against `docs/region-brief.md`"), the same kind of dated snapshot `docs/region-brief.md`'s measured numbers are — extending it to ten later regions would mean writing new region briefs from nothing, not correcting a false claim. Flagged for a human instead: whether the Reach has a current, complete region registry anywhere is worth asking, because right now the answer looks like no.

**`docs/reviews/2026-09-04-suggested-fixes.md` marks all eight fixes "Applied," and six of the eight Applied notes still hold** — re-checked directly against `loop/dev.sh`, `src/player.ts`, `loop/report-check.mjs`, `loop/mock-player.mjs`, `src/format.ts`/`src/player.ts`, and the `world/vale.json` flags and labels each note names; two quoted test names have since grown a suffix (cosmetic, not touched). Fix 4 and fix 8 did not hold: both described the MCP server's default world as `world/vale.json`. It has been `world/reach.json` since 2026-09-09 (`git blame src/mcp.ts:25`), and `src/play.ts:14`, `loop/report-check.mjs:24`, `loop/mock-player.mjs:105`, and `loop/playtest.sh:34` all default `TF_WORLD` to it too — the same shape of drift as this session's own escalating-retry fix, a doc describing a past default as if it were still current. Fix 4 also called `npm run mock` "a 200-step random walk"; `loop/mock-player.mjs`'s actual default (`MAX_STEPS`, line 23) is 400 and its own header comment (line 8) says a third number, 120 — 200 matches neither and was never the live figure. Measured rather than assumed: `npm run measure` with no arguments (the tool's own default, `--seed 7`) now ends the Reach walkthrough `dead`, receipt `reach.7.236.296.dead.812eab2b`; only `--seed 1`, the seed `world.proofs` is actually validated against, reaches the proven win, `reach_at_rest` at the world's own `maxScore` of 366, receipt `reach.1.240.366.reach_at_rest.0b6686df`. Not a regression — a fixed action sequence meeting dice it was never proven against is expected to land differently — but it means the bare command this doc names no longer demonstrates what the doc says it demonstrates, independent of which world is default; worth a human's attention on its own. Fixed: both Applied notes now name Reach as the current default, keep Vale as the historical fact it was at fix time, and fix 4's note carries the measured seed-1 and seed-7 receipts instead of the stale 200-step, seed-7-on-Vale figures.

Docs-only pass; nothing under `world/`, `src/`, `test/`, or `loop/` touched, so no `npm run verify`. Markdown checked by eye in all three edited files.

### Answering the last entry's own question: yes, there is a current region registry — it just missed one

The previous entry left an open question: whether the Reach has any current, complete region registry, since `docs/superpowers/specs/2026-09-05-region-assignments.md`'s roster is explicitly one wave's assignment sheet and `world/reach.json`'s own `regions` object, read as a JSON file in isolation, has only nine keys. That isolated read is the wrong measurement: `regions` is a mergeable `RECORD_FIELDS` entry (`src/validate.ts:66`), so every part file under `world/reach/` can add its own, and `loadWorld('world/reach.json').regions` — the actual merged world every other tool in the project uses — has **19** keys, not 9: the original nine plus all ten of the "unlisted" ten, `em`/`ff`/`fl`/`hl`/`kw`/`lf`/`mc`/`me`/`pw`/`sh`. `npm run verify`'s own 0 validator errors already implied this without needing a fresh check: `src/validate.ts:439` throws `unknown region <id>` for any room whose `region` field isn't a key of `world.regions`, and all ten regions' rooms set `region` to their own code — a validator pass across 936 rooms is 936 rooms' worth of confirmation that every one of those codes is registered somewhere.

`docs/superpowers/specs/2026-09-05-realm-design.md`'s "The map" section (`:49`) is that registry, and unlike the assignments doc it is explicitly maintained as one: it already listed nine of the ten later regions by name, having been updated once before when they were added ("Nine more were added after it shipped... eighteen in all"). It was missing exactly one region: Longford (`lf`), item 10's own sixteenth hold, built after this doc's map section was last touched. It had no paragraph among the other nine's — "its own paragraph at the end of this file" is the section's own stated promise for each — and wasn't in the roster or the region count. Fixed: the roster now reads "Ten more... nineteen in all" with Longford named, and a new paragraph sits after Fosterfell's, same depth and shape as the Meres/Hearthlands/Kingswood entries — sourced from item 10's own build section above (the three roads and their flags, the numbers, the gateway hook-ons) and cross-checked directly against `world/reach/lf_*.json` (room and npc ids, the toll-man, the three stamps) and `world/reach/companions.json`'s four `r_lf_entered`/`r_lf_ford_*` reaction blocks (confirming "every companion has a word on entering and on how it went" is true here too, not assumed from the pattern).

Not touched: the "As built" snapshot at `:226` ("eighteen regions, fifteen holds; 905 rooms...") and the aside at `:256` calling Fosterfell "the eighteenth region, landed after the last round." Both are explicitly dated to a specific playtest round, and the snapshot already warns its own reader not to trust it without re-measuring ("an earlier draft of this paragraph said 417... do not trust this paragraph"). Correcting only the region count inside a paragraph that disclaims all its other counts would overstate how current the rest of it is; a real re-count belongs to whoever next re-runs the numbers that paragraph itself asks for, not to a docs-only pass.

Docs-only; nothing under `world/`, `src/`, `test/`, or `loop/` touched. `npm run verify` re-run anyway as a sanity check (331 tests, all three worlds green) since the claim being corrected was about world content, even though no world file changed.

### The same search, swept wider: the realm's front door, and a duplicated example that had drifted twice over

Finding one region's map paragraph stale raised an obvious question: is "eighteen regions" stale anywhere else? `grep -rn "eighteen region" docs/ scripts/ README.md` found six more hits. Three are dated citations of one specific past playtest run's numbers (`docs/superpowers/specs/2026-09-08-the-realm-moves.md:12`, `2026-09-08-standing-and-ranks.md:31`, `scripts/audit-play.ts`'s own docstring) — "the proven walkthrough wins in 255 turns having seen 97 of 905 rooms and six of eighteen regions" is a fact about that walkthrough at that time, not a claim about the realm's current size, so all three are left alone on the same bar as everything else this pass has judged historical.

The other three were live, unconditional, current-state claims, and needed fixing:

**`README.md`'s own front-door description** ("a realm of eighteen regions — the Vale of Ash as its first act, fifteen holds each with its own unrested grief, a mountain pass, and a capital where the endings wait") undercounted by one and, worse, would have misdescribed Longford by omission — folding it into "fifteen holds" would wrongly imply it rests, burns, or bargains a grief like the other fifteen, when item 10 built it deliberately not to. Fixed: nineteen regions, with Longford named as its own clause ("a toll crossing with a different kind of trouble") rather than silently absorbed into a count it doesn't belong in.

**A wits-DC illustration duplicated in both `docs/authoring.md` §14 and `docs/region-brief.md`, and both copies had drifted — from the realm's growth, but not from *this* growth.** Both said "the hardest wits check [anywhere/in eighteen regions] is DC 12," illustrating why a DC-13 ability gate once shipped dead. `docs/authoring.md` already carries a runnable command for exactly this question (`§14`, right below the claim); running it verbatim today returns **3**, not 0 — three wits checks at DC 14 or 15 exist (`th_thornwold.json`'s `th_hollow_grave`, DC 15; `cp_coldpass.json`'s `cp_scriptorium` and `sk_saltkerns.json`'s `sk_customs_post`, DC 14 each), so the true current ceiling is DC 15. None of the three are in Longford or any of the ten later regions — this drift predates today's session entirely and is unrelated to the region-count fix above; it was only found because the same "grep for the stale number" habit was pointed at a neighboring claim. Fixed differently in each doc: `authoring.md` keeps the anecdote (a real past incident, the same shape as this session's other "the realm shipped X" callouts) but now says plainly that the DC-12 ceiling was true then, gives the measured DC-15 figure as of today, and tells the reader to trust the command over either number. `region-brief.md`'s shorter copy had no command of its own — the actual bug that let both drift silently together — so instead of re-stating a number that will need updating a third time, it now points to `authoring.md` §14 for the worked example and the command, removing the duplicate rather than patching it twice.

Docs-only; nothing under `world/`, `src/`, `test/`, or `loop/` touched. `npm run verify` re-run anyway (331 tests, all three worlds green) since, again, the claims being corrected were about world content.

### "Known places" is working as designed; the causeway stone's quest stage was not

`queue/P1-issue-c2b703e1.json` (wave 4, seed 98820): "the causeway stone" wasn't
offered among "known places" travel shortcuts until physically discovered, so
status recap gave only "vague hold-level location" for unfound evidence. Two
separate mechanisms were in play, and only one of them was actually broken.

The fast-travel menu is not the bug. `docs/authoring.md` §9 (`:230`, `:530-542`)
and `src/engine.ts` (`:243`, `bearingsHere` `:753-787`) agree, and `test/*`
enforces it (`ok 330 - the nearest landmark by walking wins, and only the ones
you have stood in count`): a `landmark` becomes a "known place" only once the
player has stood in it. That is the whole mechanism, working exactly as
documented — not this bug.

The real breadcrumb path is a quest stage's `at`, and it does not care whether
the target is "known." `pathTo` (`src/engine.ts:806-812`) walks the real exit
graph by BFS to name a room the player has *never seen*, precisely so `status`
can say "(the way there: two south, then in)" before any landmark is visited
(`docs/authoring.md:625-638`, `1003`; `src/engine.ts:661-666`, "it walks to
somewhere the player has *not* been, because that is the case that matters").
`hb_hollow.json`'s `hb_q_evidence` ("Which King") used this correctly for two
of its three states — all-found (`at: hb_kingsrest_throne`) and none-found
(`at: hb_wild_2_0`, the causeway) — but its middle stage, live for the entire
span between finding the first piece and the last, carried no `at` at all:
`{ "if": [["var", "hb_evidence_known", ">=", 1]], "text": "The evidence
doesn't agree with itself yet. Settle on a name, or keep looking." }`. The
moment a player found any one of the three pieces, `status` stopped giving
walking directions to the rest — which is exactly the "vague hold-level
location" the report describes, and matches a report naming the causeway
specifically: it is whichever piece is *not* the one found first.

`world/reach/va_barrow.json`'s `va_verses` (`:812-859`) is the same
three-evidence-then-declare-at-the-throne shape and already gets this right:
every one of the six two-of-three and one-of-three flag combinations has its
own stage naming the nearest remaining piece and an `at` pointing at it. That
is the established convention this report's quest was missing, not a request
for a new mechanism.

Fixed in `world/reach/hb_hollow.json` (`hb_q_evidence`, `:618-664`): the one
catch-all "found ≥1" stage is now six stages, one per two-of-three and
one-of-three combination of `hb_evidence_ringditch` / `hb_evidence_causeway`
/ `hb_evidence_merestone`, each naming the nearest still-missing piece and
carrying `at` for its room (ring-ditch `hb_wild_1_3`, causeway `hb_wild_2_0`,
mere-stone `hb_wild_3_3` — confirmed against each spot's own `cell` in
`world/reach/hb_wild.json` (causeway `:87`, ring-ditch `:573`, mere-stone
`:688`) and the `<id>_<x>_<y>` convention (`docs/authoring.md:517`)). All
eight reachable flag states are now covered
(1 done + 3 two-of-three + 3 one-of-three + 1 none, matching `va_verses`'
shape); text stays 70-79 chars, well inside the 120-char stage budget
(`scripts/lint-world.ts:22`). The `statusTracks` "Old Court Evidence" list
(`hb_hollow.json:717-729`) was left exactly as it was: every hold's evidence
tracker across the realm (`ff_hollow.json:635`, `fl_hollow.json:401`,
`kw_hollow.json:563`, `mc_hollow.json:684`, `pw_hollow.json:509`,
`sh_hollow.json:586`, `va_barrow.json:884`) is a `{flag, label}` checklist
with no `at` of its own anywhere in the realm — the breadcrumb has only ever
lived on the quest stage, by design, and that is where this fix put it.

This is **not** the same ask as `queue/P2-issue-d2780f5c.json` — "Make 'get
your bearings' hints match the actual per-room exit chain exactly, or
auto-offer a multi-step 'travel to' option for named distant landmarks even
before they're 'known'" — even though both are wayfinding reports from this
same wave 4 (P2 from seed 84497 at 15:25, this P1 from seed 98820 at 19:20 —
the wave's two players, both fun 5/clarity 4, independently) and this P1's own
wording ("known places") echoes the P2's. P2-d2780f5c names no region and no
quest; it is a general ask about the fast-travel/
bearings *mechanism* itself — changing what "known" means, or what `bearings`
computes — which `scripts/audit-bearings.ts`'s own live run (0% of legs
"do not lead where they say") suggests is already accurate on the first half
of its ask, and the second half (pre-discovery fast travel) is a real,
bigger feature change this session did not make and P2-d2780f5c correctly
still sits deferred for. This P1's actual cause was narrower and already
fixable inside the existing DSL with no engine change: one quest's authoring
had a gap in exactly the mechanism built to answer this. Noted for the
record, not because the two should merge — they shouldn't, and P2-d2780f5c
stays open on its own, unrelated terms.

`npm run verify` green after the change (331 tests, all three worlds
validate, both crawls clean, `reach.json` walkthrough still wins at
score === maxScore 366). `node --import tsx scripts/lint-world.ts
world/reach.json` — "all text within budget." `node --import tsx
scripts/audit-routes.ts world/reach.json` — no new shut-door exposure
introduced (the pre-existing `va_barrow`/`mg_marrowgate` findings it prints
are unrelated to this change). `node --import tsx scripts/budget.ts
world/reach.json --terse` — avg 439.45/max 1076, unchanged from before
this fix within measurement noise. `queue/P1-issue-c2b703e1.json` moved to
`done/`.

### Wave 4, two more: an unlabeled "go in" at Wardmoor, and a decision the fallback text muddled into one

Two more wave-4 findings, fixed and verified directly.

**`queue/P1-issue-acb54c29.json`**: "the 'go in' action label was reused
inconsistently between rooms (e.g. at Wardmoor North Road, 'go in' silently
routed back to the Record-House instead of entering a new location), causing
a brief backtrack." `world/reach/wm_wardmoor.json`'s three road rooms (west,
east, north) each have their own `in` exit to a different building (the
armoury, the barracks, the record-house), but all three exits rendered as a
bare, identical "go in" — nothing was actually wired wrong, but a player who
had just used "go in" at one road to reach a specific building had no way to
tell, from the label alone, that the next road's "go in" led somewhere else
entirely rather than back to the place they'd already seen. Fixed by giving
each exit its own `landmark` field ("the armoury", "the barracks", "the
record-house" — `wm_wardmoor.json`, the three `north`/`west`/`east` road
rooms' `in` exits), which the menu renderer already folds into the printed
label for any exit that carries one, so "go in" becomes "go in (the
armoury)" etc. with no engine change and no new mechanism, matching how
every other named exit elsewhere in the realm already disambiguates itself.
`npm run verify` green (331 tests, all three worlds validate). Landed in
commit 3df6cdc; `queue/P1-issue-acb54c29.json` moved to `done/`.

**`queue/P2-issue-c545f1aa.json`**: "early on it wasn't obvious that
'promise to seal the barrow' vs the later throne-side 'seal/leave open'
choice were two separate decision points with different companion
consequences — status text implied one decision at the throne." Found in
`world/reach/va_barrow.json`'s `va_doors` quest (`:790-809`, "The Barrow
Doors"): its own first stage, reached once the king is settled, already
states the two-decision structure plainly ("The king is settled. The doors
are yours to seal or leave open, from the throne."), and its
`va_promised_seal` stage describes the early promise on its own terms with
no throne language at all — neither of those was the problem. The
fallback stage, live for the entire span before either the promise or the
king's rest, read "The reeve wants the barrow sealed after; the priest
wants it open. Promise, or don't — you decide at the throne." "You decide
at the throne" reads naturally as *the promise itself* is what gets decided
at the throne, collapsing the two decisions the other two stages keep
separate — exactly this report's confusion, and the one stage of the three
that actually caused it. Fixed by rephrasing to name the doors as the thing
waiting at the throne, not "you": "Promise, or don't — the doors wait at
the throne." Same fact, no longer readable as one decision. 116 chars,
within the 120-char stage budget (was 112). `node --import tsx
scripts/lint-world.ts world/reach.json` — all text within budget.
`node --import tsx scripts/budget.ts world/reach.json --terse` — avg
439.47/max 1076, unchanged (this stage isn't on the proven walkthrough).
`npm run verify` green (331 tests, all three worlds validate, `reach.json`
walkthrough still wins at maxScore 366). `queue/P2-issue-c545f1aa.json`
moved to `done/`.

Both were originally being handled by background agents alongside the rest
of wave 4's triage; a container restart mid-session stopped all seven
agents, and while most of their in-progress, uncommitted work was lost with
them, `git status` after the restart showed these two had already reached
disk in a complete, verified state (acb54c29's fix was caught by an earlier
checkpoint commit, 3df6cdc; c545f1aa's edit was sitting uncommitted but
intact) — confirmed independently rather than assumed, then documented and
closed out by hand. The other five agents' work did not survive and is
being redone.

### `queue/P2-issue-3c4440fb.json` and `7f9e043b.json`: the travel menu's page controls really do drift, and the honest fix costs more than it's worth

A third pair of wave-4 items had already been moved to `done/` before the
restart killed the agent working them, with no roadmap write-up to explain
why. Rather than guess at reasoning that didn't survive, re-investigated
from scratch: `3c4440fb` ("the travel menu's numbered pagination reuses
option numbers across pages... made it easy to misclick") and `7f9e043b`
("cap or reorganize the travel-menu pagination so option numbers stay
stable across pages").

The report is real, not a misreading. `travelActions` (`src/engine.ts:1119-1131`)
pages a long travel list at `pageSize = MENU_CAP - 2` (`10`, `MENU_CAP` is
`12`, `src/types.ts:217`) real entries per page, then appends `travelmore`
and `traveldone` — always last, in that order, but at whatever menu number
follows however many real entries actually rendered. Every full page (10
real entries) puts "more places" at #11 and the way out at #12, consistent
page after page — but the *last* page of a list that doesn't divide evenly
by 10 is short (`list.slice` on a partial remainder), so on that one page
"more"/"done" land at whatever number follows the shorter count instead:
worked example, 23 known landmarks pages as 10 + 10 + 3, and the third
page's "more"/"done" sit at #4/#5, not #11/#12. A player who has learned
"11 is more, 12 is done" from browsing the first two pages meets a menu
where 11 and 12 are simply out of range on the third. This matches the
report precisely and is confirmed directly from the paging math, not
inferred from the player's account alone.

Not fixed. The two honest ways to make the *absolute* number stable both
cost more than this is worth: padding every page to a fixed width so
"more"/"done" always land on #11/#12 wastes visible menu space with blank,
unexplained slots on every partial page (worse than the problem — an
unlabeled gap in a numbered list reads as broken, not merely inconsistent);
computing page width from the total instead of a flat 10 (so every page of
a given list is equal-sized) only fixes lists whose length happens to divide
evenly, and changes `MENU_CAP`-derived pagination behavior shared by every
other paged list in the engine (conversations, perks) for a fix scoped to
one menu. What's *already* stable is the relative position — "more" and
"done" are always the last two entries shown on any page, full or partial —
so a player reading the label rather than recalling a number from the
previous page is not actually misled; the report's own "misclick" describes
acting on a remembered number rather than the label in front of them, which
is a real rough edge but a different, cheaper-to-tolerate one than a
genuine number-reuse bug would be. This is the same "long lists are
awkward to page through" theme `P2-issue-39b85b76` already covers and stays
deferred for (`docs/roadmap.md:3296`, "The travel list's cheap win already
shipped; what's left is a bigger feature") — not a new, separately
actionable bug, and not merged into it structurally, just the same honest
non-fix for the same underlying reason. `queue/P2-issue-3c4440fb.json` and
`queue/P2-issue-7f9e043b.json` stay in `done/` on that basis (their move
predates this write-up but the conclusion independently agrees with it).
No code changed; `npm run verify` untouched by this entry.

### The crossing-warning refinement and the evidence-nearby hint: both already built, from the same mechanism

Four reports, one underlying theme. `P2-issue-5350baa3` (wave 4, `s98820`) is
explicit that the Coldpass crossing warning "already does this well" and
only wants the "16 threads open" count made "clickable/expandable into
names without spending a turn." It already is, and was before this report
was filed. `cp_pass`'s `onEnterOnce` (`world/reach/cp_coldpass.json:36-48`)
fires `questsopen` (`src/engine.ts:1582-1595`), which prints the count and
"Read them in your status before you cross" — and `status`
(`src/mcp.ts:175-187`, "Costs no turn — call it any time... e.g. right
before a major choice") already lists every active quest by name under two
headings, `The road:` (the throughline, which crosses with you) and
`Quests:` (side threads, `src/format.ts:338-390`), each carrying a
`way()`-computed hint (`:364-376`, walking `pathTo` at `src/engine.ts:806`)
naming the route if the target is in your current hold, "(you are standing
there)" if it is the room you're in, or "(in <region name>)" if it's
elsewhere. Checked this isn't just a reading of the code: built a probe
against `renderStatus` directly (not committed — scratchpad only) and
confirmed live output. Standing in Wickstead with one of Names for the
Rite's three pieces found prints `Names for the Rite: Ede's names are
yours. Two sources left: the parish roll at the chapel, and the headland's
markers by the Bone Road. (the way there: one east)` — a free, no-turn,
itemized, located answer, reached through the exact command the warning
already names.

This is the same shape of finding `docs/roadmap.md:3328-3360` already
recorded for `P2-issue-58169e05` ("keep surfacing status/look proactively...
at point-of-no-return rooms like the Pass Gate"), closed there as "already
does more than the ticket asks for." `5350baa3` asks for a strict subset of
that (expand on demand, rather than always shown), which the same `status`
call already covers. The one piece it does *not* cover is flagging *which*
open threads are "hold-local" versus "persist," beyond the road/side
grouping status already draws — and that runs into the same wall
`be79b069`/`fc1a4039` hit before it: the engine has no "which side of this
gate does this quest's `at` fall on" concept, only "which room" (the
`questsopen` case's own comment, `:1584-1588`, already declined to guess at
this for the same reason). Satisfied on the buildable half; the rest is the
harder ask, next. `queue/P2-issue-5350baa3.json` moved to `done/`.

`be79b069` and `fc1a4039` were already triaged this session
(`docs/roadmap.md:2715-2734`): both are one report (`s84498`) asking for a
numeric turn-cost estimate before the crossing; no "turns to resolve a
quest" concept exists anywhere in the engine; the cheap stand-in (a bare
count) doesn't answer the question either ticket actually asks; both stayed
in `queue/` on purpose, "not superseded, not forgotten." Re-checked that
against the current tree rather than trusting the earlier note: still
holds. `way()`/`pathTo` solve walking distance in rooms, which has no fixed
relationship to how much quest content remains — a quest stage can be one
action or the rest of a forty-turn hold, and nothing in the DSL records
which. Answering this for real would mean authoring a turn-cost estimate on
every stage of every quest in the realm (fifteen holds' worth) — a new
metadata surface, not a content edit, and squarely the "new authored
per-quest metadata" bar this cluster was told to leave deferred for.

Does a third report change that calculus? `5350baa3` is a genuinely
separate, independent report (`s98820`) from the one behind
`be79b069`/`fc1a4039` (`s84498`) — so the general "warn me better before
this crossing" theme now has two independent sources, not three (the two
framings of one ask were never two reports, as the earlier triage already
noted). But the two asks aren't the same size: `5350baa3`'s buildable half
is done above, and the part of it that *isn't* buildable is
`be79b069`/`fc1a4039`'s ask restated in miniature. A second independent
report wanting the same infeasible thing is one more data point, not a
change in what it would cost to build — corroboration moved from "1" to "2
independent reports, both wanting a numeric turn estimate specifically,"
worth recording, but it doesn't turn a realm-wide authoring effort into a
cheap fix no matter how many times it's asked for. Both
`queue/P2-issue-be79b069.json` and `queue/P2-issue-fc1a4039.json` stay in
`queue/`, open, on the same "genuine, not yet built" bar as `3ddba1f3`,
`5109e8d6` and `f5fa61c0`.

`P2-issue-1e628263.json` ("surface a lightweight 'unresolved evidence/quest
nearby' hint in the free look/status when standing in a hold that has an
active but not-yet-found evidence piece") is the same mechanism as
`5350baa3`, asked from the other direction — and the Wickstead probe above
already answers it for `status`: the hint is not a separate flag, it's the
ordinary quest-listing line, already there, already free, already pointing
at the nearest remaining piece by name and route whenever the authoring
gives it an `at`. `look` (`src/mcp.ts:161-173`) does not carry this —
`render()` (`src/format.ts:50-159`, shared by `act` and `look`) shows the
room, HUD, inventory and menu, never the journal — but it does not need to:
`status` already covers the identical ground for the identical zero cost,
and is the tool the realm already tells a player to reach for "any time,"
not only at a crossing.

Checked how far that coverage actually reaches rather than trusting the two
holds already sampled. Every hold's evidence-style quest
(`{hold}_hollow.json`, the quest behind its `statusTracks` tracker) was
counted for `at` coverage across its stages: `ff_q_sent_for` 9/9,
`fl_q_names` 7/7, `pw_q_names` 7/7, `sh_q_truce_words` 7/7, `mc_q_prepare`
5/5, `va_verses` 8/8, and `hb_q_evidence` 8/8 (just fixed under
`P1-issue-c2b703e1`, `docs/roadmap.md:3722-3807`). Seven of eight already
carry the pattern this ticket wants, most of them since before this wave.
One gap: `kw_q_round` ("The Hunt's Unfinished Round",
`world/reach/kw_hollow.json:501-524`) has `at` on its 0-worked stage
(`:519-523`) but not its 1-worked or 2-worked stages (`:511-518`) — the same
missing-middle-stage shape the causeway stone had before its fix. Confirmed
live with the same probe technique: standing at Hornhallow's muster court
with one of three ridings worked, `status` prints "One riding is worked.
Two remain: a covert beaten, a stand held, a line cast — do whichever you
haven't." with no route, while its sibling quests on the very next lines
(`The Huntsman's Horn`, `The Old Kings' Hounds`) both carry theirs. Real,
narrow, and fixable the same way `hb_q_evidence` was — but it is a distinct
content gap, not what `1e628263` asks for (a general mechanism, which
already exists and already reaches seven of eight holds), and it is not one
of this cluster's four tickets. Rather than fold an unrelated content fix
into this change, flagged it as a follow-up via `spawn_task` instead of
fixing it inline. `queue/P2-issue-1e628263.json` moved to `done/`: the
mechanism it wants is already built and already covers the great majority
of the realm for free.

No engine or content change landed from this entry, so nothing here moved
the walkthrough — verified anyway, since the claims above lean on exact
numbers rather than "unchanged": `npm run verify` green (typecheck, full
test suite, all three worlds validate, both crawls clean). `node --import
tsx scripts/budget.ts world/reach.json --terse` — avg 439.8699/450, max
1076/1100, unchanged from before this entry (about 10 characters of average
headroom over 269 screens — part of why the crossing warning stays a
pointer to `status` rather than growing an inline list). The status ratchet
(`test/format.test.ts:291-321`, `AVG_MAX` 3650 / `WORST_MAX` 5650) measured
fresh rather than assumed from this document's own earlier figures: avg
3617.13 (~32.9 characters of headroom) and worst 5569 at `mg_hollow_throne`
(~81 headroom) — both thin enough that any new always-on `status` content
is a live risk to the ratchet, which is the other half of why "point at
what already exists" was the right call for `5350baa3` and `1e628263`
rather than adding new lines to either screen. Two files unrelated to this
entry (`world/reach/ir_irondowns.json`, `world/reach/wm_wardmoor.json`) were
already modified in the working tree by other in-flight work before this
entry was written; left exactly as found. `queue/P2-issue-5350baa3.json`
and `queue/P2-issue-1e628263.json` moved to `done/`; `queue/P2-issue-be79b069.json`
and `queue/P2-issue-fc1a4039.json` stay in `queue/`, open.

### Cross-region bearings: Iron Downs' entrance was missing it, Wardmoor's wasn't

`P1-issue-c6335eb5` (wave 4, `s98821`) names two crossings: "the unmarked
path from Camp Gallows to the Iron Downs" and "Wardmoor's parade ground to
the oath-stone/Boot-Track Hollow," both "blind directional wandering...
with no 'get your bearings' available until deep inside the area, unlike
the Vale's Ashwood which had it near the entrance." `P2-issue-c0084337` is
the same report's own restatement ("surface a free 'get your bearings'
option earlier in unfamiliar regions"). A third, older ticket,
`P2-issue-3ddba1f3` (`s717`), sits next to these but asks for something
else: a persistent compass/waypoint note ("the Iron Downs are roughly NNW
of here") layered on top of the existing action, not a placement fix —
already distinguished from this wayfinding cluster at
`docs/roadmap.md:1382-1384` ("a real, separate feature... that nothing here
builds"). The question this entry had to answer: is the new pair the same
ask as `3ddba1f3`, or something narrower `3ddba1f3`'s own triage didn't
already cover?

`bearingsHere` (`src/engine.ts:753-787`) is the mechanism: free (`case
"bearings"`, `:1570-1572`; `freeCustom`/`spentTurn`, `:3138-3142` — `free:
true` skips `s.turn += 1` entirely), and every region places it the same
way — one `{ "label": "get your bearings", "fx": [["bearings"]], "free":
true }` action at the region's own entrance hub (`va_gate_bearings` at the
Vale's gate, `world/reach/va_village.json:15`, one hop from the Ashwood
itself; `th_gate_bearings` at Camp Gallows, `world/reach/th_thornwold.json:180`,
one hop from all three of Thornwold's own entrance roads) plus one at every
walkable cell of the region's procedurally-generated wilderness grid (292
such calls now across `world/reach/*.json`, 290 before this change — one
per grid cell in `em_wild`, `kw_wild`, `hl_wild`, `ff_wild`, `sh_wild`,
`me_wild`, `mc_wild`, `pw_wild`, `wm_wild`, and Iron Downs' own embedded
`ir_downs` grid).

Iron Downs was the real gap. Its entrance hub, `ir_tally_gate` ("Cinderhall
— Tally Gate," `world/reach/ir_irondowns.json:81`, where both of Iron
Downs' entrance roads converge — `ir_south_track` from Thornwold's
`th_north_track`, `ir_east_road` from Wardmoor's `wm_west_road`) carried no
bearings action, and neither did either entrance room itself. The nearest
one was three rooms in, at `ir_headframe` (`:393-410`, a lookout vantage
with its own hand-written compass flavor stacked on a real `["bearings"]`
call: "the Old Cairn out to the north-west, the flooded quarry
north-east... beyond both") — so the pattern was not unknown to this
region, just placed too deep — and the next nearest was the `ir_downs`
wilderness grid beyond that. A player crossing "the unmarked path from Camp
Gallows to the Iron Downs" lands on `ir_south_track` and had nothing to
call on for three rooms, which is exactly the complaint and exactly what
every sibling region already avoids.

Wardmoor's own half of the report does not reproduce against the current
tree. `wm_parade` — the parade ground itself, named in the report — already
carries `wm_bearings`, "get your bearings from the parade"
(`world/reach/wm_wardmoor.json:106-115`), free, reachable in 2-3 hops from
every one of Wardmoor's entrance roads. It is hand-written rather than a
`["bearings"]` call, but its directions ("Opened Cairn one stand north...
four stands north of Highward... one east to the Last Cairn, then north" to
the oath-stone) were independently swept and confirmed correct in an
earlier pass (`docs/roadmap.md:1355-1360`). One hop past it, `wm_wild`
carries the generated, quest-aware version at all 26 of its walkable cells
— it would name Boot-Track Hollow directly the moment the Lost Sentry
side-quest goes active, the one landmark `wm_bearings`'s fixed text doesn't
mention. Whatever the world looked like at the report's filing build
(`9b03554`/`00901427`), the current tree has bearings at Wardmoor's own
gate already, and the report's Wardmoor half does not reproduce there.

Fixed the real gap: added `ir_south_bearings` to `ir_south_track` and
`ir_east_bearings` to `ir_east_road` (`world/reach/ir_irondowns.json:26,65`)
— the exact `{ "label": "get your bearings", "fx": [["bearings"]], "free":
true }` pattern used everywhere else, nothing new invented. Placed at the
two entrance corridors rather than at `ir_tally_gate` itself (the room that
actually plays the hub role `th_settlement`/`va_gate` play in their own
regions) on cost, not principle: `ir_tally_gate` is a 6-7-visit-per-route
convergence room on every proven route, and one extra menu line there
pushed `proofs.regent_deposed` over its own already-elevated ratchet
allowance — "`proofs.regent_deposed: avg 452.1 > 451`" against
`test/budget.test.ts`'s `"reach:regent_deposed": { avg: 451 }` entry — with
no clean, in-scope redundant text on that specific route to trim and pay
for it (`scripts/audit-echo.ts` checked first; nothing it flags sits on
this road's rooms). `ir_south_track` and `ir_east_road` are each visited
once or not at all per proven route, sit at least as close to the region's
border as any sibling region's hub sits to its own, and cost nothing on the
ratchet: `npm run verify` green throughout (typecheck, 331/331 tests, all
three worlds validate and win-prove clean, both crawls clean), and
`scripts/audit-bearings.ts` shows `ir 0 of 81 legs wrong`, the two new ones
included.

Checked how much wider the underlying placement gap runs, per the task's
own ask to look before concluding "one region." Hollowbrook
(`world/reach/hb_hollowbrook.json`, `hb_wild.json`) and Saltkerns
(`sk_saltkerns.json`, `sk_wild.json`) carry zero generated bearings actions
anywhere — hold file or wilderness grid alike — despite `gen` grids the
same shape as every region that does have them (5x5, 6x5). That is a wider
gap than Iron Downs' own, but neither region is named by
`c6335eb5`/`c0084337`, so fixing it is out of scope for this pass; left as
a known gap rather than folded in unasked.

Verdict: this pair was the narrower, cheaper reading — a placement gap in
one region's entrance rooms, not the compass/mini-map feature `3ddba1f3`
asks for. Applying the existing pattern to the two rooms that were missing
it builds nothing toward a persistent bearing-angle note, so it leaves
`3ddba1f3` exactly as open and exactly as unbuilt as before; the two
findings only looked like one theme from the outside.
`queue/P1-issue-c6335eb5.json` and `queue/P2-issue-c0084337.json` moved to
`done/`; `queue/P2-issue-3ddba1f3.json` stays in `queue/`, open.

### Wave 4's last three: a sharper flag on the crown's early choice, and why the hollow-category ask turns out to be realm-wide and already answered four other ways

The last three items in this cluster, redone from scratch after the same
container restart the entry above describes — this cluster's own progress
on them did not survive it either. `queue/P2-issue-a84a2cff.json` and
`queue/P2-issue-eb7652e3.json` are one finding filed twice from the same
report (`s98821`, corroboration 1 each: the suggestion half and the
confusion half of the same crown-tradeoff observation), investigated and
fixed together. `queue/P2-issue-40797457.json` (`s98820`) is unrelated,
investigated separately.

**`a84a2cff` / `eb7652e3`** ("returning the Hollow King's crown... would
later lock out the 'sit the hollow seat with a crown' option... isn't
flagged until you reach the final room"). Walked the actual replay that
filed it rather than guessing at intent: `runs/g1-98821-mu31ecjv.json`,
actions[133] `va_weigh_king`, actions[157] `va_full_rite` ("give back the
crown and speak the verses", `world/reach/va_barrow.json:412-440`),
actions[718] `mg_weigh_doors`, ending `reach_at_rest` (receipt
`reach.98821.586.625.reach_at_rest.4f66fa7b`). The player took the exact
path the ticket names, and the game does already try to flag the tradeoff
right there — `va_full_rite`'s fx already carried a second, parenthetical
`say` on top of its main line, which is precisely the "one clarifying
clause at the point of choice" this cluster is supposed to add when one is
missing. Before this fix, `va_barrow.json:438` read: "(The crown stays in
the Vale; Marrowgate's gray seat will have none.)" The actual gap: that
phrasing is weaker than its sibling action's. `va_return_crown` (crown
only, no verses, `:441-459`) says "(The crown is his again, and no one in
Marrowgate will wear it.)" — a plain statement that nobody, the player
included, will ever wear it there. `va_full_rite`'s version talks about the
*seat* lacking a crown, in language ("Marrowgate's gray seat") the player
has no context for yet — grep confirms "Hollow Throne" and "hollow seat"
are never named anywhere in `va_barrow.json` or `va_village.json` before
this point, so the proper noun doesn't exist for the player yet — and it
never says *the player* is the one who loses the option. `va_weigh_king`
(`:379-387`, the free pre-check the player also used, actions[133]) only
hints at the same fact indirectly, under the *opposite* branch ("Keep the
crown: he grieves on, and a crown can be worn on another seat"), and has no
room to say more (213/220 chars already). This is not a realm-wide
convention violation: the "flag the tradeoff at the point of choice"
convention already exists here — both crown-disposal actions carry a
parenthetical — it's just uneven between two sibling actions, and
`va_full_rite` is also the one the walkthrough itself takes
(`reach.json` `walkthrough[73]`, "give back the crown and speak the
verses"), so this is the highest-traffic copy of the weaker version.
Checked for a broader pattern before treating this as a one-off: no other
cross-region "early item, late unique use" tradeoff exists in the realm to
compare against — `me_covenant_stone` looked like a candidate but is an
unconditional reward of resolving Lantern Holm's hollow, not a
keep-or-give-up choice (`world/reach/me_hollow.json:96-304` moves it to
inventory on every resolution path, cracked only if burned). The crown is
the realm's only instance of this specific shape, so fixing it here doesn't
create an expectation to touch anything else.

Fixed by strengthening the weaker parenthetical to match what its sibling
already says, made explicit about the "sit" action specifically
(`va_barrow.json:438`): "(The crown stays in the Vale for good; you won't
be able to sit Marrowgate's gray seat wearing it.)" — 99 chars, well inside
the 220-char `say` budget (was 69/220), and now stating outright what
`mg_sit_throne`'s own label says at the other end ("sit the throne, wearing
the Vale's crown", `mg_marrowgate.json:1213`). `va_return_crown` and
`va_break_crown` were left untouched: the former is already clear on its
own terms, and the latter — physically destroying the crown underfoot —
doesn't need a foreclosure notice the way "give it back" does, since
nothing about breaking an object reads as reversible.

**`40797457`** ("the distinction between 'rested', 'bargained', and
'burned' hollows... wasn't crystal clear until checking status directly;
the in-scene text sometimes just said 'settles this hold's grief'..."). No
literal "settles this hold's grief" string exists anywhere in `world/` —
read as the report's own paraphrase, not a quote — so went hunting for the
pattern it describes instead of the exact words. Found it, and it's real:
read every resolution `fx` across six holds chosen for spread
(`ir_irondowns.json:591-675`, `fd_hollow.json:120-229`,
`wm_hollow.json:55-266`, `hb_hollow.json:238-328`, `em_hollow.json:69-223`,
`th_thornwold.json:721-899`), and none of their commit-time `say` text uses
the words "rested", "bargained" or "burned" — every one is pure narrative
prose ("The gray goes out of the deep like a held breath finally let go"
for a rest; "eases, like a debt finally acknowledged" for a bargain; "burns
fast and low" for a burn). `node --import tsx scripts/audit-shape.ts
world/reach.json --rites` confirms this isn't cherry-picked: all fifteen
holds share the identical "bargain/burn/rest... by contract" shape the tool
prints for every one of them. Rewriting the moment-of-choice line at every
hold to name its own category would mean touching on the order of 45+
separate `say` strings across 15 files — the "bigger, less proportional
fix" this cluster's own brief warned might be waiting here, for one wave's
single P2 (corroboration 1).

But the ambiguity isn't actually unanswered — it's answered four other
ways, all realm-wide and all pre-existing:

1. **Before the choice** — every one of the 15 holds has its own
   `*_weigh_grief` free action (`fd_hollow.json:288`,
   `ir_irondowns.json:730`, `wm_hollow.json:305`, `hb_hollow.json:440`,
   `em_hollow.json:225`, and ten more, one per hold, same naming
   convention throughout) that states "the rest stands ready", "the burn
   wants...", "the bargain stands ready" in so many words, before the
   player commits.
2. **At the actual gates** — `mg_weigh_doors` (`mg_marrowgate.json:914-947`)
   and the Coldpass stair texts (`cp_coldpass.json:165,826,959,1000`)
   already spell out "three hollows rested" / "hollows burned" /
   "hollows bargained" explicitly, every time; the *gating* language the
   ticket's own title names ("Coldpass/Hollow Throne gating") was never
   actually vague.
3. **After the choice, on demand** — `statusTracks`
   (`world/reach.json:3530-3539`) lists all three counters by exact label
   ("Hollows rested (holds only; a bargain counts)", "Hollows burned",
   "Hollows bargained") the instant `act2_open` is set (early game, at the
   Vale) — exactly the mechanism the report itself says resolved its own
   confusion ("checking status directly").
4. **After the choice, in conversation** — at least one hold
   (`th_thornwold.json:1444-1473`, the "ask what she makes of the glade
   now" topic) has an opt-in NPC reaction that states the category outright
   once asked ("Rested proper" / bargain language / "Burned").

Given a mechanism this consistently built — four independent layers, all
pre-dating this wave — the omission in the fifth layer, the emotional beat
of the resolution line itself, reads as a deliberate choice to keep that
one line free of mechanical vocabulary, not an oversight the other four
layers were meant to cover for. Judged this intentional and out of
proportion to fix at the scope a single wave's evidence justifies — the
same reasoning this project already applied to
`P2-issue-3c4440fb`/`7f9e043b`'s travel-menu pagination (above, "the
honest fix costs more than it's worth"). No content changed for this item.
`queue/P2-issue-40797457.json` moved to `done/` on that basis.

`npm run verify`: the live working tree also carries two other agents'
in-flight, unrelated edits (`world/reach/ir_irondowns.json`,
`world/reach/wm_wardmoor.json` — the wave's Iron Downs bearings and
Wardmoor checkpoint P2s, still being tuned), which pushed
`proofs.regent_deposed`'s own ratchet (`test/budget.test.ts:232`, ceiling
451) over on a combined run. Confirmed this wasn't this change's doing by
re-running the full suite from a clean worktree at this branch's HEAD with
only `va_barrow.json`'s one line applied (`git worktree add --detach`,
`node_modules` symlinked in) — 331/331 green there, both crawls clean,
every world's walkthrough still wins. In that isolation: `scripts/budget.ts
world/reach.json --terse` — avg 439.9814/450 (was 439.8699, +0.11 over 269
screens for the one +30-char line), max 1076/1100, unchanged.
`proofs.regent_deposed` specifically (the one proof besides the walkthrough
that also plays `va_full_rite`): 451.672 avg -> 451.782, `Math.floor` still
451, still inside its 451 ceiling — now with zero characters of headroom
left on that one road, worth knowing for whoever touches that screen next.
The status ratchet (`test/format.test.ts`, "the free status screen stays
inside its own ratchet") is untouched and still passes: this fix is a
one-time scene `say`, not anything `renderStatus` prints. Left
`ir_irondowns.json`/`wm_wardmoor.json` exactly as found, per this session's
own precedent for the same situation, above. `queue/P2-issue-a84a2cff.json`
and `queue/P2-issue-eb7652e3.json` moved to `done/`.

### `P1-issue-c2846cc6.json` and `P2-issue-7ae5e54e.json`: the Watch Checkpoint pays off on nearly every path — the real gap was one uncapped rep cost, now capped at one

Wave 4's `s98821` filed a bug and its own "suggestion" framing of the same
finding against Wardmoor's Watch Checkpoint (`world/reach/wm_wardmoor.json:553-669`,
a `sideTrip` off `wm_north_road`'s east exit, `:392`): "a pure toll/friction
node with no reward or story payoff either way... can cost faction standing
on a natural-1 fail." Read the room's full action list before taking either
half of that at face value.

**"No reward either way" does not hold up.** Four of its seven resolution
actions grant score, xp and `rep_watch` outright: `wm_checkpoint_writ`
(`:568-579`, rep_watch+1/score 2/xp 1), `wm_checkpoint_talk`'s pass branch
(`:580-607`, rep_watch+1/score 3/xp 2), `wm_checkpoint_pay` (`:608-620`, -4
gold for rep_watch-1/score 2/xp 1 — bribing the lawful Watch costs standing
with them, the mirror of paying Thornwold's Free Company toll earning
rep_free+1, `th_thornwold.json:1029-1043` — opposite meanings for the same
coin changing hands, not an inconsistency), and `wm_checkpoint_seal`
(`:642-654`, free, rep_watch+1/score 2/xp 1). The other two "free" passes
are each a payoff of their own, read differently: `wm_checkpoint_trusted`
(`:632-641`) is what an earlier-earned `watch_trusted` flag buys outright,
and `wm_checkpoint_warden` (`:621-631`) sets `or_warden_wm_checkpoint`,
which is read back as a genuine story beat in the realm's warden epilogue
list — "Highward's checkpoint still waves a certain kind of stranger
through without a word of the usual questioning" (`:1818-1820`).
`wm_checkpoint_command` (`:655-667`) stacks a further score 3/xp 2 on top of
any of these for a `watch_sworn` player, and entering the room at all grants
xp 1 regardless (`:559`). The report reads as one path (a failed `talk`)
generalized to "either way."

**This shape is the realm's norm for toll `sideTrip`s, not an outlier.**
`th_toll_stand` (`th_thornwold.json:1021-1102`) is the closest sibling: the
same pay/bluff/standing/class/trusted resolution set, the same modest
score/xp/rep payoff on every path. `wm_courier_hollow` two rooms over
(`wm_wardmoor.json:467-551`) follows the same shape. A pure, payoff-free
toll would be the exception on this road, not the rule, and this room isn't
one.

**The one claim that does hold up: `wm_checkpoint_talk`'s failure was
genuinely uncapped.** Before this fix, its fail branch applied
`["addvar", "rep_watch", -1]` without ever setting `wm_checkpoint_resolved`,
so the action stayed on the menu and every retry could cost another point —
contrast `th_toll_bluff`, the same-shaped action one region over, whose
failure (`th_thornwold.json:1061`) costs nothing at all, or this file's own
`wm_courier_read` (`:516-538`), whose failure also costs `rep_watch` but
sets `wm_courier_resolved` in the same branch, capping it at one.
`src/engine.ts:2186-2193` (a comment on `standingAtRisk`, written for a past
regression) states the principle outright: "A failure taxed once is good
design," and names the wave-seven report that came from a preview repeating
a standing-cost warning while the underlying cost kept re-applying — the
same shape. `docs/authoring.md:166-175` confirms action-sourced checks
(unlike topic checks) already escalate their DC by 1 per failed attempt,
capped at modifier+20 (`escalatedDc`, `src/engine.ts:1207-1231`) — retries
get harder, but nothing capped the *rep* cost itself. This is squarely the
task brief's own third outlier condition, "repeated failure keeps costing
standing with no cap," confirmed by direct inspection of the JSON rather
than inferred from the report alone.

**The label is not dishonest, so it was left alone.**
`docs/region-brief.md:166-167`'s "state the cost in the label" rule and
`test/content.test.ts:34-47`'s enforcement are both scoped to a check
falsely claiming hp-safety; `wm_checkpoint_talk` makes no such claim and the
cost isn't hp. Separately, `docs/authoring.md:134-141` documents that the
engine composes a standing-cost warning into the live menu preview
automatically for any check whose branches move a named faction var
(`costsStandingHint`/`standingAtRisk`, `src/engine.ts:2332-2348`, wired into
`oddsHint` at `:3009-3012`, keyed off `rep_watch: "the Watch"` in
`world/reach.json:3523`) — a player already sees "a miss costs standing
with the Watch" before spending the turn, regardless of what the static
`label` string says. `standingAtRisk` reads the *live* branch of a nested
`if` via `condsOk` (`:2193`) — built to evaluate exactly the once-only-guard
shape used below, so it correctly stops warning once the flag makes the
cost branch dead, rather than going on quoting a cost that no longer
applies.

**Fix** (`world/reach/wm_wardmoor.json:596-604`): wrapped the fail branch's
`addvar` in a one-time guard, the same `["if", [["!flag", "…"]], […], []]`
idiom this file already uses for its onEnterOnce guards (`:371-380`) and
self-read gates (`wm_pell_heaved`, `:211-233`):
```
["if", [["!flag", "wm_checkpoint_talk_failed"]], [["set", "wm_checkpoint_talk_failed"], ["addvar", "rep_watch", -1]], []]
```
First failure still costs `rep_watch` -1 (and the preview still warns about
it beforehand, unchanged); every failure after that costs nothing further —
matching `th_toll_bluff`'s free-retry norm and the engine's own "failure
taxed once" principle. The `say` flavor line is untouched and still plays
on every attempt. No reward invented on any pass/pay path, since those
already have one; no label text changed, since the engine already states
the cost live.

`node scripts/fmt-json.mjs world/reach/wm_wardmoor.json` and `node --import
tsx scripts/lint-world.ts world/reach.json` both clean ("all text within
budget"). `node --import tsx scripts/audit-choices.ts world/reach.json
--prefix wm` shows nothing new: the new flag is set and read in the same
self-contained guard `wm_pell_heaved` already is, which the audit doesn't
flag either. `npm run verify` in the shared working tree briefly went red
on an unrelated concurrent edit (a sibling agent's in-flight
`world/reach/ir_irondowns.json` change pushed `proofs.regent_deposed` over
its ratchet, `test/budget.test.ts:606-610`) — isolated this change alone in
a throwaway `git worktree` at HEAD to confirm it wasn't the cause (331/331
tests, both crawls, mock and measure all clean, exit 0; a full replay of
`regent_deposed` with and without this edit renders byte-identical text at
every one of its 271 screens). The sibling's own fix landed shortly after;
re-ran `npm run verify` in the shared tree afterward and it is fully green
(331/331, exit 0). `queue/P1-issue-c2846cc6.json` and
`queue/P2-issue-7ae5e54e.json` moved to `done/`.

### A loose end from the wave-4 cluster: `kw_q_round` was the same missing-`at` shape as the causeway stone

The point-of-no-return/evidence agent flagged this in passing while
auditing every hold's evidence-style quest for `at` coverage
(`docs/roadmap.md:3920-`, "The crossing-warning refinement and the
evidence-nearby hint") and filed it as its own follow-up rather than
fold it into that fix — a different hold's content, out of scope for a
ticket that wasn't about Kingswood. Picked up directly rather than left
for later, since the diagnosis was already exact.

`kw_q_round` ("The Hunt's Unfinished Round," `world/reach/kw_hollow.json:501-524`)
tracks three ridings by individual flag (`kw_riding_beat`, `kw_riding_stand`,
`kw_riding_cast` — set in `world/reach/kw_wild.json`'s wilderness spots at
cells `[1,2]`, `[5,0]`, `[1,3]` respectively, i.e. rooms `kw_ridings_1_2`,
`kw_ridings_5_0`, `kw_ridings_1_3`), same shape as `hb_q_evidence`'s three
pieces and `va_verses`'s three verses — but its two middle stages read the
aggregate `kw_ridings_worked` count instead of the individual flags, so
neither could carry an `at`: a stage keyed on "how many" has no room to
point at, only one keyed on "which ones" does. `status` gave no walking
directions for the entire span between one riding worked and all three —
the same bug shape as the causeway stone, confirmed live by the same kind
of check that found it.

Fixed by replacing the two count-based stages with six flag-based ones —
every reachable two-of-three and one-of-three combination, matching
`hb_q_evidence`/`va_verses`'s own pattern exactly — each naming the specific
riding(s) left and carrying `at` for the nearest one. `kw_ridings_worked`
itself is untouched (still incremented the same way, still read by
`kw_hollow_grievance`-adjacent content elsewhere); only this quest's own
stage list changed. Text: 58-68 chars, well inside the 120-char stage
budget. `node scripts/fmt-json.mjs world/reach/kw_hollow.json` and
`node --import tsx scripts/lint-world.ts world/reach.json` — all text
within budget. `node --import tsx scripts/audit-choices.ts world/reach.json
--prefix kw` — nothing new flagged. `node --import tsx scripts/budget.ts
world/reach.json --terse` — avg 439.68/450, unchanged (this quest isn't on
the proven walkthrough). `npm run verify` green (331 tests, all three
worlds validate and win-prove clean, both crawls clean).

### The hunter's-gap shortcut into the barrow now says what it costs — the priest's dead-end line was already there and already correct

Two wave-5 P1s, genuinely double-corroborated (`P1-issue-5bf78603.json` and
`P1-issue-8d38bba1.json`, one per player, seeds s3499 and s3498): using the
"hunter's-camp secret gap" to open the Vale barrow doors made the gray
priest's "a blessing for the barrow" topic retroactively moot ("the doors
are already open... say the words yourself") with no warning beforehand.
`P2-issue-a8d0926c.json`, the general framing of the same incident (same
report, s3499 — not independent evidence of a wider pattern), asked for the
standard fix: flag that the standard path is closing *before* the player
commits to the shortcut, not just after.

**The dead end itself is not a bug.** `va_gray_priest` in
`world/reach/va_village.json` has four mutually-exclusive variants of "a
blessing for the barrow" (`:706-724`), gated on `va_heard_oldking` /
`va_barrow_open` / `va_promised_seal` / `va_barrow_blessed`. `blessing_moot`
(`:720-724`, the exact line both reports quote) fires precisely when the
doors are already open by some other means and the blessing wasn't it — a
deliberate, already-written acknowledgment that covers every bypass
(force, loose stone, the hunter's gap, a Warden's shoulder) uniformly, and
it explains itself in-fiction rather than reading as broken. Checked the one
thing that would have mattered more: whether the blessing was ever supposed
to set some quest flag beyond opening the doors, which the shortcut then
silently skipped. It wasn't — `va_prior_rite` (`:105-115`, the Priory's own
equivalent of a blessing) sets exactly the same two flags the normal
`blessing` topic does (`va_barrow_open`, `va_barrow_blessed`), nothing more.
"No mechanical effect" in the reports is accurate and is not a bug to fix;
per the brief, no new consequence was invented here.

**The real gap was upstream.** `va_barrow_field`'s four self-serve ways in —
`va_force_doors`, `va_force_doors_warden`, `va_loose_stone`, and
`va_hunters_gap` (`world/reach/va_barrow.json:42-115`) — none of their `say`
text mentioned foreclosing the priest's blessing, unlike this same content's
counterpart in `world/vale.json`, where every equivalent action already says
so ("no need for the priest's blessing", `world/vale.json:1089,1110,1142,
1160,1176`). `va_hunters_gap` is the one both reports name and the one on
the world's own walkthrough (`"use the hunter's gap under the stone"` —
`world/reach.json`'s `walkthrough` and 11 of 12 endings' `proofs`). Fixed
there only, matching the sibling world's established phrasing: `world/reach/
va_barrow.json:102`, `"Right where the tally said: the stone lifts, and the
gap beneath is worn smooth by years of someone's knees. Wedged in it, a worn
half-token."` -> `"Right where the tally said: the stone lifts and a gap
opens beneath — no need for the priest's blessing. Wedged in it, a worn
half-token."` — 141 chars to 137, so every road that walks this screen got
*cheaper*, not costlier: this screen sits on the tightest ratchet in the
file (`reach:regent_deposed`, 32 characters of slack before this change, 36
after) as well as `reach_burned`, `gray_crown`, `reach_at_rest#scout`, and
`reach_at_rest#devoted`. `crowned_hollow`/`crowned_hollow#bloodied` (a
Warden road) never take this action at all and are untouched.

**Checked and cleared, not touched:** `va_weigh_king` ("weigh what each
choice would mean", `world/reach/va_barrow.json:378-387`, named alongside
the blessing in `8d38bba1`) is the throne-room pre-check for the king's own
fate (rest/slay/keep-crown) — gated on `va_heard_grievance`/
`!va_king_resolved`, no reference anywhere to barrow doors, `va_barrow_open`,
or blessing state. It doesn't go moot from this shortcut; the report names
it because the player used it in the same room on the same run, not because
it shares the bug.

**Left alone, on purpose, scoped to the evidence:** `va_force_doors`,
`va_force_doors_warden`, and `va_loose_stone` have the identical missing
clause and neither report named them — one finding, one focused change, per
the cycle contract. `world/vale.json`'s own "blessing" topic
(`:2250-2256`) doesn't gate on `barrow_open` at all, so revisiting the
priest after a bypass there just repeats the normal opening line harmlessly
rather than dead-ending — a milder relative of the same category, also
unreported, and not the world either quote matches (both are verbatim
`world/reach/va_village.json` text; Reach has been the MCP default since
2026-09-09). Worth a look if a future wave reports any of these by name;
not rebuilt on speculation here.

`node scripts/fmt-json.mjs world/reach/va_barrow.json` (formatter changed
nothing but the edited line). `node --import tsx scripts/lint-world.ts
world/reach.json` — "all text within budget." `node --import tsx
scripts/budget.ts world/reach.json --terse` — `avg 439.6803 max 1076 sum
118274` -> `avg 439.6654 max 1076 sum 118270` (sum down exactly 4, matching
the edit). `npm run verify` green in the shared working tree (331/331
tests, all three worlds validate and win-prove clean, both crawls clean, 0
over-cap menus) — run twice, once before and once after
`fmt-json`, both exit 0. `queue/P1-issue-5bf78603.json`,
`queue/P1-issue-8d38bba1.json`, and `queue/P2-issue-a8d0926c.json` moved to
`done/`.

### `P2-issue-b9bfe109.json`: wilderness compass directions are reciprocal by construction — all 152 core exit pairs checked directly, not just the bearings text

Wave 5's `s3499` (single report, corroboration 1): "south" from one node in
Iron Downs' `ir_downs` grid or Wardmoor's `wm_moor` grid "sometimes led back
the way I'd come rather than continuing a logical loop," making cardinal
backtracking unreliable and "get your bearings" needed constantly. A specific,
checkable claim about exit reciprocity, not this wave's usual UX complaint, so
it got a direct measurement rather than a bearings-audit rerun and a shrug.

**`scripts/audit-bearings.ts` does not check this claim, and says so of
itself.** Its own opening line is "Does 'get your bearings' actually lead
where it says?" (`:2`) — it walks each room's `["bearings"]` macro (or
hand-authored prose) and checks whether the *text a room prints* lands you at
the place it names, in two ways only, NO EXIT and ELSEWHERE (`:25-31`). That
is "does the sign tell the truth," not "is the room graph itself symmetric" —
whether walking `south` and then `north` returns you to where you started is
a different claim the tool never makes. It also already knows this shape of
complaint from three earlier waves (`:4-9`, `done/P1-issue-6e43ac6b`,
`-965d6864`, and a third) — but those were hand-typed bearing strings that
overshot, fixed by replacing them with a computed BFS macro; nothing about
that fix touches raw exit reciprocity. Ran it anyway for context:
`--prefix ir` → 0 of 81 legs wrong; `--prefix wm` → 0 of 78 legs wrong. Real
information (the bearings text this player leaned on "constantly" was
accurate every time it was checked), but it does not clear this report on its
own, exactly as the task brief warned.

**`src/worldgen.ts`'s grid exits are reciprocal by construction, not by
luck.** `expandRegion` assigns a `gen` grid's `north`/`south`/`east`/`west`
exits from one symmetric `open(x,y)` predicate (`:52`): cell `[x,y]` gets a
`south` exit to `[x,y+1]` iff `open(x,y+1)`, and `[x,y+1]` gets a `north`
exit back to `[x,y]` iff `open(x,y)` (`:75-78`) — the same predicate, called
with the two cells swapped, so one can never hold without the other. `links`
(`:84-107`) cannot silently break this: adding an exit throws if the
direction already exists on the origin cell (`:88`), and a `back` exit throws
if it would overwrite one on the target (`:105`) — a link can only occupy a
direction the core grid left empty (a grid edge, or a wall-adjacent side).

**Measured it directly rather than trusting the proof.** A throwaway script
(not committed) loaded the merged, expanded world the same way
`audit-bearings.ts` does (`loadWorld`), read `ir_downs` and `wm_moor`'s own
`gen` defs, and for every open-cell exit checked whether the destination's
exit in the exact opposite direction points back to the origin:

    ir_downs (w=6 h=5, 6 wall cells, 24 open): 70 core N/S/E/W exit pairs checked, 70 reciprocal, 0 broken
    wm_moor  (w=6 h=5, 4 wall cells, 26 open): 82 core N/S/E/W exit pairs checked, 82 reciprocal, 0 broken

152 of 152 (100%). Cross-checked by hand against each grid's own wall layout
too (undirected edges × 2 directions: 19 horizontal + 16 vertical for
`ir_downs`, 21 + 20 for `wm_moor` — 35×2=70 and 41×2=82, exact). Both grids
are irregular walled shapes, not plain rectangles — `ir_irondowns.json:2014`'s
six wall cells notch both edge columns out of the middle row, `wm_wild.json:10`'s
four wall cells notch only the corners — genuinely harder to hold in your head
than a rectangle, but every cardinal pair inside either one goes exactly where
its opposite direction says it will.

**All 7 links (4 `ir_downs`, 3 `wm_moor`) checked individually too**, since a
link is exactly the mechanism that *could* legitimately pair a cardinal word
with a non-opposite return (`docs/region-brief.md:56` allows links to the
settlement, gateways, hollow and stamps by design). Three pair a cardinal
`dir` with its exact opposite as `back`: `ir_downs_2_0`→`north`→
`kw_south_track`/back `south` (`ir_irondowns.json:2018`); `wm_moor_3_0`→
`north`→`wm_oathstone_approach`/back `south` (`wm_wild.json:18-24`);
`wm_moor_0_1`→`west`→`kw_east_track`/back `east` (`wm_wild.json:25`). Two use
the realm's standard non-cardinal `in`/`out` (or `down`/`north`) site-entrance
convention: `ir_downs_3_1`→`in`→`ir_hundred_adit`, `out` back
(`ir_irondowns.json:2017`, `:418`); `ir_downs_0_3`→`down`→`mc_north_road`,
`north` back (`ir_irondowns.json:2019`, `mc_mootcombe.json:300-318`). One
(`ir_downs_2_4`→`south`→`ir_headframe`, `ir_irondowns.json:2016`) carries no
`back` field at all, but `ir_headframe`'s own hand-authored `north` exit
(`ir_irondowns.json:399`) returns to `ir_downs_2_4` exactly — still the
precise cardinal opposite, just authored directly instead of through the
link's `back` shorthand.

**The one asymmetric case is a settlement gate, and it's the opposite shape
of the complaint.** `wm_moor_2_4`→`south`→`wm_parade` (Highward's gate)
returns via `out`, not `north` (`wm_wild.json:17`) — and `wm_parade`
separately has its own, unrelated `north` exit to `wm_hall`
(`wm_wardmoor.json:70`), the Captain-General's hall inside town. So the one
place a naive cardinal opposite doesn't lead back is: walk `south` out of the
moor into Highward, then `north` from the parade ground does *not* return you
to the moor, it takes you deeper into town. That is a false expectation
failing to pay off, on crossing into a settlement, where every other gate in
the realm resets the same way (`ir_hundred_adit`, all four `wm_wild.json`
stamped sites) — not "south led back the way I came," which is what the
report actually describes, and not between two wilderness cells at all.

With the core grids provably and empirically 100% reciprocal (152/152) and
every link either a matching cardinal opposite or the realm's standard
non-cardinal gate convention, there is no exit-reciprocity bug here to fix.
The report reads as genuine disorientation dead-reckoning two irregular,
walled 24- and 26-cell shapes — exactly the situation `get your bearings`
exists for, and "needed constantly to reorient" is that tool being used as
designed, not failing it: its own output was independently confirmed
accurate, 0 of 159 legs wrong across both regions combined.

No `world/*.json` or `src/*.ts` changed, so no `npm run verify` was required;
`loadWorld` re-expanded both worlds cleanly as part of the check above (no
thrown errors), and `audit-bearings.ts --prefix ir`/`--prefix wm` ran clean
for the record (0/81, 0/78). `queue/P2-issue-b9bfe109.json` moved to `done/`.

### Wave five's two P1s: a quarrel's DC checked against the realm's own numbers, and an escalation cap checked against why it already waits for a failure

`P1-issue-234f8306`: the companion "settle it" dispute checks (will, DC 11)
failed 3 of 5 attempts for one player, each miss costing regard with two
companions at once, "right after major grief-resolution beats." `P1-issue-
d3652755` and `P2-issue-c0489d2e` (same report): retrying a forced-try check
raises its DC — well-telegraphed — but the cap it stops at ("stops at
20/23/27") only shows after a failure; asks for "a single upfront mention of
the scaling rule."

**The dispute DC is the realm's own median, not a hard outlier.** Every
companion pair's `try to settle the X (will)` topic — 18 pairs, `_settle` and
its mirror `_settle_b`, one per pair, e.g. `quarrel_lys_osk_settle_b`,
`world/reach/companions.json:1264-1273` — rolls DC 11. A realm-wide census of
every `["check", "will", n]` (157 of them, across `world/*.json` and
`world/reach/*.json`) puts DC 11 at 82 (52%), the single most common value —
DC 9: 8, DC 10: 55, DC 12: 9, DC 13: 3. It is the norm the rest of the
realm's will checks set, not a spike above it.

Each of the 18 disputes offers the same three-way choice, confirmed by exact
count (18 `_settle`/`_settle_b`/`_stay` ids, 18 occurrences of "leave it
between them"): side with one companion outright, guaranteed +2/-2
(`quarrel_lys_osk_side_lys`, `companions.json:1017-1027`); try to settle it,
DC 11 will, success moving nobody's regard and failure costing -1/-1 to both
(`quarrel_lys_tamsin_settle`, `companions.json:1043-1067`); or "leave it
between them," a free, no-roll option that moves no regard and pays 1 xp
(`quarrel_lys_tamsin_stay`, `companions.json:1069-1074`) — the safety valve
this file's own prior entries describe, present on all 18, not a subset. A
missed settle attempt (-1/-1) is strictly cheaper than the guaranteed cost
of picking a side (-2 to the other companion), so attempting it is never the
worse play in expectation, only the higher-variance one.

The double regard cost on a miss is not an oversight — it is the specific
thing two earlier blind waves already litigated. `escalatedDc`'s own comment
(`src/engine.ts:1217-1221`) and `docs/authoring.md:166-175` record it: DC
escalation used to apply to these checks too, and "the companion-dispute
checks already cost regard with BOTH companions on a miss, by design," so a
creeping DC on top of that was the actual trap — the fix that shipped was
exempting every topic-sourced check (`tp:`, `engine.ts:1222`) from
escalation, not touching the DC or the dual cost, both kept on purpose. This
same check's preview was separately re-verified live by this session two
tickets ago (`P2-issue-8d096dce`/`b9dd9dd4`, "A companion quarrel already
shows its odds," this file, line 1386): the odds and both companions at risk
already render before the turn is spent. Against a DC 11 check, 3-of-5
failures needs nothing unusual — binomial at a fair 50% gives ~50% odds of
seeing 3+ fails in 5 tries, and even at the "decent" +1/+2 modifiers the
report claims (55-60% success) it's still ~41%/~32%. Left alone: no premise
error, no outlier DC, an unused free off-ramp on every instance, and a
double-cost shape this project already weighed and kept once. `queue/P1-
issue-234f8306.json` moved to `done/`, no code or content change.

**The escalation cap already tells the general rule upfront, and the exact
ceiling from the first failure that makes it real.** Two things, not one.
The rule that a forced try gets harder is stated once, in the game's very
first line, before a class is even chosen — confirmed live this session,
seed 3498: `"...A forced try gets harder each miss; talk never does. hash
b51c7f6d."` (`src/engine.ts` via `renderIntro`, `src/format.ts:536-553`).
That line exists for the same complaint filed once before: the comment right
above it (`format.ts:546-552`) quotes "Wave eight, seed 9903:
'DC-escalation-on-failure isn't flagged before the first failure...'", and
`docs/roadmap.md:641-642` already records the fix as shipped: "The
escalation rule is stated once, on the line that states the rules, rather
than after the first failure that teaches it." The numeric ceiling itself
("raised N by failed tries, and stops at {ceiling}") prints starting the
*first* time a check's DC has actually climbed — `tries > 0 && dc > chk[2]`
(`src/engine.ts:3004-3007`) — which is what `P2-issue-c0489d2e` literally
asks for, "the first time a forced-try check's DC has scaled past a
threshold." Both halves of this cluster's ask are already shipped.

What's left is the stronger reading of `d3652755`'s title: the exact number
*before* ever attempting the check, not from the first failure. That was
weighed and declined on purpose, not missed — `oddsHint`'s own comment
(`engine.ts:3001-3003`): "Only prints on a check already failed, which is
exactly when it is worth the characters." A related, smaller addition
(repeating a check's skill tag) was found to cost "more slack than four [of
the proven roads] had left" (`engine.ts:2984-2986`) against the same budget
`test/format.test.ts`'s status ratchet has almost none of; printing the
ceiling on every forced-try check's *first* preview, escalating or not,
lands on every one of those screens along the measured walkthrough (which by
construction never retries a failed check), where today's placement only
spends characters on the rarer off-path retry. A per-room one-time hint
before the first attempt — the cheaper middle ground worth naming — would
just repeat the rule the intro already states once for the whole game, for
budget cost with no new information. Left alone: `queue/P1-issue-d3652755.json`
and `queue/P2-issue-c0489d2e.json` moved to `done/`, no code or content
change; `npm run verify` not re-run since nothing in `world/` or `src/`
changed for either ticket in this entry.

### `P1-issue-65675d14` is `d3907169`'s second corroboration — same mechanism, still not a cheap fix

`P1-issue-65675d14` ("'speak with the company' moved from slot 6 to 5 after
a quest completed") reads at first like a fresh, narrower report: a
different trigger (a quest completing, not combat) and a different room
("General UI, multiple rooms" rather than "Barrow Crypt combat"). Checked
whether it is genuinely the same mechanism as `P1-issue-d3907169` — deferred
at `docs/roadmap.md:1187-1220`, "One report, its own proposed fix
unevidenced beyond the report itself, doesn't clear the bar this project
holds engine changes to" — rather than trusting the surface difference.

It is the same mechanism, now evidenced by two different triggers.
`allActions` (`src/engine.ts:2472-2479`) rebuilds a room's whole option list
fresh from the state *now* on every call; `menuNumbers` (`:2424-2427`)
numbers `legalActions` off that fresh list's positions. Whatever condition
makes an earlier-listed action disappear — a quest completing (`65675d14`),
an enemy dying or an item being consumed (`d3907169`) — shifts everything
after it down by one, and a player who presses a number from the previous
screen without re-reading gets whatever now sits there instead.
`d3907169`'s own framing ("generally any combat/interaction with a dynamic
menu") already predicted the broader mechanism `65675d14` now confirms
outside combat entirely. Two independent players — different seeds,
different sessions, different specific triggers — landed on the same code
path. `corroboration` moves from 1 to 2, genuinely independent.

Re-checked whether anything changed the fix's cost since the original
deferral, rather than assuming the old analysis still holds untouched. The
general problem hasn't gotten cheaper, but the picture is more complete than
"nothing exists to help": the project already ships a proven, narrow
mitigation for the *dangerous* version of this exact bug. A conversation
topic marked `"commits": true`, or one that sends a companion away
(`partsWays`), sorts to the end of the conversation's own menu specifically
so a shrinking topic list can never slide it into the number a player has
been pressing (`docs/authoring.md:324-332`, `src/engine.ts:2526-2534`).
Checked one instance live rather than trusting the doc comment alone:
`done/P1-issue-09a3d3db.json` (in `done/` with no roadmap write-up, but it
predates this branch's own history — `c6a1665`, the commit that introduces
it, also introduces `AGENT.md` and `docs/roadmap.md`'s original 535 lines in
the same pass, at Sep 9 01:47 UTC, before `d3907169` was even filed at Sep 9
04:21 UTC — this is the branch's starting baseline, not a casualty of this
wave's restart) quoted exactly this failure on "bury the burn-order (breaks
the oath)." That option is `tanners_proof` in Regent Ysolde's conversation
and carries `"commits": true` today (`world/reach/mg_marrowgate.json:1830-1849`).
The mechanism is live, not aspirational (several other conversation-mode
dialogue tickets already in `done/` from before this branch's history begins
read like the same story; not individually re-audited here, out of scope for
this entry). `roomMenu`'s general, non-conversation branch has the same idea
in miniature: an attack on a peaceable npc is pushed to a `late` list and
appended last (`:2563`, `:2586-2591`, `:2613`), so turning a stranger
hostile can't slide into a pressed number either.

Neither `d3907169` nor `65675d14` is a case either mechanism reaches.
`d3907169`'s collision is an in-combat "attack" against an *already*-hostile
npc versus an ordinary "use dried herbs" — an already-hostile attack sits in
plain document order, not `late` (`:2590`), and item-use entries carry no
sort at all (`:2601-2610`). `65675d14`'s "speak with the company" is the
folded company entry (`:2559-2576`, label at `:2711`), also unsorted,
positioned wherever the first companion falls in room order. Neither report
names an irreversible or costly consequence of the wrong click —
`d3907169`'s is a minor, self-corrected item waste; `65675d14`'s states none
beyond "an accidental wrong selection once." There is no specific high-stakes
action in either report for the `commits`/`late` pattern to attach to, even
if it were extended to ordinary room and combat menus — building that
extension now would be an engine change in search of a finding, not one
grounded in the two reports actually in hand, and exactly the kind of DSL
surface AGENT.md holds to "validator + tests in the same change" for a
change with nothing concrete yet to validate against.

The general fix — non-positional numbering that survives a turn — is
unchanged in size from the original triage: it needs `State` to remember
which number was whose, which touches determinism (`State` must stay a
plain, hashable, replayable value), the crawler and the mock player (both
index the menu positionally), for a benefit that has never been measured
against real players either (`docs/roadmap.md:1209-1218`). A second
independent report of the same low-stakes shape is one more data point, not
a change in what the fix costs — the same conclusion this session already
reached when a third report repeated an infeasible ask (`docs/roadmap.md:3974-3989`,
"one more data point, not a change in what it would cost to build") and when
the travel menu's pagination drift was confirmed real but left alone because
the honest fixes "cost more than this is worth" (`docs/roadmap.md:3869-3918`).
What would move this: a report naming a specific severe or irreversible
consequence from a wrong click in a non-conversation menu — a narrow,
evidence-grounded case the `late`/`commits` pattern could extend to as
cheaply as it already covers conversation topics. Neither report in hand is
that.

Formally re-affirming the deferral with two independent reports now on
record, not fixing. No `src/` or `world/` file touched by this entry;
`npm run verify` untouched (same basis the travel-menu entry used).
`queue/P1-issue-65675d14.json` and `queue/P1-issue-d3907169.json` move to
`done/` together — the same finding, closed on the same reasoning, not left
split between an open ticket and a closed one.

### "Name it" reads last on every guardian's own menu, and it is never behind the fold

Wave five's `P2-issue-62da3e5d`, `P2-issue-909f52a3` and `P2-issue-a6f8313d`
(two seeds, s3498 and s3499) all describe the same thing from three angles:
the Scholar's "name it" (`scholar_name`) reads as buried — "found it by
scrolling to 'more in this room'," "found it by trial," "consider surfacing
it... on the first page." A different complaint from the same ability's
earlier history, "'Name it' isn't the universal free pass it reads as"
(`:3070-3116`, above), was about how OFTEN and how POWERFUL it is; this
wave's three are about where it sits on the screen. Checked as its own
question rather than assumed answered by that entry.

It doesn't paginate. `legalActions`/`allActions` only turn a page once a
room's own list exceeds `MENU_CAP` (12, `src/types.ts:217`, matching
`docs/region-brief.md:165-166`'s "Room menus ≤ 12 always") — `roomPages` is
`out.length > MENU_CAP && ways + 2 <= MENU_CAP` (`src/engine.ts:2642`).
Checked all four fixed-room `pierce` hostiles directly (of the realm's
eight; the other four — `hb_wandering_wight`, `wm_lost_sentry`, the hound of
the hunt, the glass-ash wraith — are `room: null` chance-ambushes that land
in whatever generic wilderness cell the player already stands in, not a
fixed room to audit the same way) by constructing a Scholar's state at each
room and calling the engine's own menu functions directly (`legalActions`,
`allActions`), cross-checked live in the mcp surface at the actual reported
seed, 3498, for `va_crypt`:

- `va_crypt` (barrow-wight, `world/reach/va_barrow.json:299-345`, wight at
  `:648-664`): 9 of 9, no page.
- `mg_old_crypts` (honour guard, `world/reach/mg_marrowgate.json:780-852`,
  guard at `:4329-4345`): 6 of 6.
- `th_hollow_gate` (gray sergeant, `world/reach/th_thornwold.json:596-672`,
  sergeant at `:2425-2447`): 7 of 7.
- `hb_kingsrest_hall` (grave-wight, `world/reach/hb_hollow.json:490-512`): 7
  of 7.

All four sit 3 to 6 slots under the cap. "Found it by scrolling to more in
this room" does not reproduce in any of them.

What is true: "name it" is the literal last line on all four menus, after
"attack" every time. Not a per-room accident — `scholar_name` is a
`world.abilities` entry (`world/reach.json:238-247`, spending `res_scholar`,
capped 2, `:183`), and `roomMenu` appends every ability after all of a
room's own content on purpose: "abilities are not tied to this room, so they
read last: a room's own content — its actions, its people, its things —
always comes first" (`src/engine.ts:2614-2615`). A room's own authored
peaceful checks — `va_slip_past`, `mg_slip_guard`/`mg_guard_will`,
`th_slip_sergeant`/`th_answer_sergeant` — are `room.actions`, pushed before
the npc loop (`:2570-2571` vs. the attack push at `:2590`), so they already
land ahead of "attack" everywhere; only the engine-appended items ("leave X
be," `:2598-2599`, and every ability) land after it. There is no per-room
list to reorder `scholar_name` on — its position is set once, realm-wide, by
the ability-appending rule itself, exactly the "engine-wide sorting
behaviour" this pass was told to leave alone.

("Pilgrim," in `62da3e5d`'s list, isn't a fourth `pierce` guardian — no npc
by that name carries `pierce`. The nearest match is the Pilgrims' Shrine's
frozen pilgrim, a `$saint_shade` chapel stamp (`world/reach/templates.json:1162`,
dressed in at `world/reach/cp_coldpass.json:1699-1713`), which the earlier
"universal free pass" entry already confirmed carries no `pierce` field at
all — its own peaceful path is a different mechanism, `$rite_named` ("end
the vigil by its true name," `templates.json:1086-1098`), gated on a
Scholar having read the sill first (`$sill`, `:992-1003`). Thematically the
same idea, mechanically unrelated; the report most likely folds both under
"lore-based pacification.")

Looked for a cheaper lever than reordering an engine-wide rule before giving
up: the realm already has a one-time, engine-level hint for exactly these
npcs — the first time ever a `pierce` hostile stands in the player's room,
`_seenPierce` fires once and never again (`src/engine.ts:3405-3417`), almost
always at `va_crypt` on turn 1's own content. Extending its text to point a
Scholar at "name it" would touch one string in one place rather than eight
rooms — except `va_crypt` is the single tightest room in the whole budget
economy, not an ordinary one to spend on. `test/budget.test.ts`'s own ledger
names it outright: "the one room still standing in the way is `va_crypt`, a
fight screen kept at width by design," and `scripts/budget.ts world/reach.json`
(this session, before any change here) shows why — `crowned_hollow#bloodied`,
one of the nine proven roads it ratchets, already sits at 1295/1100
characters on that exact room, 195 over its own ceiling. Every past addition
to this budget (fast travel's labels, the wits/grace DC9 floor, the
`mg_hollow_throne` redundancy cut) needed its own paid-for-elsewhere offset
recorded in that file; a hint extension here would need the same, for three
single-corroboration reports about one class of encounter. Not spent.

Real, on all three counts (name it does read last; that is by a deliberate,
realm-wide rule; and the one cheap-looking lever costs more than it looks
like), and disproportionate to fix from here: the only two levers that would
actually move it are an engine-wide ability-ordering change (explicitly out
of scope) or budget surgery elsewhere in the file to afford touching the
realm's tightest room — the same "real feature, disproportionate to one
wave's evidence" bar the Hollow Throne and original "name it" entries above
were already held to. No `src/` or `world/` file changed by this entry.
`queue/P2-issue-62da3e5d.json`, `queue/P2-issue-909f52a3.json` and
`queue/P2-issue-a6f8313d.json` move to `done/` together — the same finding
from three angles, closed on the same reasoning.

### Rest exists in every region's own hearth, and none of them ever say so

`P2-issue-a5686d21`: the party-heal-at-rest mechanic is never surfaced
before a wounded party can walk into something like the honour guard. The
ticket's own framing pointed at `world/vale.json` for where this is taught;
checked first, since it changes where the rest of the investigation looks.
That file is the realm's retired prototype — "the original compact world,"
kept only for regression (`README.md:217-218`, loaded in
`test/player.test.ts:25` alongside `lighthouse.json` and nowhere else) — not
what any playtester, including this wave's, has played since 2026-09-09
(`docs/roadmap.md:3696`, above). The seed this ticket cites (3498) is a
`world/reach.json` run, confirmed by replaying it: `new_game(seed: 3498)`
opens on "The Gray Reach," not "The Vale of Ash." The Vale's actual
settlement, in the live world, is `world/reach/va_village.json`.

It's there, and it works exactly like the ticket describes wanting:
`va_inn`'s "rest by the fire" (`world/reach/va_village.json:106-119`, full
heal) sits two rooms from the game's own start (`va_gate:3-23` south to
`va_square:24-105`, west to `va_inn`). Marrowgate carries the same
convention, not a gap unique to the honour guard's own approach:
`mg_hanged_man`'s "take a room and sleep" (`world/reach/mg_marrowgate.json:84-97`,
also a full heal) is that region's equivalent.

Neither is ever named before a player finds it by walking in. Replayed seed
3498 from turn 1 as Scholar to check directly: the intro names hp0 as death
and nothing else about recovering it; the one free, contextual hint offered
at the very first room, "get your bearings" (`bearingsHere`,
`src/engine.ts:753-787`), names up to `BEARINGS_CAP` (`:701`, 3) nearby
landmark rooms and open quest destinations — and `va_inn` carries no
`landmark` field, so bearings never names it even in passing. The one other
general mechanism that reads the player's own hp, `lowHp` (`fightGoingBadly`,
hp at half or less, `src/engine.ts:379-382`), gates exactly two lines of
companion dialogue, approval-locked behind `appr_lys`/`appr_tamsin >= 8`
(`world/reach/companions.json:146,2863`) — not a general "you're hurt"
nudge anybody reaches early or reliably.

Checked the honour guard's own doorstep directly rather than assume it's
silent the way the ticket frames it: `mg_old_crypts`
(`world/reach/mg_marrowgate.json:780-852`) already names the guardian in its
own desc — "A shape in gray mail stands where the gray runs thickest: the
first Reeve's honour guard, four hundred years at his post" — so a
first-time visitor is told a fight is there, just not that rest exists
nearby; the fallback fix on the table was conditioned on a room giving zero
danger signal, which this one doesn't. Its immediate approach, `mg_cistern`
(`:691-718`), gives neither. And the nearest rest actually reachable from
this branch, `mg_first_reeves_tomb`'s "rest a while by the lid"
(`:853-872`), sits PAST the guard, locked behind
`mg_guard_passed`/`calm_mg_hollow_guard` — not a rest stop before the fight
at all. The region's real pre-fight rest, `mg_hanged_man`, is several rooms
away on the surface streets, off `mg_lower_town`, not on the undercity route
into the crypts — so the locally-scoped version of the fix ("a short
clause... reminding the player rest exists") would have to send the player
several rooms backward across the map, a weaker and muddier hint than
"nearby" suggested before checking the map.

Budget checked before weighing any of this further: `scripts/budget.ts
world/reach.json --terse` (this session) reads avg 439.6654/450, max
1076/1100 over 269 screens — 2,780 characters of total slack before the
average ratchet breaks, in principle room for a short clause. But
`mg_old_crypts` is already one of the walkthrough's five biggest single
screens (919/1100, its own "go north" step) and, per the entry above,
guardian rooms are demonstrably the most budget-contested screens in the
realm. Spending any of that on a geographically weak hint, for one
uncorroborated report, isn't the trade this budget has been kept tight for.

The real shape of the finding is realm-wide, not honour-guard-specific:
every region's own hearth is a walk-in-and-discover mechanic, and none of
them announce themselves anywhere, consistent with how this realm generally
teaches everything else (including "name it," above) — one report about one
encounter doesn't justify a realm-wide tutorial addition, and the
locally-scoped fallback on the table turns out, once the map is checked, not
to actually sit next to the fight it would be warning about. Real,
disproportionate to fix from here. No `src/` or `world/` file changed.
`queue/P2-issue-a5686d21.json` moves to `done/`.

### The twenty-third: `hb_q_covenant` was the one Rowan-anchored quest in Thornwold that never inherited its siblings' `failed` clause

`queue/P1-issue-2af81992.json` (wave 5, corroboration 1): Keeper Wren's "Two
Keepers, One Covenant" quest (find Rowan in Thornwold's Understory) "became
uncompletable after I settled Thornwold's grief by reading the hanged names
instead of visiting Rowan, but the quest log still lists it as open/pending
rather than marking it closed." Same shape as this session's other
twenty-two done/failed-asymmetry fixes (`docs/roadmap.md`, "The Three Verses
could stay 'active'..." and "Four more quests with the same shape"): `done`
satisfied by only one branch of several mutually-exclusive resolutions, no
`failed` for the rest.

`hb_q_covenant` (`world/reach/hb_hollowbrook.json:1483-1497`, "Two Keepers,
One Covenant") starts on `hb_asked_rowan` (set by Keeper Wren's own
`wren_rowan` topic, `:938`, "ask if any keepers remain elsewhere") and its
`done` was a bare `["any", [rb_hb_th_verse, rb_hb_th_token,
rb_hb_th_refused]]` — three flags set only through Keeper Rowan's own reply
to Wren's question (`world/reach/th_thornwold.json:2518-2554`, the
`rowan_send_verse`/`rowan_lesser_token`/`rowan_owe_nothing` topics), no
`failed` at all. `th_rest_names` ("read the names cut into the tree",
`:771-805`) — the report's own "hanged names" — sets `th_hollow_done` like
every one of the Gallows Glade's other six resolutions (pardon, Great Rite,
verse, rest-oath, bargain, burn, `:722-932`), none of which touch any
`rb_hb_th_*` flag or Rowan at all, so settling the glade this way left the
covenant question permanently unasked.

The exact convention this family established already exists in the same
file, for the same npc: `th_q_understory` ("The Hidden Root", Rowan's own
verse-teaching quest) and `th_q_pardon` ("The True Pardon") both already
carry `"failed": [["flag", "th_hollow_done"], ["!flag", "<their own done
flag>"]]` (`th_thornwold.json:3202`, `:3225`) — pre-existing design, not one
of this session's 22, but the identical shape: once the glade's grief is
settled any other way, a still-open Rowan/Understory thread closes rather
than dangling. `hb_q_covenant` is a third quest anchored on the same room
(`th_understory_hall`) and the same npc, laid on top from a different
region's file, and was the one sibling that never got the same clause.
Confirmed live rather than assumed, with the engine's own `journal()`:
forcing `hb_asked_rowan` + `th_hollow_done` + `th_hollow_rested` (the
report's exact path) and no `rb_hb_th_*` flag left status reading
`"active"`, hinting at Understory Hall forever — precisely the report's
complaint, and true of the other two non-Rowan resolutions (burn, bargain)
as well, not only the one the report happened to name.

Fixed by extending `done`'s own three flags into the sibling shape:
`"failed": [["flag", "th_hollow_done"], ["!flag", "rb_hb_th_verse"],
["!flag", "rb_hb_th_token"], ["!flag", "rb_hb_th_refused"]]`
(`hb_hollowbrook.json:1487-1492`) — `th_hollow_done` anded with the negation
of every `done` disjunct, plain top-level conjunction rather than an
`all`/`any` wrapper, matching `condsOk`'s own array-is-AND semantics
(`src/engine.ts:412-413`). `done` is still checked before `failed` in
`journal()` (`src/engine.ts:585-586`), so a player who reaches Rowan even
after settling the glade another way still completes the quest normally
instead of staying stuck "closed" — checked directly, not assumed: forcing
`th_hollow_done` + `th_hollow_burned` + `rb_hb_th_verse` together still
reads `"done"`.

`test/realm.test.ts:428-443` gets the dedicated forced-state case the
family's earlier fixes used (`:298-344`, `:383-413`): the report's own
hanged-names path, the two other non-Rowan resolutions, all three of
Rowan's own answers still completing it, and the ordinary in-progress state
still reading `"active"`. `npm run verify` green (332 tests, all three
worlds validate and win-prove clean, both crawls clean — `world/reach.json`
walkthrough unchanged at 240 turns since `hb_q_covenant` sits off the
proven path). `node --import tsx src/crawl.ts world/reach.json` clean on
its own. `node scripts/fmt-json.mjs world/reach/hb_hollowbrook.json` and
`node --import tsx scripts/lint-world.ts world/reach.json` — all text
within budget (the fix adds conditions only, no `say`/text).
`node --import tsx scripts/budget.ts world/reach.json --terse` — avg
440.16/450, unchanged. `queue/P1-issue-2af81992.json` moves to `done/`.

### Wave 5's "tell me sooner" cluster: the company-cap note moved to the first recruit, Coldpass's warning got its missing word, and two claims were already answered

Five single-report items, all "the game doesn't surface X early/clearly
enough." Read each against the actual text before assuming a shared fix;
they turned out to need three different dispositions.

**`50d10bc2` / `f8e8fbae`** — one report (`s3499`), filed twice: "surface
the 'recruit every companion' hint at the very first offer" and its
confusion-framing twin, "it doesn't say so until you've already recruited a
couple and it surfaces as a passive note." The "passive note" is real and
exact: `src/engine.ts`'s `party`/`join` case already answers a companion-cap
question from a past wave (seed 7664, "I kept recruiting (ended with 4) and
was never told if that was a soft or hard limit") with a one-time line —
but gated at `s.party.length === 2`, i.e. only after a *second* recruit,
with `test/party.test.ts:1164-1190` explicitly asserting "one companion is
not yet a company." `s3499` is the same gap restated: still after the fact,
just less after than never.

Moved the gate to `=== 1`. This looked free — same one-time line, said
earlier, no net growth — and `scripts/budget.ts world/reach.json --terse`
agreed (avg unchanged at the walkthrough). It wasn't: `npm run verify` went
red on `test/budget.test.ts`'s per-proof ratchet,
`proofs.regent_deposed`/`proofs.gray_crown`/`proofs.crowned_hollow#bloodied`
all over. Root cause, confirmed by isolating the change alone against a
clean `git worktree add --detach` of HEAD (this is a shared tree; two other
agents' in-flight edits were sitting in it at the time, so isolation
mattered) plus a standalone replay script reading `world.proofs` directly:
the walkthrough is the *only* proven road that ever recruits a second
companion (`test/budget.test.ts:385-386` says so outright), so every other
ending proof had never once paid this line's cost — and three of them were
already sitting exactly on their ratchet with nothing spare
(`regent_deposed` 451.88/451, `gray_crown` 452.51/452,
`crowned_hollow#bloodied` 523.10/523, all carrying "avg still owed" debt
from earlier cuts). At `=== 1`, all of them pay it. The full line ("Nobody
limits your company: everyone who will come may come, and they answer more
of the road the more of them there are.", 123 chars) broke all three; the
tightest, `regent_deposed` at 271 screens, had room for about 32 characters
before its floor ticked over, not 123.

Looked for the money elsewhere on those three roads first, the way fast
travel's fix did (`test/budget.test.ts:45-56`) — nothing redundant to trim
on `mg_hollow_throne`, `va_throne` or `va_crypt` for this — so the line
itself paid for it: cut to `"(No party cap.)"`, 15 chars, empirically
re-measured (not estimated) against all three proofs directly rather than
trusted from the arithmetic, which turned out to be slightly off from the
real per-screen numbers. Final margins: `regent_deposed` 12 characters of
headroom, `gray_crown` 108, `crowned_hollow#bloodied` 29 — all comfortably
green rather than exactly on the line. `test/party.test.ts:1164-1190`
updated to match (asserts the note now fires on the *first* recruit, not
the second) and reworded its string checks off the trimmed text.
`npm run verify`: 332/332, all three worlds validate and win-prove, both
crawls clean (0 over-cap menus). `scripts/budget.ts world/reach.json
--terse`: avg 439.75/450, max 1076/1100. `queue/P2-issue-50d10bc2.json` and
`queue/P2-issue-f8e8fbae.json` moved to `done/`.

**`d1633b19`** — "a short reminder near Coldpass that companions' own
personal arcs, not just generic side quests, get locked out permanently."
Overlaps `be79b069`/`fc1a4039` (`docs/roadmap.md:3959-3989`, "before the
crossing, a numeric turn-cost estimate") only in theme, not in size: those
two ask for a turns-remaining estimate the engine has no concept to build
(no per-stage turn-cost metadata anywhere in the DSL) and stay open on
purpose, "genuine, single-report, nothing built yet." `d1633b19` asks for
something narrower — not an estimate, just that the existing warning's
referent be unambiguous — and the existing warning already exists:
`cp_pass`'s `onEnterOnce` (`world/reach/cp_coldpass.json:46`) already fires
"A companion's grief left unfinished there stays unfinished unless you walk
back for it" for free on first arrival, before `questsopen`'s open-thread
count. The word doing the ambiguous work is "grief" — used throughout the
realm as the mechanical term for a *hold's* hollow ("hollows rested",
"this hold's grief", fifteen holds' worth of it) far more often than for a
companion's own backstory, so "a companion's grief" reads, on a first pass
primed by everything a player has read up to Coldpass, as "a hold's grief
that a companion tends" rather than "the companion's own unfinished
story" — exactly the two readings this ticket's "not just generic side
quests" is trying to tell apart.

Checked whether the realm's own vocabulary already disambiguates this
anywhere, rather than guessing at a rewrite: it does.
`world/reach.json:16` (the Act 1 objectives text, shown by `status` from
turn one, before any hold is even entered) states the identical fact with
one extra word: "A companion's **own** grief is settled in a hold, and past
Coldpass it stays as it is." — and separately, `world/reach/companions.json`
confirms all four companion-arc quests (`q_lys:5266`, `q_osk:5296`,
`q_tamsin:5318`, `q_vell:5344`) name "before Coldpass" outright in their own
early-stage text, reachable through the exact command the gate's own
warning already points to. So the fix the realm's own text already
demonstrates is the word "own." Added it to both places this exact sentence
appears — `world/reach/cp_coldpass.json:46` (the Pass Gate) and
`world/reach/sk_saltkerns.json:103` (the Smugglers'-Stair alternate route
under the pass, same sentence, same fix, for consistency) — "A companion's
**own** grief left unfinished there stays unfinished unless you walk back
for it." +4 characters each, well inside the 220-char `say` budget
(129→133/220 and 185→189/220; `scripts/lint-world.ts` confirms "all text
within budget"). No test asserted the old exact string. `queue/P2-issue-
d1633b19.json` moved to `done/`.

**`58397108`** — "the threshold for 'hollows rested' (bargains count, burns
don't) versus the separate 'Old Court Evidence'/'Crypts laid to rest'
sub-trackers wasn't clear until reading status closely." Two claims folded
into one ticket; they get different answers. The first half — rested vs.
bargained vs. burned — is the *identical* claim `P2-issue-40797457`
(`done/`, written up at `docs/roadmap.md:4220-4278`) already investigated
and judged answered four pre-existing ways, one of them this ticket's own
"checking status directly": `statusTracks`' exact label
(`world/reach.json:3533`, "Hollows rested (holds only; a bargain counts)")
is the very mechanism cited there. Confirmed rather than re-argued; no new
reasoning needed.

The second half is not the same claim and isn't covered by that write-up:
confusion between the realm-wide `hollows_rested`/`burned`/`bargained`
counters and per-hold sub-trackers like "Old Court Evidence"
(`world/reach/hb_hollow.json:717-728`, Hollowbrook's own evidence-gathering
progress) or the unrelated cross-hold "Crypts robbed"/"Crypts of the dead
laid to rest" theme (`world/reach/templates.json:1309-1317`, chapel-looting
flavor scoring with nothing to do with hollow resolution). Built a direct
probe rather than reasoning from the schema alone: seeded a state with
`hb_entered`, one evidence flag, and a nonzero `crypts_robbed`, then called
`renderStatus` for real. The output stacks all five, unlabeled and
ungrouped:
```
Hollows rested (holds only; a bargain counts): 2/15
Hollows burned: 1/15
Hollows bargained: 0/15
Old Court Evidence: 0/3 (unexplored: the causeway stone, the mere's answer)
Crypts robbed: 1/4
```
A first-time player has no textual cue here that the first three gate
Coldpass and the ending while the fourth is quest-local prep feeding into
one of those three, and the fifth is unrelated entirely — three different
kinds of number in one flat list, sharing "hollow"/"grief"/"rest"
vocabulary throughout the realm. Real and narrower than `40797457`, not the
same finding wearing its clothes.

Not a one-clause fix, though. `renderStatus` (`src/format.ts:297-328`)
walks `world.statusTracks` as one flat, ungrouped array with no section
concept — closing this honestly means either a new "section" field on the
statusTrack schema (validator + tests + a render change, the "new DSL op"
bar `AGENT.md` sets) or relabeling every per-hold evidence tracker across
eight-plus files for consistent disambiguating language, neither of which
is a single short clause. Left open, undecided the honest way: no content
change, `queue/P2-issue-58397108.json` stays in `queue/` (not `done/` —
the residual claim is real and unbuilt, the same bar this document already
holds `be79b069`/`fc1a4039`/`3ddba1f3` to).

**`ea62cecc`** — "party regard, standing with factions, and holds rested
all interact with the ending gating... this only becomes clear via status,
which the tutorial mentions but doesn't emphasize as essential reading."
Checked the actual intro/tutorial text first: `renderIntro`
(`src/format.ts:536-556`) prints `world.intro` plus one dense rules line
ending "look(s)/status(s): free recap: scene, quests, items, every path —
no turn," then the class menu. Measured it rather than assumed a rewrite
was cheap: `renderIntro(world, state, events).text.length` for `reach.json`
at seed 1 is **1,373 of the `INTRO_CHARS_MAX` 1,400** ratchet
(`test/budget.test.ts:19,332`) — 27 characters of headroom, nowhere near
enough for a clause naming three interacting systems.

But the claim's own premise — that this "only becomes clear via status" —
undersells what `status` already does, and it's reachable from turn one,
not buried. `world.objectives`' Act 1 stage (`world/reach.json:16`, shown
by `renderStatus`'s first line before any hold is entered) already states
companions ("as many as will come... A companion's own grief..."), faction
standing ("opens and closes doors"), and the hollow threshold ("three
hollows settled opens the road to Marrowgate") together, in one paragraph,
for free, no turn spent. The Act 2 stage (`world/reach.json:12`, shown from
the moment the wider realm opens — typically well under 40 turns in) goes
further and states the *exact* ending formula this ticket says isn't
obvious: "the Hollow Throne's rite wants those three, the Vale's king at
rest, and the first Reeve's confession" — word for word the "3 hollows
rested + king rested + confession" the ticket asks to be surfaced. Faction
standing has its own dedicated `statusPaths` section
(`world/reach.json:3464-3521`) and party regard its own labeled `Party:`
line, confirmed live in a real `renderStatus` call ("Party: Lys (regard +1,
hp 10/10)"). Separately, `status`'s own MCP tool description
(`src/mcp.ts:179`) already tells the *player* — not just the narrative — to
call it "any time... e.g. right before a major choice."

So the underlying need (learn the gating early, cheaply) is already met,
through the exact command the intro already names; the literal ask
(make the intro *itself* say more) hits a hard, near-zero budget wall
un-related to how big the idea is. Same shape as this session's other
"already-built, needs pointing at" findings (`40797457`, `5350baa3`,
`58169e05`, `1e628263`) rather than the "genuinely nothing built yet" shape
(`be79b069`/`fc1a4039`/`58397108` above). No content change.
`queue/P2-issue-ea62cecc.json` moved to `done/`.

Only `50d10bc2`/`f8e8fbae` and `d1633b19` changed any file; both verified
together above and again standalone: `npm run verify` 332/332 green, all
three worlds validate and win-prove, both crawls clean, 0 over-cap menus.
`node --import tsx scripts/lint-world.ts world/reach.json` clean ("all text
within budget"). `node --import tsx scripts/budget.ts world/reach.json
--terse`: avg 439.75/450, max 1076/1100. Files touched: `src/engine.ts`,
`test/party.test.ts`, `world/reach/cp_coldpass.json`,
`world/reach/sk_saltkerns.json`. `58397108` and `ea62cecc` and the
`50d10bc2`/`f8e8fbae`/`d1633b19` trio account for all five queue items
this entry covers; `be79b069` and `fc1a4039` were re-read, not
re-investigated, and stay exactly as `docs/roadmap.md:3959-3989` left them.

### Wave six's stuck player: an escalation cap re-derived from first principles, and a corridor's dry stretch found and left alone a second time

Four tickets, one report: a wave-six player who never reached an ending
(verdict `stuck`, 600 turns, `verified_reports: 0` on all four — the
trace-check has nothing to confirm them against, so each is weighed as a
single unconfirmed account rather than a proven repro). Two themes, both
already-examined mechanics in this session's own history, checked again from
scratch against the live code rather than assumed settled.

**Theme 1 — `P1-issue-8f4a284d` and `P2-issue-987e24b0`, DC creep "with no
way to walk away… besides switching stats."** `escalatedDc`
(`src/engine.ts:1207-1231`) is keyed on `s.checkAttempts[sourceId]`
(`src/types.ts:556`), and that counter genuinely never resets: it is only
ever incremented, on a miss (`engine.ts:1486`), starts empty at a fresh game
(`:2040`), and is carried forward untouched by every state clone
(`:3123`) — no code path anywhere deletes or decrements an entry, so leaving
a room, resting, or any other in-game event never rolls it back. This is not
an oversight; `docs/authoring.md:146-147` says it outright: "The counter
never resets (a success does not clear it, and neither does leaving and
coming back), but it is capped, not open-ended." The cap
(`baseDc > reachable ? raised : Math.min(raised, reachable)`, `reachable =
mod + 20`, `engine.ts:1225-1231`) is the actual answer to "can this spiral
out of reach": `checkMod` (`:448-453`) sums `world.skills` (unset anywhere in
`world/reach.json`, so 0), the player's own attribute, and perk/condition
bonuses, and a realm-wide grep for a negative `checks`/`bonus.check` entry
came back empty — nothing in `world/` ever pushes a check modifier below its
base attribute. `reachable` is therefore never less than 20, so any check
authored at or under DC 20 (which covers the wind-carvings and water-verse
puzzles at DC 9 and DC 8) can never rise past "a natural 20 still lands it" —
worst case is a floor of 5% per attempt, forever, not zero. The one way a
check ever exceeds the cap is a base DC the author already set above
`reachable` before any failure ever happened — a pre-existing "not without
help" gate, unrelated to escalation and not what either ticket describes.

Checked the named example directly rather than trust the report's framing:
the wind-carvings puzzle (`world/reach/va_wood.json`, room `va_watchtower`,
lines 446-517) offers three independent routes to the same reward, not one —
a Scholar's free auto-success with no roll at all (`va_wind_read`, :456-467),
a grace check (`va_wind_trace`, DC 9, :468-487), and a wits check
(`va_wind_puzzle`, DC 9, :488-507) — and the latter two key on separate
`checkSourceId`s (`act:va_wind_trace` vs `act:va_wind_puzzle`,
`engine.ts:1172-1185`), so failed attempts on one never escalate the other,
and both sit in the same room's menu at the same time (their `if` clauses
are identical, `:471`/`:491`). The Sunken Shrine's water-verse puzzle
(`va_drowned_chapel`, :382-445) is built exactly the same way. A player
"bad at" one of the two stats already has a same-turn, zero-travel,
zero-rebuild fallback printed in the very menu they're looking at — not a
build change, and not something that needs leaving the room at all.

This exact mechanism has now been raised and independently re-settled three
times this session, not once: the "skiff-drag… escalating to 22 with no
warning" finding (`docs/roadmap.md:2564-2572`) and "wave five's" two tickets
on the companion-dispute spiral and the missing upfront ceiling
(`:4630-4716`) both worked through the same cap, the same
`tp:`-checks-are-exempt carve-out (`engine.ts:1222`, for conversations
specifically), and the same conclusion: the rule prints once before class
pick (`format.ts:536-553`), the numeric ceiling prints from the first
failure ("raised N by failed tries, and stops at {ceiling}",
`engine.ts:3024-3028`), and printing the ceiling on every check's *first*
preview (escalating or not) was priced out and declined as a budget spend
for no new information (`:4699-4716`). Nothing about this wave's framing —
"leaving and returning," "a stat perk" — survives contact with the code: the
counter's persistence is deliberate, the cap already guarantees the check
stays winnable, and the flagship cited puzzle already ships the exact
"different approach" the report says isn't telegraphed, sitting in its own
menu next to the option that's failing. Left alone: no code or content
change. `queue/P1-issue-8f4a284d.json` and `queue/P2-issue-987e24b0.json`
moved to `done/`.

**Theme 2 — `P1-issue-9ff64821` and `P2-issue-647fde1b`, "only self-targeted
heal items exist" in a mid-dungeon corridor.** Not quite accurate, checked
against the DSL directly: no fx op targets a *named* companion's hp at all
(the full effects table, `docs/authoring.md:93-121`, has nothing like
`["nphp", npc, n]`). What exists instead is a general side effect,
`applyRest` (`engine.ts:1781-1803`): any room action or ability whose fx
list carries a positive `hp` entry heals every living, present, standing
companion by that same amount and refreshes every ability-resource pool to
full — called from the `"custom"` and `"ability"` branches
(`engine.ts:3320`, `:3328`) but never from `"use"` (`:3199-3204`, which only
ever touches the player's own `s.hp`, `:1342-1351`). So the true shape isn't
"items are deliberately selfish" — it's that healing a companion was never
given its own primitive; it rides along on whatever room/ability content
already grants the player hp. `docs/authoring.md:402-406` documents exactly
this: "the hearth's `rest`, an empty bunk — heals the companions… An item's
use heals only whoever takes it." Also found, and worth the report's
"no in-fiction way" claim being narrowed rather than accepted whole: a
Warden-only ability, `warden_weight` ("take the weight",
`world/reach.json:202-207`), already revives any downed party member
mid-fight (`["revive"]`, gated on `["companionDown"]`) for one `res_warden`
point — an existing, no-hearth, in-fiction recovery path, just class-gated —
and a companion struck to 0hp is never killed by it: they're held at 1hp,
flagged down, "crawl clear of the fight" (`companionStruck`,
`:1736-1753`), and automatically get back up at half their max hp the
moment the room holds nothing hostile and alive (`recoverDowned`/
`reviveDowned`, `:1755-1779`) — no hearth, item or ability needed. What does
*not* self-resolve is a companion left standing at critically low hp (the
report's own 1/9 example) without having gone down; they stay there until
the next qualifying rest.

Checked the named corridor directly against the current file rather than
the report's geography: the honour guard (`mg_hollow_guard`, hp 16/atk
4/df 12, `"pierce": true` — the "armor useless" undead,
`world/reach/mg_marrowgate.json:4329-4345`) stands in `mg_old_crypts`
(`:780-852`), reached from the surface only through
`mg_undercity_stair` → `mg_cistern` → `mg_old_crypts`
(`:660-666`, `:691-718`, `:780-793`). Neither the stair, the cistern, the
smugglers' cut nor the crypts themselves carry a rest action. The nearest
ones on either side are `mg_hanged_man`'s "take a room and sleep"
(`:84-96`, full heal — two rooms from the Coldpass gate, but on the
surface, off `mg_lower_town`, not on the undercity route itself) and
`mg_first_reeves_tomb`'s "rest a while by the lid" (`:853-872`), which sits
*past* the guard, locked behind passing or calming it. The undercity stretch
genuinely has no rest point on it — confirmed fresh, not assumed.

This is, in substance, the same finding this session already investigated
in depth and deferred once already, under `P2-issue-a5686d21`
(`docs/roadmap.md:4905-4978`, "Rest exists in every region's own hearth, and
none of them ever say so") — same corridor, same guard, same two rest
points, same conclusion, and that ticket carried `verified_reports: 1`
against this wave's 0. The realm's own design spec states the convention
this reflects outright: `docs/superpowers/specs/2026-09-05-realm-design.md:74`,
"a settlement (6-10 authored rooms, with an inn that heals)" — resting lives
in town, a dungeon is the unrested stretch that spends what you rested up,
realm-wide by design, not a Marrowgate-specific gap. The prior entry weighed
fixing the *discoverability* angle there and found it disproportionate
against `mg_old_crypts` already sitting at 919/1100 characters, one of the
walkthrough's own tightest screens.

Weighed the cheap-unlock angle directly rather than defer on instinct: could
`applyRest` simply also fire on item use, so existing self-heal items
(`va_herbs`, `mg_herbs`, …) reach the party too? Reading `applyRest` in full
answers it — the same call that heals the company also "refreshes every
ability-resource pool to full" (`engine.ts:1802`, "reused by any
fx-running action, a room's or an ability's, so no inn needs separate
authoring for the two"). Wiring item use into it would silently turn every
existing 3-4hp snack item into a full ability-resource refill too, a
materially bigger and unasked-for change to the combat-resource economy, not
a narrow companion-heal; hand-splitting just the healing loop out for items
alone would be a genuinely new code path, not a trivial unlock of something
already wired. Neither fork clears "clearly cheap, narrow, already
half-built." Left alone, on weaker evidence than the ticket that already
covered this ground: no code or content change. `queue/P1-issue-9ff64821.json`
and `queue/P2-issue-647fde1b.json` moved to `done/`.

No `world/*.json` or `src/*.ts` file changed by this entry (`docs/roadmap.md`
and the four queue→done moves only), so `npm run verify` was not required
and was not run for it.

### Wave 6: the blessing/promise tension's one silent side closed; the odds-preview format and the companion-regard ask both hold up as already-served

Three more of wave 6's findings (`P2-issue-0f4d5511`, `P1-issue-ba53c432`,
`P2-issue-54776c8d`), all `verified_reports: 1` from the same won run
(`playtest-2026-09-15T21-30-52-283Z-s6784.json`, seed 6784). One content fix,
two declines with the reasoning that closes them out.

**`P2-issue-0f4d5511.json`** — "Whether accepting the priest's blessing
(opening the barrow) would conflict with a later promise to the reeve
(sealing it) wasn't fully clear until both NPCs and the innkeeper were
consulted." Different from two already-settled Vale-barrow findings: the
hunter's-gap shortcut making the blessing moot (`docs/roadmap.md:4447-4528`,
a physical-bypass problem) and `va_doors`'s own fallback-stage "you decide
at the throne" ambiguity (`docs/roadmap.md:3832-3857`, a decision-*timing*
problem). This one asks whether the two asks are flagged as being in
tension with each other at the moment either is offered.

Read both NPCs' full topic trees in `world/reach/va_village.json`. The
reeve's side already does this well, in the one topic that has to be seen
before a promise is even offered: `va_reeve`'s `doors` topic (`:412-419`,
gated on `va_heard_reeve_blight`, a prerequisite of the `promise` topic
itself) says outright, "the priest wants the opposite, and he won't bless a
door sworn shut, so see him first if you want both," and `promise`
(`:420-438`) repeats it ("The priest won't bless a door sworn shut, mind —
ask him first if you want both"). Because `promise` requires
`va_heard_reeve_ask` (set only by `doors`), a player cannot reach the
promise blind from the reeve's own tree. `va_innkeep`'s `factions` topic
(`:591-597`), ungated and available from turn one, states the same rule
even more plainly: "Ask his blessing before promising the reeve — both
wishes hold. Promise first, and he wants his own way past it." And the
priest's own `blessing_refused` variant (`:713-718`, live once
`va_promised_seal` is set) explains the reverse-order lockout in full at
the exact moment it bites.

Checked the actual mechanics, not just the text: promising the reeve
*first* is the only direction that forecloses anything (`blessing_refused`'s
gate, `:716`) — taking the blessing first never blocks the promise.
`va_reeve`'s `promise` topic has no `va_barrow_open`/`va_barrow_blessed`
gate at all, and `reeve_blessed_open` (`:537-543`) confirms blessing-then-
promise is a fully supported, non-contradictory path ("The priest opened it
for you... Shut them after, as you said, and we'll have no quarrel"). So the
one real lockout is already well-telegraphed from both the reeve and the
innkeeper; the gap was narrower than the report's framing suggests, but
real: the priest's own `blessing` accept variant (`:705-712`, live when
`va_heard_oldking` is set and the player has *not* promised) said nothing
about the reeve at all — "No promise binds them shut; whether they close
again behind you is yours to decide at the seat" reassures about the
throne-side seal/open choice but never names the reeve, so a player who
reaches the chapel before the square (or without ever visiting the
innkeeper) had no way to know, from the priest alone, that taking this
blessing leaves the reeve's promise still open to give.

Fixed there only — the one topic that was silent on the side of the tension
the reeve and innkeeper already cover from the other direction:
`world/reach/va_village.json:710`, `"...No promise binds them shut; whether
they close again behind you is yours to decide at the seat. Go when you're
ready."` -> `"...No promise binds them shut — you can still give the reeve
yours, and decide the rest at the seat. Go when you're ready."` — 195 to 197
characters, both well inside the 220-char `say` budget
(`scripts/lint-world.ts:22`). `old_king` (`:698-704`, the topic that
introduces the blessing) and `blessing_refused`/`release` were left
untouched: `old_king` is backstory, not the decision point, and the other
two already explain themselves fully.

`node scripts/fmt-json.mjs world/reach/va_village.json` — only the edited
line changed. `node --import tsx scripts/lint-world.ts world/reach.json` —
"all text within budget." `node --import tsx scripts/budget.ts
world/reach.json --terse` — `avg 440.7955 max 1076 sum 118574 screens 269`,
unchanged (this topic isn't on the proven walkthrough, which opens the
barrow via the hunter's gap, not the blessing). The topic *is* on one proof,
`crowned_hollow` ("be a Scholar," `world/reach.json:654`): measured directly
at `avg 449.76 max 858`, both still under the real 450/1100 ceiling
(`crowned_hollow` carries no allowance in `test/budget.test.ts`'s
`PROOF_BUDGET` table — it's held to the bar outright). `queue/P2-issue-
0f4d5511.json` moved to `done/`.

**`P1-issue-ba53c432.json`** — "the initial DC/modifier math shown before
rolling doesn't always make the true odds obvious... DC vs total-needed
phrasing took a few tries to parse confidently." Both named checks —
`ir_push_fall` ("go through before nerve fails," will, DC 10,
`world/reach/ir_irondowns.json:477-493`) and `fd_dike_shore` ("shore the
dike," might, DC 9, `world/reach/fd_fenmarch.json:63-83`) — are plain
`["check", skill, dc, onSuccess, onFail]` DSL ops with no custom preview
text of their own; both render through the single shared `oddsHint`
(`src/engine.ts:2902-3082`, the check branch at `:2991-3033`). There is no
code path by which these two could render inconsistently with each other —
same function, same template, and both labels end in `(skill)` so the
skill-tag suffix is suppressed identically for both (`:3010-3011`).

The one real asymmetry is in the format itself, not between the two
examples: when a check's modifier is 0, `oddsHint` prints `DC {dc}, roll
{dc}+ on the die` — the same number twice, with no modifier shown to
explain why (`:3012-3016`, the `mod ? ... : ...` branch). With the Reach's
four classes' base attrs (`world/reach.json:35`'s `classes`: Warden might
2/will 1, Scout grace 2/wits 1, Scholar wits 2/will 1, Envoy will 2/wits 1),
`fd_dike_shore` (might, DC 9) shows this duplicated-number form for three of
four classes and the clear `DC 9, +2: roll 7+` form only for Warden;
`ir_push_fall` (will, DC 10) shows it only for Scout. That is a genuine, if
minor, source of "a few tries to parse" — but it is not a bug in either
named check, and not a mismatch between them.

Checked whether a cheap fix exists rather than assuming none does: it
doesn't. This is the same ground a very recent, more specific finding
already covered and declined (`docs/roadmap.md:4681-4713`, `P1-issue-
d3652755`/`P2-issue-c0489d2e`) — "printing the exact number before ever
attempting the check... was weighed and declined on purpose" because
`oddsHint` renders on effectively every check option in the game, and the
budget has almost nothing left to give it: `scripts/budget.ts
world/reach.json --terse` measures `avg 440.7955/450` (9.2 characters of
slack across all 269 walkthrough screens) and the intro sits at `1373/1400`
(27 left) — confirmed fresh this session, not assumed. A per-check or
per-rule addition here is exactly the shape of change the project has
already priced out once (the redundant skill-tag suffix, "about 1.1
characters a screen on every road at once," `test/budget.test.ts:210-214`)
and found too expensive for the value. The general escalation rule is
already stated once, economically, in the intro (`src/format.ts:553`,
confirmed live) rather than repeated per-check — the same design answer
would apply here if this were pursued, and the "state it once, let the
player internalize it" pattern is the established one for exactly this
kind of full-realm, low-severity clarity nuance. Left alone: no code or
content change. `queue/P1-issue-ba53c432.json` moved to `done/`.

**`P2-issue-54776c8d.json`** — a condensed per-companion "relationship
history," since regard changes are easy to lose track of without
repeatedly opening `status`. `renderStatus`'s Party section
(`src/format.ts:410-424`) already prints exactly this, condensed to one
number per companion, every time: `regard {+/-}{n}` plus `, near leaving`
once it reaches -2 (`:415-418`), free of charge and current to the instant,
since `status` costs no turn (per the intro's own line, `src/format.ts:553`,
"status(s): free recap"). This is not a new mechanism to build; it already
exists and already updates live.

What doesn't exist, and what the report is more precisely asking for, is a
chronological log of every individual approval/disapproval *event* (which
choice moved a companion's regard, by how much, and when) rather than the
live running total. That's a different, heavier feature — a new per-event
history would need its own state field(s) tracked turn over turn (a
determinism-sensitive addition, since `State` is asserted to be exhaustive
plain JSON, `src/engine.ts:3084-3097`'s `cloneState` comment), plus new
rendering and its own budget cost, for a single-corroboration P2
`suggestion` (not a `bug` or `confusion`) that itself frames the ask as
"consider a way," not a broken expectation. The project's own precedent for
a related complaint points the same way: a companion nearing departure
once surfaced "only... on the status screen" and got fixed by adding the
same live signal to the *action preview* (`partyLeavesHint`, documented at
`src/engine.ts:2237-2247`) rather than by building a history log —
surfacing the current state proactively, not archiving the past.
Disproportionate to build a log for this report alone; the live number
plus its "near leaving" threshold already gives the condensed read the
suggestion asks for. Left alone: no code or content change. `queue/P2-
issue-54776c8d.json` moved to `done/`.

**Verification.** `npm run verify` was run in full against the shared
working tree and returned 332/333 tests green, one failure: "the
observation budget holds along every other proven route (reach)",
`proofs.crowned_hollow#bloodied: avg 524.6 > 523` (`test/budget.test.ts:5`).
Isolated directly rather than assumed: `git stash push -- world/reach/
va_village.json` (this entry's only content change) then re-running `node
--import tsx --test test/budget.test.ts` reproduced the identical failure,
`avg 524.6 > 523`, with this entry's edit entirely absent — and
`crowned_hollow#bloodied`'s own proof steps never select "a blessing for
the barrow" or talk to the gray priest at all (checked directly against
`world/reach.json`'s `proofs`), so the edited line cannot reach that road
regardless. The regression traces to concurrent, uncommitted work this
entry did not make and does not touch: `src/engine.ts`, `test/party.test.ts`,
`test/conditions.test.ts` and `world/reach/th_thornwold.json` all showed as
modified in the shared tree (none edited by this entry). Running the
crawler stages directly (skipped by `verify`'s `&&` chain once `test`
fails) surfaced a second, unrelated problem in that same in-flight code:
`npm run crawl:fork` throws `ReferenceError: talkMenuParts is not defined`
at `src/engine.ts:2557`, a hard crash, not a budget miss —
`npm run -s typecheck`, `npm run -s validate`, `npm run -s crawl`,
`npm run -s mock` and `npm run -s measure` all passed cleanly on their own.
Neither failure is caused by, or fixable within, this entry's three queue
items; flagged here for whoever lands the `src/engine.ts` change in
flight, not worked around. `queue/P2-issue-0f4d5511.json`, `queue/P1-issue-
ba53c432.json` and `queue/P2-issue-54776c8d.json` all moved to `done/`.

### `P1-issue-a5d492b0.json`/`P2-issue-a0ecfcf8.json`: the gray sergeant was the one guardian the stand-down fix missed

Both reports, one corroborated finding: naming/pacifying a guardian ("name
it," `scholar_name`) instantly opened the barrow-wight's passage at Barrow
Crypt, but at The Waiting Bough the same move on the gray sergeant left the
way "locked" and still needed a separate will/grace check afterward —
inconsistent payoff for what reads as the same ability. Investigated as a
mechanical-consistency question distinct from wave five's "name it reads
last" entry above (`:4811-4903`), which is about menu position, not this.

The realm already has a fix for exactly this shape, and it's why three of
four guardians already behave the way the report expected. `f9a4150`
("reach: standing something down is a key after all," `P1-issue-75515d1b`/
`840b60d4` + three P2s) made `calm_<id>` join every guarded exit's unlock
condition "wherever it can apply" — the honour guard (`mg_old_crypts`, exit
at `world/reach/mg_marrowgate.json:789`), the Vale barrow-wight (`va_crypt`,
`world/reach/va_barrow.json:308`), the Hollowbrook grave-wight
(`hb_kingsrest_hall`, `world/reach/hb_hollow.json:118`), and all 32 stamps of
the three shared templates (`templates.json:54`, `775`, `1015`) — because
`calmhostile` (`src/engine.ts:1386-1390`, shared by `scholar_name`,
`envoy_parley`, `envoy_buy_off`) only ever sets the flag; whether it actually
opens anything is a per-room content decision, and a door held shut by
convention against something the engine no longer considers a threat
(`hostileNow`, `:904`) was that commit's own stated bug. The Waiting Bough's
gray sergeant (`world/reach/th_thornwold.json:596-672`, npc at `:2425-2447`)
is the fourth and last realm hostile carrying `pierce: true` behind a
single fixed-room passage — the same four rooms wave five's menu-position
entry above independently enumerated (`:4836-4843`) — but `f9a4150` never
touched it: no report had named this specific room yet, only the honour
guard and the barrow-wight. Its west exit checked only `th_gate_passed`
(`:605`, pre-fix) — set by killing him, slipping past (grace), answering him
plain (will), or the Priory's sealed rite, never by calming him — so "name
it" read as success ("you speak its true name, and it remembers what it
was") while the door stayed shut. Confirmed it isn't a deliberate
difference: the room's own fiction is the same shape as the other three (one
hostile bodily standing in a passage, no separate lock or mechanism to
explain a split), and unlike the honour guard's and grave-wight's own
`lockedMsg`/`hint`, the sergeant's never even offered "calm him" as a route
past.

Fixed by extending the exact existing convention rather than inventing a
new one: `th_hollow_gate`'s west exit now ORs `calm_th_sergeant` alongside
`th_gate_passed`; a new "calmed but not passed" variant renders, worded like
the honour guard's/grave-wight's own ("stood down now, and no longer minded
to stop you"); and the three actions that used to be the only way past
(`th_slip_sergeant`, `th_answer_sergeant`, `th_sergeant_rite`) now also gate
on `!flag calm_th_sergeant`, so a door already open stops offering redundant
checks — same shape as `mg_old_crypts`'s own three-part fix in `f9a4150`'s
diff. Left `lockedMsg`/`hint` wording alone (matching `va_crypt`'s own
precedent, which never mentions "calm" either): a first pass that spelled
out "stood him down" in both strings measured clean on `scripts/budget.ts`'s
walkthrough-only view but broke `test/budget.test.ts`'s ratchet on five
proofs that revisit the locked room under retry loops (up to +14.7 chars/turn
on `crowned_hollow#bloodied`) — reverted the wording, kept the mechanism.
Extended `test/conditions.test.ts` with "calming the gray sergeant opens the
Waiting Bough outright..." mirroring the existing honour-guard test
(`:470-496`), so the fourth guardian is now pinned the same way the other
three already are.

Verified in an isolated `git worktree` off this session's actual HEAD
(`e904b41`) rather than trust the shared working tree, which several other
agents were actively landing unrelated content into at the same time (queue
moves, `src/engine.ts`, `world/reach/va_village.json`, this very file
mid-edit) — one such in-flight change was independently tripping
`test/budget.test.ts`'s ratchet on `crowned_hollow#bloodied`, a Warden proof
that never leaves the Vale and never visits Thornwold, so it could not have
been this entry's own doing. Applying only this entry's diff
(`world/reach/th_thornwold.json`, `test/conditions.test.ts`) on top of clean
HEAD in a scratch worktree: `npm run verify` green, 333/333 tests, all three
worlds validate and win-prove, both crawls clean (0 over-cap menus).
`scripts/lint-world.ts world/reach.json`: "all text within budget."
`scripts/budget.ts world/reach.json --terse`: avg 439.7546/450, max
1076/1100 — byte-identical before and after this entry's change, since no
proven route ever calms the sergeant and the new variant text is therefore
never rendered on one, the same "costs nothing where the measurement can't
see it" this file's own rule already names.

`queue/P1-issue-a5d492b0.json` and `queue/P2-issue-a0ecfcf8.json` moved to
`done/` together — one mechanism, one fix, two reports of the same gap.

### Wave 6, items 1-4: a ledger ending that already has its menu action, `ea62cecc`'s twin, and one real fix for a downed companion

Four wave-six items, read whole before touching anything: `167e24a5` and
`2f557ac5` (one report, filed twice — "surface the ledger-reading ending as a
menu option at the throne room / palace court" and its confusion twin, "it's
never offered as a menu action anywhere I found it"), `7c98c9c5` (verified=1,
confirmed against a real winning trace — "the final rite's exact requirements
are only spelled out via `status`, not proactively surfaced"), and `91731c0b`
("does knocking a companion down in a forced fight kill them, or not — never
stated").

**`167e24a5` / `2f557ac5`** — checked the premise before assuming a gap: is
"read the founding ledger aloud" really never a menu action? It isn't. It's a
real, tested, selectable ending exactly where the ticket itself guesses it
should be. `mg_hollow_throne` (`world/reach/mg_marrowgate.json:873-901`, "a
throne room under the throne room: the true seat of the Reach") carries three
concrete actions — `mg_depose_watch`/`mg_depose_church`/`mg_depose_free`
(`:1157-1210`) — labeled exactly "read the ledger aloud to the Marshal/the
Mother/the Companies," each gated on `has mg_founding_ledger` plus
`rep_watch`/`rep_church`/`rep_free >= 2` and `!npcDead mg_regent`, each ending
the game in `"win", "regent_deposed"`. That ending carries its own
replay-proof (`world/reach.json`'s `proofs.regent_deposed`, exercised by
`test/budget.test.ts`'s per-road ratchet), so it is exactly as real and
reachable as the room's other five resolutions: the Great Rite
(`mg_great_rite`), the burn (`mg_burn_throne`), the bargain
(`mg_bargain_throne`), the crown (`mg_sit_throne` and three variants), and the
kneel (`mg_kneel`/`mg_kneel_confirm`).

Every one of those six stays invisible in the menu until its own precondition
is met — that's the room's whole design, not a defect unique to the ledger.
The same room already explains what's missing for all six at once, for free:
`mg_weigh_doors` ("weigh the doors of the seat," `:902-1067`) is offered the
whole time the throne stands unresolved, costs no turn, and spells out the
ledger path in the same breath as the rest — "You do not carry the founding
ledger, chained in the Hall of Ledgers" or "You have the ledger, but need
standing 2 with Watch, Church, or Companies" (`:983-998`), the identical shape
as "The rite wants three hollows rested" a few lines above it.

The ticket's own suggested location undersells itself: "the throne room /
palace court" names two rooms that are both real and both load-bearing here.
`mg_palace_court` (`:416-433`, "The Palace Court") is the room the ledger's
home branches off from — "a colonnade east leads to the Hall of Ledgers" — and
`mg_hall_of_ledgers` (`:456` on) is where `mg_founding_ledger` is actually
found; the ending itself is spoken at the throne, once the item is walked
back. Two more places already tell the player this is a real ending,
independent of ever reaching the throne room: Act 3's own objectives text
(`world/reach.json:8`, shown by `status` from the moment Marrowgate opens)
says outright "read the founding ledger aloud to those who trust you — each
of those is an ending," naming it alongside the rite/fire/bargain/crown; and,
earlier still, a Vale-village dialogue topic reachable from early in the game
— "what waits under Marrowgate" (`world/reach/va_village.json:1091-1096`, open
once `va_heard_decree` is set) — has an NPC describe all four non-kneel paths
outright, including "the founding's truth read aloud."

So the actual gap is narrower than either ticket states: a player who never
visits the Hall of Ledgers, never gets any faction to standing 2, and never
asks that one Vale topic will not personally see this specific action in
their own menu — equally true of a player who never gets the crown, or never
burns three holds, for those endings. That's the intended shape of a realm
with six ways to end the same throne, not a hole unique to this path. Same
"already-built, needs pointing at" shape as `ea62cecc`/`58169e05` below, not
the "genuinely nothing built" shape this document holds
`58397108`/`be79b069`/`fc1a4039` to. No content change. `queue/P2-issue-
167e24a5.json` and `queue/P2-issue-2f557ac5.json` moved to `done/`.

**`7c98c9c5`** (verified=1) restates `ea62cecc`'s own claim (`done/`,
`docs/roadmap.md:5194-5233`) almost word for word — "the exact rite formula (3
hollows rested + king rested + confession) is only fully spelled out via
`status`" — adding one concrete consequence: "a player who never calls
`status` could reach Marrowgate without realizing they were one step short."
Checked whether that consequence changes the answer before treating this as
the same ticket twice.

It doesn't, and the realm's answer is stronger than `ea62cecc` even needed.
`ea62cecc` already established the formula is stated well before Marrowgate,
in the Act 2 objectives (`world/reach.json:12`, word for word "the Hollow
Throne's rite wants those three, the Vale's king at rest, and the first
Reeve's confession") and the Act 3 objectives (`:8`). Separately — and this is
the piece that answers "a player who never calls status" specifically — the
one true point of no return before Marrowgate, `cp_pass` ("the Pass Gate,"
`world/reach/cp_coldpass.json:36-48`), fires an unconditional `onEnterOnce` on
first arrival, no `status` call or free action required: a room-authored
warning ("Past this gate the holds fall behind you...") plus `questsopen`
(`src/engine.ts:1602-1615`), an engine effect built, per its own comment, for
exactly this shape of report — a prior wave's player who "named why — 'this is
stated once in passing dialogue but easy to miss, and irreversible.'"
`questsopen` counts the player's open threads and says outright "Read them in
your status before you cross: whichever lie behind you stay open for good."
This is the same mechanism `docs/roadmap.md:3328-3360` already traced and
closed as `58169e05` ("The Pass Gate already does what `P2-issue-58169e05` is
asking for"), which also confirmed `mg_hollow_throne` gets the parallel
treatment — the `mg_weigh_doors` free action cited above, under `167e24a5`.

The one piece of this cluster genuinely still open is moving that warning
earlier than `cp_pass` itself, or inlining the literal three-part formula into
it — `docs/roadmap.md:1439-1454` (`c1c437de`/`748f4551`) asked for exactly
that and left it open on purpose, not fixed: `status`'s own ratchet was
measured at 6 characters of slack the day it was written, and `cp_south_stair`
sits on 9 of 11 simulable proofs, "the same shape of problem as `va_gate`...
exactly the shape that broke eight ratchets for one sentence." `7c98c9c5`
doesn't name that specific new location — it restates the general "not
proactively surfaced" claim — so it's answered by `ea62cecc` and `58169e05`
rather than superseded by `c1c437de`/`748f4551`; re-flagging the identical
residual under a fourth ticket number would be re-litigating, not
investigating. No content change. `queue/P2-issue-7c98c9c5.json` moved to
`done/`, cross-referenced to `ea62cecc` and `58169e05`; the genuinely-open
residual stays exactly where `c1c437de`/`748f4551` already left it.

**`91731c0b`** — "does a downed companion truly die, or recover" is, unlike
the three above, a real gap, stated nowhere, and a cheap one to close. Checked
`companionStruck` (`src/engine.ts:1736-1761`, the function every hostile
NPC's counter-attack runs when its blow lands on a companion instead of the
player): a companion struck to 0hp is never removed from the party or marked
dead by this path — hp is held at 1, flag `down_<id>` is set, and the
function's own doc comment already states the design intent outright:
"Nobody dies of it: a companion's death is content's to write."
`recoverDowned`/`reviveDowned` (`:1764-1787`), run every turn
(`:3464`), automatically bring every downed companion back up — no hearth, no
rest, no player action — the moment nothing aggressive is left in the room, at
half their max hp, with its own event line ("{name} is back on their feet,
shaken."). The honour guard the ticket names (`mg_hollow_guard`,
`world/reach/mg_marrowgate.json:782-850`) is an ordinary hostile on this same
generic combat path (`npcStrike`, `:1901` on, which rotates blows onto
standing companions like any other fight), so a companion downed there
recovers exactly the same way as anywhere else in the realm.

None of this was ever stated to the player. Searched broadly for anything
that already answers it (`world/*.json` for "crawls clear"/"back on their
feet"/"permanent"; `docs/authoring.md`) before assuming a fix was needed: the
only near-miss is the Warden's own `revive` ability ("You haul them up by the
collar," `world/reach.json:206`), which is class-gated, reactive (only
appears once a companion is already down), and never says "permanent" either
way — not the general, anticipatory answer a player deciding whether to risk
a forced fight needs. Genuinely nowhere, and the true answer is exactly as
simple as a one-line fix wants: downed companions always recover from combat;
only content the realm authors on purpose (none currently does, for a
companion) could end one for good.

Fixed with the minimum the ticket asks for: `companionStruck` now appends "
Nobody dies of it." to the existing "goes down, and crawls clear of the
fight" line, gated on a new one-time flag `down_explained` so it is told once
per playthrough — the first time it ever happens to anyone in the party,
never repeated after (`:1740-1752`). Reused the function's own
already-committed language ("Nobody dies of it") rather than inventing new
wording, and kept it to three words plus the period: the cheapest version of
the true answer, not a fuller explanation of the recovery mechanic (which the
player already sees for themselves, for free, the moment it happens, via
`reviveDowned`'s own event line).

Not free, and the honest cost is on record. The realm's only proof that ever
swings a blow with a companion standing, `crowned_hollow#bloodied`
(`test/budget.test.ts:181-182`, "the realm's only fight proof, carries just
Lys"), knocks Lys down partway through, so the new clause is paid once, on one
of that proof's 50 screens — the same near-zero-headroom road this document's
own neighboring entry above just finished re-measuring for an unrelated
reason (`crowned_hollow#bloodied` "up to +14.7 chars/turn" under the gray-
sergeant fix, reverted there). First measured at 61 characters (a fuller
"back on their feet once the fight's over" phrasing), which broke the ratchet
(avg 524.6 > 523, `Math.floor` against `PROOF_BUDGET["reach:crowned_hollow#
bloodied"]`, `test/budget.test.ts:304`); re-measured directly, not estimated,
down to the three-word version, 19 characters, landing at avg 523.8 — floor
523, at the ratchet with headroom to spare rather than exactly on the line.
`test/party.test.ts` extended: the existing knockdown test (`:396-426`) now
also asserts the line appears the first time, and a new test (`:428-441`)
confirms it does not repeat once `down_explained` is already set.

Verified in an isolated `git worktree add --detach` off this session's
starting HEAD (`e904b41`) before trusting the shared tree, the same
discipline this document's neighboring entries used today, since several
other agents were landing unrelated work concurrently (queue moves, two
unrelated `src/engine.ts` refactors, `world/reach/va_village.json`,
`world/reach/wm_wardmoor.json`, `test/menu.test.ts`) — one in-flight change
was independently and transiently tripping `va_chapel`'s perk-pick sequence on
the shared tree while this entry's own testing was underway, unrelated to
anything here and resolved by its own author before this entry finished.
Applying only this entry's diff (`src/engine.ts`, `test/party.test.ts`) on top
of clean HEAD: `npm run -s typecheck` clean, 333/333 tests, `npm run -s
validate` all three worlds win-proven unchanged (240/38/27 turns), both `npm
run -s crawl` and `crawl:fork` clean (0 over-cap menus on all three worlds),
`scripts/lint-world.ts world/reach.json` "all text within budget,"
`scripts/budget.ts world/reach.json --terse` byte-identical to the
last-recorded walkthrough figures (avg 439.75/450, max 1076/1100 — the
walkthrough itself never knocks a companion down, so it never pays this
line). Re-run against the current shared tree afterward: `npm run verify`
green end to end (typecheck, 336/336 tests, validate, both crawls, mock,
measure).

`queue/P2-issue-91731c0b.json` moved to `done/` with a shipped fix;
`queue/P2-issue-167e24a5.json`, `queue/P2-issue-2f557ac5.json` and
`queue/P2-issue-7c98c9c5.json` moved to `done/` alongside it, closed as
already-answered. All four of this entry's items resolved; none left in
`queue/`.

### `P1-issue-4839330e`: an unverified report bundles two claims — cross-turn topic drift (already understood, left alone) and conversation-page renumbering (a real, previously-unconfirmed bug, now fixed)

An unverified report — `verdict: "stuck"`, `receipt: ""`, `verified_reports: 0`
(`reports/triaged/playtest-2026-09-15T21-36-56-764Z-s6785.json`, a session
that hit the 600-turn cap with no ending, so the automated trace-verifier had
nothing to check it against) — bundles two claims under one P1: a "free"
action "sometimes silently advances the scene/turn counter," and menu
numbering that "reshuffles... between pages, making a chosen number
occasionally resolve to the wrong listed action," with two examples,
"selecting 'the old king's steel' produced a farewell line instead" and "a
page-2 option list caused an unintended 'go north' instead of the intended
dialogue pick" (`where: "The Forge / Captain Vane's Tent multi-page menus"`).
Weighed with the extra skepticism an unverified, no-receipt report earns, but
investigated seriously rather than dismissed for being unverified — and one
of the two claims turned out real.

**Claim A ("free" actions silently cost a turn): does not hold.** `s.turn`
has exactly one write site in the whole `src/` tree — `grep -rn '\.turn\s*(+=|=|++)' src/`
finds only `engine.ts:3237`, gated by `spentTurn = !freeCustom &&
!BROWSING.has(action.kind)` (`:3233-3237`). `freeCustom` reads the same
room/ability `.free` flag the player-facing "(free)" label is built from
(`oddsHint`'s `isFree`, `:2980-2982` — textually identical to `freeCustom`
today; the two have never drifted apart). `BROWSING` (`:139`) covers every
menu-navigation kind (`leave`, `travel*`, `company*`, `talkto`, `endtalk`,
`talkmore`, `roommore`) unconditionally. `look` and `status` — "get your
bearings"'s siblings as no-turn commands — are not `step()`-routed actions at
all: `src/mcp.ts:161-187` registers them as separate MCP tools that call
`view`/`renderStatus` directly and never touch `step`, so they are
structurally incapable of moving `turn`.

Rather than trust the static read alone, wrote a probe (scratchpad only, not
committed) that replays all three shipped worlds' complete, real, winning
`walkthrough`s end to end — `validate.ts`'s own `replayWalkthrough` label/
repeat-loop logic, reimplemented around a clone taken at every single step so
the real replay is left undisturbed — and at every turn applies every
currently-legal action to a throwaway clone, checking the observed `turn`
delta against a prediction independently rederived from the same BROWSING set
and `.free` lookup. 1774 legal actions probed across `lighthouse`/`reach`/
`vale`'s full winning routes (477 of them declared free): zero mismatches. A
second probe called `va_gate_bearings` ("get your bearings") five times
running from one state: `turn` sequence `1 → 1 → 1 → 1 → 1 → 1`. All three
real, unmodified walkthrough replays still won cleanly afterward, confirming
the clone-based probing never leaked into them. No `src/`/`world/` change for
this claim — the mechanism holds.

**Claim B (menu reshuffling): two different real mechanisms, correctly told
apart.** Both named locations are real, verbatim content, not a confused or
invented report. "The Forge" is `world/vale.json`'s `forge` room (and
`world/reach/va_village.json`'s parallel `va_forge`); "the old king's steel"
is a real topic label there (`vale.json:2366`, `va_village.json:654`, the
village smith's conversation). "Captain Vane's Tent" is
`world/reach/th_thornwold.json:261`, home to `th_vane` — and a scan of every
NPC's topic count across all three worlds (`Object.values(world.npcs).map(n
=> n.topics?.length)`) turned up exactly one NPC in the entire shipped realm
with more topics than `MENU_CAP` (12): Captain Vane, at 25. Not a coincidence
worth waving off.

*"the old king's steel" → farewell* reproduces exactly, and is the same
mechanism `done/P1-issue-65675d14.json`/`done/P1-issue-d3907169.json` already
named and deliberately left unfixed (`:4718-4809` above: "the general fix...
needs `State` to remember which number was whose... for a benefit that has
never been measured against real players either"). `topicVisible` (`:2093`)
drops a `once`-flagged topic (`said_<npc>_<id>`) the instant it's been asked;
`roomMenu`'s conversation branch and `menuNumbers`/`actionByNumber` rebuild
and renumber the list fresh from *current* state on every call, so nothing
remembers what number a player last read. Probed live against `vale.json`
(fresh game, smith conversation): screen 1 lists `steel for the barrow` /
`the smith's trade` / `why she watches the road` / `the old king's steel`
(#4) / `leave the smith to the forge` (#5). Asking the *first*, ordinary
topic — nothing reckless, completely normal play — removes it (`once`);
screen 2 renumbers, and "the old king's steel," never asked, slides from #4
to #3, with "leave the smith to the forge" sliding into the vacated #4.
Pressing "4" again (correct read from screen 1, stale by screen 2) resolves
to the farewell and closes the conversation with "Mind the edge." verbatim —
exactly the report's claim, exactly the mechanism the two prior tickets
already priced out. Left alone, correctly: same low-stakes shape as
`d3907169`'s "self-corrected item waste" (a free re-open of the conversation
undoes the whole cost of the misclick), no new severe-consequence case to
move the prior deferral's calculus.

*page-2 → "go north"* does **not** reduce to that mechanism, and turned out
to be a real, different, previously-unconfirmed bug: the conversation half of
a class of bug the room menu, and later the travel menu, were already fixed
for — `menuNumbers`/`actionByNumber`'s own doc comments said outright, before
this change, that a conversation "still pages by its own older rules and
numbers from 1 per page... neither has been reported" (a self-acknowledged,
never-yet-exercised gap). Unlike the drift above, this one is wrong *within a
single unchanged snapshot*, purely because the page turned — and no
conversation in the shipped realm had ever been long enough to page until
content grew Captain Vane's to 25 topics. Probed live (`reach.json`, Vane, a
flag combination surfacing 16 topics — 2 pages, 10+5 real topics plus the
farewell): number "1" meant "the hanging tree" on page 1 and "carve his name
in shame beside theirs" on page 2 — all 7 numbers page 2 shares with page 1
(1 through 7) named a different topic on each — and
`actionByNumber`/`step` (which has always judged legality against
`allActions`, never the page in front of the player, by design) silently
accepted the stale number against the *new* page's item instead of rejecting
it. The exact old room-menu bug (`menuNumbers`'s own comment: "a number stood
for two different things in one room, and a player who had just pressed 7
pressed 7 again"), just never fixed for conversations the way it was for
rooms and, later, travel. The one specific detail that does not check out is
"go north" itself: Captain Vane's Tent has only a south exit
(`th_thornwold.json:265`), room exits are listed unconditionally and are
never dynamic, and conversation mode never offers a `go`-kind action at all —
so a direction cannot literally collide with a topic number by any mechanism
this engine has, and that detail reads as the unverified session's own
imprecision rather than as evidence against the finding. The general shape —
a stale remembered number silently resolving to the wrong action once the
menu changed shape — is confirmed twice over, at the report's own two named
locations, by two different real mechanisms.

**Fixed the second one.** Gave conversations the same whole-list numbering
`allActions` already gives rooms and, later, travel lists, mirroring the
existing `travelList` pattern: extracted the conversation-menu-shape logic
`roomMenu` already had into `talkMenuParts` (`:2579-2598`, shared so
`roomMenu`'s per-page display and the new full-list numberer can never
quietly drift apart on what counts as the way out or when a conversation
pages at all), added `talkList` (`:2616-2621`, the unpaged whole topic list —
a conversation's `travelList`), and wired it into `allActions` (`:2514`).
`menuNumbers` and `actionByNumber` inherit the fix automatically, since both
already key off `allActions` alone. Updated the two doc comments that had
documented this as a known, unfixed gap (`:2447-2452`, `:2469-2476`) to say
so.

This alone regressed a real, already-tested behavior, and the full suite
caught it before it went anywhere. A level gained mid-conversation (a topic's
`fx` granting xp) leaves `s.talking` set while `roomMenu` rightly shows the
pending perk-pick menu instead (`s.perkPicks`, checked ahead of talk mode,
`:2632-2636`) — but `inTalkMode` alone doesn't know that, so a first pass at
this fix made `allActions` hand back the conversation's topics while
`legalActions` was already showing the perk menu, the two disagreeing about
what was legal. `test/party.test.ts:632`'s existing "the perk and class menus
still take precedence over an open conversation" caught it immediately
(`no action "perk: Second Wind (+3 max hp)" in va_chapel`) — and so did the
`reach.json` walkthrough replay itself, which levels up mid-conversation with
the gray priest at `va_chapel` for exactly this reason. Root-caused rather
than patched around: added `talkShowing` (`:2566-2570`), one predicate
mirroring `roomMenu`'s own class-phase/perk-pick precedence exactly, now
called by both `roomMenu` (`:2638`) and `allActions` (`:2514`) so the two can
no longer independently — and wrongly — disagree on what "in conversation"
means.

Added regression coverage two ways: `test/menu.test.ts:271-357` gets the
conversation twin of the room-numbering tests already there — "a conversation
topic keeps its number on whatever page it is showing" and "...still names
the same topic from another," a synthetic 24-topic NPC mirroring `crowded()`'s
existing room tests — and the pre-existing `test/party.test.ts:632` precedence
test now doubles as a regression test for the interaction this fix could have
broken.

`npm run verify`: green. 336/336 tests (two added by this entry), all three
worlds validate and win-prove (`lighthouse` 27t, `vale` 38t, `reach` 240t,
every menu at or under the 12 cap, `reach` peaking exactly at it), both
crawls clean (0 over-cap menus on either pass), mock-player and measure both
completed. Re-ran the Claim-A probe against the fixed engine afterward too:
still 0 mismatches across the same 1774 actions, confirming the conversation
fix left turn-accounting untouched.

`queue/P1-issue-4839330e.json` moves to `done/`: Claim A is not reproducible
and is structurally ruled out; Claim B's first example is the already-
deferred `65675d14`/`d3907169` mechanism, correctly left alone; Claim B's
second example was a genuine, different, previously-unconfirmed bug, now
fixed with tests and `npm run verify` green.

### Wave 6's wayfinding cluster: Wardmoor's four gateway roads were the real gap, Ashwood's grid is a real gap that isn't cheap, three more already answered

Five fresh wayfinding tickets, checked one at a time against what this session
has already settled: wilderness exit reciprocity (`:4530-4629`, confirmed not
a bug), the persistent compass/waypoint-note ask (`3ddba1f3`, real,
deliberately deferred, still open — "`a real, separate feature... that
nothing here builds`," `:1382-1384`), and the Iron Downs entrance-bearings
placement fix (`:4052-4153`) as the model for "is the existing mechanism
just missing somewhere it should be."

**`P1-issue-2246e5db`** ("Ashwood... the Iron Downs approach to Cinderhall...
many similarly-described rooms... exits that don't obviously connect back")
is two claims in one ticket. The Iron Downs half is already fully answered:
`ir_south_track`/`ir_east_road` carry `ir_south_bearings`/`ir_east_bearings`
from the prior fix (`world/reach/ir_irondowns.json:26,65`), and the
`ir_downs` grid itself already carries a `["bearings"]` action on every one
of its 24 open cells (`w=6,h=5`, 6 walls at `:2014`, 24 `spots` counted
directly against `w*h-walls` — exact). Nothing left to fix there.

The Ashwood half is real, and it is not the density violation
`docs/region-brief.md`'s own numeric rule would catch. `va_wood`
(`world/reach/va_wood.json:2-303`) is `w=4,h=4`, zero walls, 16 open cells,
16 hand-named `spots` — one per cell, the `scenes` pool left empty entirely
— so it already exceeds "at least as many scenes as open cells," and every
spot carries its own concrete detail (Widow's Well, Wolf Scrape, Twin
Stones...), never a generic line. The actual gap: unlike every other
wilderness grid in the realm (`em_wild`, `ir_downs`, `wm_wild`, `kw_wild`,
etc., each confirmed carrying `<region>_bearings_x_y` on every cell),
`va_wood`'s 16 cells carry **zero** `["bearings"]` actions. The only
bearings anywhere near it are one hand-written line at the linked
`va_watchtower` (`:508-515`, reached only via cell `[3,1]`'s own east exit)
and `va_gate_bearings` one hop south at the village gate
(`va_village.json:15`). A player deep in the grid — the corners are 4-5 hops
from either — can wander several similarly-textured rooms before reaching
anywhere that orients them, which is exactly the report and exactly the
shape of gap the Iron Downs fix targeted.

Applying the identical fix is not cheap here the way it was for Iron Downs'
two low-traffic corridors. Replayed the walkthrough and all 13 proofs
through the grid directly (`newState`/`step`, not guessed): 15 of `va_wood`'s
16 cells sit on at least one proven route — only `va_wood_3_3` (Antler
Stake) is touched by none — because the grid is small and several classes'
proofs each cut a different diagonal through it. Added one `["bearings"]`
action per cell (matching every sibling grid exactly) and ran `npm run
verify`: the main walkthrough absorbs it fine (439.79 -> 440.80 against a
450 cap), but five of the per-road ratchets, already living within a
fraction of a character of their own ceiling, go over — `regent_deposed`
451->453.0, `reach_burned` 451->452.3, `gray_crown` 452->453.7,
`reach_at_rest#scout` 452->453.5, and `crowned_hollow#bloodied` (the realm's
fight proof, which kills three of the grid's four hostiles) 523->536.5.
Paying for that would mean trimming several hundred characters of prose off
five different endings — several changes, not the one this cluster is
supposed to be. Reverted (`git checkout -- world/reach/va_wood.json`;
`scripts/budget.ts --terse` back to the pre-edit `avg 439.7546`). Left as a
documented, real, not-yet-affordable gap — the same bar `be79b069`,
`fc1a4039`, `3ddba1f3`, `5109e8d6` and `f5fa61c0` are already held to, not
the density defect the brief's own rule would have caught. A one-of-sixteen
partial (the single free cell) was considered and rejected: it would read as
arbitrary, not as a fix. `queue/P1-issue-2246e5db.json` stays in `queue/`,
open.

**`P2-issue-6db154a1`** ("the path from the Vale to Coldpass/Marrowgate is
not signposted... I wandered through the Kingswood... before finding the
actual Wardmoor→Coldpass road") got the Iron-Downs-style trace the task
asked for, and this time it found a real, fixable gap. Traced the actual
shortest route first: the Vale connects to Wardmoor directly, one hop, via
`va_barrow_field` (on Act 1's own critical path, unmissable — its own desc
says "a road climbs north toward the moor," `va_barrow.json:5,18`) ->
`va_north_road` ("The watch-stone. Wardmoor north," `va_village.json:307-313`)
-> `wm_south_gate`. Wardmoor in turn has four gateway roads to its
neighbors — `wm_south_gate` (Vale), `wm_west_road` (Iron Downs),
`wm_east_road` (Hollowbrook), `wm_north_road` (literally "the north road to
Coldpass") — checked all four the way the Iron Downs investigation checked
its two. Three of the four (`wm_west_road`, `wm_east_road`, `wm_north_road`)
carried no actions at all, bearings or otherwise; the fourth
(`wm_south_gate`) had two read-a-notice finds but no bearings either. The
region's own hub, `wm_parade`, does carry a hand-written `wm_bearings`
action (`wm_wardmoor.json:106-115`) that already says the right thing —
"Coldpass: the north road, from the record-house" — but it sits two hops
from three of the four gateways (through `wm_armoury`/`wm_barracks`/
`wm_record_house`, none of which carry bearings either), not the
one-hop-from-every-entrance pattern the Vale's and Thornwold's own hubs
keep. Same shape as the Iron Downs gap — a region's entrance corridors
missing the mechanism every sibling entrance carries — just on four roads
instead of two.

Fixed with the exact existing pattern, nothing invented: added
`wm_south_bearings`/`wm_west_bearings`/`wm_east_bearings`/`wm_north_bearings`
(`{"label": "get your bearings", "fx": [["bearings"]], "free": true}`) to
the four gateway rooms (`world/reach/wm_wardmoor.json`: into `wm_south_gate`'s
existing `actions` array, and a new one-entry array each for the other
three). Cost checked the same way as Ashwood above, not assumed: replayed
the walkthrough and all 13 proofs through these rooms — the walkthrough and
10 of 13 proofs never enter Wardmoor at all (the walkthrough reaches
Coldpass via Saltkerns' smugglers' route instead, one of the four ways the
game's own text names), and the three that do (`reach_burned`,
`reach_bargained`, `regent_deposed#warden_crown`) visit each gateway once.
`scripts/budget.ts --terse`: byte-identical, `avg 439.7546` both before and
after — these rooms are entirely off the walkthrough. `npm run verify`:
green (336/336 tests, all three worlds validate and win-prove, both crawls
clean, 0 over-cap menus). `node --import tsx scripts/audit-bearings.ts
world/reach.json` (whole realm, no filter): `wm` legs walked went 78 -> 90
(measured both ways, by stashing and restoring the change), 0 wrong either
time; realm-wide, 0 of 886 legs wrong. `queue/P2-issue-6db154a1.json` moved
to `done/`.

**`P2-issue-15a4244d`** ("add a direct 'toward Coldpass' bearing hint
earlier... at the Vale gate or in Act 2's status text, once 3 hollows are
rested") asks for content that already exists at the location it names.
`world/reach.json`'s staged `objectives` (rendered free, any time, via
`status` — `src/format.ts:297-300`) carries, for the whole of Act 2
regardless of hollow count: "North — Wardmoor, and above it Coldpass and the
road to the capital." That is the Wardmoor-then-Coldpass direction, in Act
2's status text, already — not gated behind 3 hollows specifically, but
present from the moment Act 2 opens, earlier than the ticket's own ask. The
"Vale gate" alternative it names is a poorer fit on inspection: a hint keyed
to "3 hollows rested" cannot fire before Act 2 exists, by which point a
player is rarely still standing at the Vale's gate. The narrower, dynamic
reading (compass-style output keyed to the exact hollow count, rather than
static regional prose) is the same shape as `3ddba1f3`'s persistent compass
note — real, but a different, larger feature than "point at what already
exists," and already tracked there rather than duplicated here. Superseded
on the same "the information is already free and already there" bar this
session has closed several tickets on before (`:1544-1554`, `:3991-3999`);
`queue/P2-issue-15a4244d.json` moved to `done/`.

**`P2-issue-0e41b47a`** ("a lightweight 'you've been here before, the way
back to X is...' hint when re-entering a previously visited overworld node")
reads close to `3ddba1f3` but is a different ask, checked rather than
assumed: `3ddba1f3` wants a bearing *angle* toward a place never visited
("the Iron Downs are roughly NNW of here"); this ticket wants the way back
to somewhere already stood in. The second one already ships. `wildBearing`
(`src/engine.ts:836-888`) walks the player's visited landmarks inside
whatever wilderness grid they stand in and prints the nearest one's name and
legs — "Black Thorn Stand: one west" — and `src/format.ts:226-229` calls it
unconditionally on every non-dark render, not gated behind a first-time flag
or a player choosing to look. That is a stronger version of the ask (every
screen, not just "when re-entering"), for exactly the case this report and
`P1-issue-2246e5db` both center on: large outdoor grids. It does not extend
to authored, non-grid rooms (settlements, hubs), but those are fewer,
already distinctly named, and an always-on line added to every authored
room realm-wide would hit the same "a universal hint costs more than the
ratchet has" wall this session has measured more than once (most recently
above, on Ashwood). Superseded; `queue/P2-issue-0e41b47a.json` moved to
`done/`.

**`P2-issue-52cb08d7`** ("'travel to a known place' only moves between
visited landmarks... until the game explicitly called it out after the
first two rooms") already fires at the earliest state permits, and already
says the exact thing the report wanted said. `travelAvailable`/
`knownLandmarks` (`src/engine.ts:892-1007`) require having actually stood in
a second landmark room — there is no way to explain the feature's scope
before that state exists, since the player has not yet seen the thing being
scoped. `src/engine.ts:3412-3414` fires the one-time hint the very next step
after the precondition first holds ("Once, the first time fast travel is on
the menu: a playtester walked the whole map on foot for ninety turns before
noticing the entry"), and its text already reads: "'travel to a known
place' moves you between the landmarks you have seen, not every room, in
one turn" — verbatim the clarification the ticket says was missing, just
necessarily a room or two after the fact rather than before the feature
exists to describe. Checked the fixed intro rules line too (`renderIntro`,
`src/format.ts:536-556`): it does not mention travel at all, so there is no
earlier, vaguer promise setting a wrong expectation either. Non-finding,
working as designed; `queue/P2-issue-52cb08d7.json` moved to `done/`.

One content change this entry (`world/reach/wm_wardmoor.json`); `npm run
verify` green before and after it (336/336 tests, all three worlds validate
and win-prove clean, both crawls clean, 0 over-cap menus), and
`scripts/audit-bearings.ts world/reach.json` clean realm-wide, both re-run
after the change and again just before finishing against the shared tree.
`world/reach/va_wood.json` was edited and measured for the Ashwood finding
above, then fully reverted — `git status` confirms it carries no diff.

### `P1-issue-4807bbde` is `d3907169`/`65675d14`'s third corroboration — same mechanism, still not a cheap fix

`P1-issue-4807bbde` ("Menu numbering shifts turn-to-turn as new options/items
appear, so a remembered menu number can silently map to a different action
next turn if not re-read carefully," `where: "general UI, most rooms"`, seed
11044) arrived the same minute as `P2-issue-1f61ce96` below. Checked first
whether this is the wave-6 conversation-paging bug
(`done/P1-issue-4839330e.json`, fixed by giving conversations `talkList`'s
whole-list numbering, `:5846-6008` above) wearing new words, rather than
assuming it's the older, still-deferred general mechanism just because "menu
numbering shifts" sounds like both.

It's the older one. `4839330e`'s fixed bug was a number resolving to the
wrong action *within one unchanged state*, purely because the page turned —
`talkmore`/`roommore`/`travelmore` are free, `BROWSING`-gated, non-turn-
advancing kinds, confirmed by that entry's own replay probe (`:5862-5889`).
`4807bbde` says "turn-to-turn" and "next turn" explicitly, and its `where` is
"general UI, most rooms," not a named multi-page screen the way `4839330e`
named "The Forge / Captain Vane's Tent." This is the *other*, cross-turn
mechanism: `allActions` (`src/engine.ts:2509-2517`) rebuilds a room's whole
option list fresh from the state *now* on every call, and `menuNumbers`
(`:2453-2456`)/`actionByNumber` (`:2477-2480`) number and resolve off that
fresh list's positions — so anything that changes what's legal shifts
everything after it. "As new options/items appear" generalizes
`d3907169`'s "an enemy dies or an item is consumed" to arrivals as well as
departures, but it's the same rebuild-every-turn arithmetic either way, and
it is exactly `done/P1-issue-d3907169.json`/`done/P1-issue-65675d14.json`'s
mechanism, already formally reaffirmed as deferred once already (`:4718-4809`
above, itself the second corroboration of the original single-report
triage at `:1187-1220`).

Re-checked whether this report moves a calculus that a second corroboration
already didn't, rather than assuming a third changes nothing by default. If
anything it's thinner than the first two: `d3907169` had a concrete
misclick ("hit 'use dried herbs'"), `65675d14` had a concrete slot shift
("speak with the company" 6→5), and `4807bbde` states only the general rule
with no specific wrong click or consequence named at all — nothing for the
`commits`/`late` mitigation (the conversation-ending/betrayal sort at
`talkMenuParts:2585`, the peaceable-attack `late` list at `roomMenu:2658`/
`:2686`) to attach to, the same gap `:4769-4802` already found in the first
two. The general fix's cost is unchanged from the original triage
(`:1209-1218`): non-positional numbering needs `State` to remember which
number was whose, touching determinism, the crawler, and the mock player,
for a benefit still unmeasured against real players. A third independent
report of the same low-stakes shape, with less anecdotal detail than either
prior one, is one more data point, not a change in what the fix costs — the
same principle this session has already applied twice: once to this exact
mechanism (`:4791-4797`) and once to an unrelated repeated ask
(`:3974-3989`). Noted in passing, not counted as a separate corroboration
here since it was resolved under a different ticket already: `4839330e`'s
Claim B first example (`:5903-5924`) independently reproduced this identical
mechanism too, and was already found to carry the same low-stakes shape.

Formally re-affirming the deferral with a third independent, dedicated
report now on record. No `src/` or `world/` file touched by this entry;
`npm run verify` untouched (same basis the prior two write-ups on this
mechanism used). `queue/P1-issue-4807bbde.json` moves to `done/`, joining
`d3907169`/`65675d14` on the same reasoning.

### `P2-issue-1f61ce96` is `39b85b76`'s second corroboration — same ask, still a bigger feature than it's worth

`P2-issue-1f61ce96` ("Long 'travel to a known place' lists paginate in fixed
chunks of ~10 with a 'X more' entry that sometimes required multiple clicks
to reach the desired destination, with no search/filter," seed 11043, filed
the same minute as `4807bbde` above) reads like it could be either of two
already-settled travel-menu findings: `P2-issue-39b85b76`'s "long list, slow
to find a landmark by name" (real, priced out, left open in `queue/` at
`:3296-3326`) or `P2-issue-3c4440fb`/`7f9e043b`'s "more"/"done" controls
drifting position on a short last page (real, priced out, closed to `done/`
at `:3869-3918`). Checked which, rather than assuming either from the
surface similarity.

It's `39b85b76`, not `3c4440fb`/`7f9e043b`. This report never mentions a
number repeating, a misclick, or a control landing somewhere unexpected —
`3c4440fb`/`7f9e043b`'s specific, already-priced-out shape. It says only
that reaching a far destination took several "more" clicks and that there is
no search/filter — exactly `39b85b76`'s shape ("making it slow to find a
specific far-off landmark by name alone"), plus one addition: this report
names "search/filter" directly, in its own words, where the prior entry's
"search or filter" framing was this document's own naming of "what's left"
once sorting was confirmed already shipped (`:3319`, "The remaining ask, a
search or filter, is a real UX idea..."), not a phrase any player report had
used yet.

That addition doesn't change what the ask costs, because the prior entry
never treated it as a throwaway aside to begin with — it was already priced
out on its own merits. `byTravelName` (`src/engine.ts:1075-1076`) already
sorts every travel list shown, flat or region-drilled, so the "slow to find
by name" half of both reports is already fixed. What's left is unbuilt
because the interface has no free-text primitive anywhere in `Action`
(`src/types.ts:501-522`, unchanged since that entry — every variant today is
still a `kind` plus fixed fields, nothing resembling a query string), so
"search" needs a new interaction primitive, not a content edit — a
materially bigger feature than either the sorting fix or the travel-menu
paging non-fix, and one this document already declined to build on a single
report. A second independent report asking for the same thing, this time by
name, is one more data point, not a change in what it would cost to build —
the same principle just applied above to the menu-numbering mechanism
(`:4791-4797`) and earlier to a third repeated turn-cost-estimate ask
(`:3974-3989`).

Given a second independent corroboration of a real ask this document has
already investigated seriously and found genuinely too large for a single
cycle, formally reaffirming the deferral rather than leaving it open
pending a report that would say anything different — matching the
precedent this session already set for `d3907169`/`65675d14`
(`:4804-4809`, "not left split between an open ticket and a closed one").
`queue/P2-issue-1f61ce96.json` and `queue/P2-issue-39b85b76.json` move to
`done/` together on that basis; `39b85b76` was not one of this entry's two
assigned tickets, but leaving a just-corroborated, identically-reasoned
finding split between an open file and a closed one would recreate exactly
what that precedent exists to avoid. No `src/` or `world/` file touched;
`npm run verify` untouched.

### `P1-issue-99234e3c` + `P2-issue-f8d507af`: the ring quest's real resolution fires at the Company Store, but the physical prop was never released

Both tickets are the same seed-11043 report split in two: "the 'Aldric's Ring'
quest completed via a ledger check at the Company Store (Cinderhall), but I
still carried the physical 'Aldric's iron ring' item for the rest of the
game with no dialogue option to actually hand it to Corporal Fenn" (P1), and
the general ask that follows from it — auto-resolve or flag leftover
quest-items instead of letting them persist silently (P2).

Read the whole `wm_q_ring` shape first rather than assuming the ledger check
and "hand it to Fenn" are the same step the player skipped. They are not:
`world/reach/ir_irondowns.json:222-302` (Company Store) gives three
alternate ways to get the ring off Mirren — force the strongbox (might,
`:222-244`), read the paid-off ledger line (wits, `:246-267`, what this
player did), or persuade her plainly (will, `:269-302`) — and all three
`move` the ring into inventory and set one of `rb_wm_ir_forced` /
`rb_wm_ir_cleared` / `rb_wm_ir_bought`. `wm_q_ring`'s own `done` condition
(`world/reach/wm_wardmoor.json:1896`) fires on any of those three flags —
retrieval, not delivery, is this quest's real, scored consequence, same as
its debt-settled reactions read elsewhere (`world/reach/mg_marrowgate.json:
2802-2808`, `world/reach/companions.json:2912-2916`, both keyed to the same
three flags, about the debt's *method*, independent of the prop). So the
ledger check is one of three ways to reach the *one* subsequent step, not a
second path around it.

That one subsequent step already exists: `fenn_ring_done`
(`world/reach/wm_wardmoor.json:1057-1095`), gated on `wm_asked_ring` plus any
of the three retrieval flags, fires once, pays score 6/xp 3, and gives
resolution-specific dialogue — this is the "debt-info line" the report
found, and it is in fact Fenn's side of taking the ring back. What it never
did was `move` the ring out of the player's inventory, so the "physical
prop" half of the quest just never closed; the player is holding an item
whose own hint (`world/reach/ir_irondowns.json:818`, "Corporal Fenn... would
want this back") promises exactly the destination this conversation reaches
without ever paying it off. Confirmed no other topic anywhere gates on
`["has", "wm_ir_keepsake"]` either (grepped the whole `world/`), so this
was not a case of a correctly-gated delivery topic sitting unreachable
behind a wrong id — the topic that should close the loop already existed
and ran, it just forgot the one effect that would have ended the item's
story.

Checked the realm's own convention before writing anything, per this
session's usual rule of not inventing a shape nobody else uses. Three
siblings, all "physical item, single destination, `hint` promising it back"
quests: `ir_marked_pick` ("Old Crick would want this back" —
`world/reach/ir_irondowns.json:804-808`) resolves at
`world/reach/ir_irondowns.json:1438-1465`, gated on `["has",
"ir_marked_pick"]`, and both branches `["move", "ir_marked_pick",
"nowhere"]`; `cp_bell_clapper` ("Abbot Corvin would want this back at the
bell tower" — `world/reach/cp_coldpass.json:405`) resolves at
`world/reach/cp_coldpass.json:306-320`, gated on `["has", "cp_bell_clapper"]`,
and moves it to `nowhere` too; `em_pip_keepsake` resolves at
`world/reach/em_emberfall.json:1076-1089`, same shape again. All three pay a
modest, one-time score/xp (4-5 / 2-3) on the same beat that clears the item.
`wm_q_ring` is the one quest in this family that skipped the `move` — not a
different, intentional design (a "keepsake" ring would need a hint that
reads that way, like `wm_oath_seal`'s "a curiosity now, nothing more"; this
one's hint is a live promise, not a closed one).

Fix matches the sibling shape and the task's own instruction not to invent a
second reward: added `["move", "wm_ir_keepsake", "nowhere"]` to
`fenn_ring_done`'s (unconditional) `fx`, right after the existing `score`/
`xp` (`world/reach/wm_wardmoor.json:1068`), so it fires on all three
resolution branches without touching any of them individually. Also gave the
`rb_wm_ir_cleared` branch's line a half-sentence of physical handover
("He takes the ring from you without another word.",
`world/reach/wm_wardmoor.json:1082`) — the `forced` and `bought` branches
already said "he turns it over"; `cleared` (this reporter's own path) was
the one branch that talked only about the debt and never the ring, which
likely made the missing payoff read even more like a dead end than the other
two would have. No `wm_q_ring` `done`/`stages` change: the quest's real
consequence is still the debt's method, resolved at the store, exactly as
the task brief anticipated ("if the ledger path already fully resolved the
quest's REAL consequence... this would just be closing the physical prop").
Confirmed via `node` against the bundled `world/reach.json` that neither the
master walkthrough nor any of its thirteen named `proofs` touches
`wm_asked_ring`/`fenn_ring_done`/`wm_ir_keepsake` at all (nor, for that
matter, `Corporal Fenn`/`Aldric` anywhere by name) — this content sits
entirely off the scored critical path, so the fix needed no walkthrough or
proof update.

For `f8d507af`'s general ask: checked how common this actually is before
treating "leftover quest item" as a realm-wide defect class, using a
scratch pass over every item in the bundled world (327 total) for the exact
false-negative shape `scripts/audit-items.ts` cannot see — an item granted
into inventory by authored content (`["move", id, "inv"]`) with zero
`has`/`!has` gates, zero targets, zero own-uses, and zero moves back out.
That tool's own `moves` tally is undirected, so an item's *acquisition* move
already counts as a "read" and hides it from the `--dead`/broken-promise
check that would otherwise have caught exactly this bug — worth noting as a
tool gap in its own right, since it's why `npx tsx scripts/audit-items.ts
world/reach.json --dead` reports 0 broken promises realm-wide despite the
ring (before this fix) being one. 87 items matched the shape. All but a
handful are the templated hollow-dungeon `*_loot` trophies (`cp_shrine1_loot`,
`em_cairn_loot`, `ir_barrow1_loot`, and ~70 more across every region), and
every one of those already carries an explicit closing hint — "a keepsake,
nothing more is owed on it," "a parting gift; nothing is owed on it," "past
its owner's needing... nothing is owed on it" — the exact "honest keepsake"
pattern `docs/authoring.md:966-978` already describes and already prices as
not a defect. A few one-off narrative tokens (`ir_oath_token`,
`va_wight_relic`, `va_fenfolk_carving`, `wm_oath_seal`, `th_free_chit`,
`mc_wax_lump`, `pw_hoard_silver`, `me_covenant_stone_cracked`) are the same:
descriptive trophies, no destination promised, nothing to close. Read every
one of them rather than trusting the hint regex alone.

Exactly one other item in the entire 327 matched the ring's actual bug
shape, not the keepsake shape: `kw_horn` ("the huntsman's horn",
`world/reach/kw_hollow.json:458-463`, hint "sound it whole at the Hunt's
Stand's horn-post..."). It has a fully-written closure conversation — Sabel
asking what should become of it, branching into "hang it at the post" or
"send it to the Keepers' Hall" (`world/reach/kw_folk.json:806-842`), both
narrating the horn leaving the player's hands — that never actually moves
`kw_horn` out of inventory either. Same bug, different region, also off the
walkthrough/every proof (checked the same way). Two confirmed instances out
of 327 items is a one-off pattern repeated once, not a realm-wide epidemic —
proportionate evidence against building `f8d507af`'s literal ask (a generic
engine-level auto-resolve/flag mechanism), which would mean loosening
"content before engine" and growing the DSL for a defect rate under 1%, each
instance cheaply fixable in its own content file the way this one was. Tried
twice to file the `kw_horn` finding as a follow-up task via `spawn_task`
(both calls timed out after 60s rather than returning an error or a task
id); it is written up in full above with exact file:line references in case
neither attempt actually landed. `queue/P1-issue-99234e3c.json` and
`queue/P2-issue-f8d507af.json` both move to `done/` on this basis — the
first fixed, the second answered with the survey it asked for rather than
the generic mechanism it proposed.

One more thing worth a reader's attention: mid-session, a concurrent change
to `src/engine.ts` (not this entry's own — already present in the shared
tree before this entry started, alongside an in-progress `test/fx.test.ts`
and `world/reach/hb_hollow.json`) now emits a generic "`<item>`: gone."
event whenever a `move` fx takes an item out of inventory to anywhere but
`"inv"`. That means this entry's `["move", "wm_ir_keepsake", "nowhere"]`
will itself now surface as a visible "Aldric's iron ring: gone." line when
`fenn_ring_done` fires — a nice, unplanned confirmation that the item's
departure is no longer silent, in the spirit of `f8d507af`'s ask, from a
mechanism this entry didn't build and isn't claiming credit for.

One content change this entry (`world/reach/wm_wardmoor.json`, the
`fenn_ring_done` `fx` and its `rb_wm_ir_cleared` line). `npm run verify` was
red partway through this entry — `test/budget.test.ts`, "the observation
budget holds along every other proven route (reach)", three routes over cap
in `mg_hollow_throne`/`va_throne`/`regent_deposed`'s average — confirmed via
`git stash` that the failure was byte-identical with and without this
entry's `wm_wardmoor.json` change, so it belonged to the concurrent
`src/engine.ts` work described above (plausibly its new "gone." event
pushing those specific screens over budget), mid-flight in the shared tree,
not to this entry. That sibling work reached its own green before this one
finished: a full `npm run verify` re-run just now (typecheck, all 337
tests, all three worlds validate and win-prove clean, both crawls clean, 0
over-cap menus, mock and measure both complete) is clean end to end with
this entry's change included.

### `P1-issue-30e9b264.json` and `P2-issue-687e8b63.json`: the Regent's Writ now names its cost before the envoy seals it

Same wave-7 report (`s11043`), bug half and suggestion half of one finding:
claiming the Regent's Writ at Highward "retroactively spawned an
urgent-sounding 'Ironbound column burning the Reach' consequence quest with
no prior warning," and the fix should "surface the consequence... before
confirming it, not after" — the same "flag the tradeoff at the point of
choice" shape this document has fixed before (the crown's `va_full_rite`,
`:4155-4218`; the barrow's hunter's-gap shortcut, `:4447-4495`).

**The mechanism is the Ironbound march, working exactly as designed and
already documented**
(`docs/superpowers/specs/2026-09-08-the-realm-moves.md:30-34`; landed per
`:428-431`). `wm_envoy`'s "writ" topic (`world/reach/wm_wardmoor.json:1352-
1400`) grants `regent_writ` on any of three routes — `watch_sworn`,
`hollows_burned >= 1`, or `rep_watch >= 2` — and `ir_irondowns.json:2444-
2447`'s clock entry `iron_march_begins` fires the instant either
`hollows_burned >= 1` OR `flag regent_writ` is true, setting `iron_march`
and saying "The Ironbound have their answer now, and they mean to use it."
Picking a dialogue topic spends a turn (`talk` is not in `engine.ts`'s
`BROWSING` set, `:139`, so `spentTurn` is true, `:3233-3237`), and the
world's clock runs in the same `step()` call right after the player's own
action (`:1996-2009`) — so for a player who already qualifies, that
announcement, plus quest `ir_march` ("The Column") starting with its own
stage text "An Ironbound column burns its way down the Reach unbidden"
(`ir_irondowns.json:2855-2868`, the exact "Ironbound column burning the
Reach" language the report quotes), lands in the very same response as the
grant. That is the "retroactively spawned" feeling: not a bug in the
clock, which is doing precisely what `the-realm-moves.md` designed it to
do, but zero forward signal anywhere in the only text the player reads
before that response arrives.

**It is not mechanically urgent, only tonally so.** `iron_march_warned`'s
general notice fires 10 turns after the march starts
(`ir_irondowns.json:2450-2453`); the earliest any hold actually burns is
`iron_march_burn_kw` at `since iron_march >= 60` (`:2489-2493`), and the
Preceptor can be stopped outright any time before that. A player who reacts
within about 60 turns loses nothing — but the writ's own text says nothing
about that either, so a player has no way to read "urgent" against "there
is real time to act" without already knowing the clock's internals.

**The gap was real and exactly where the report puts it.** Read all six of
the writ's grant lines (`wm_wardmoor.json:1352-1445` — three routes each
for the first ask and the retry) and the shared prompt above them: none
mentions the Ironbound, a march, or any cost, only reward framing ("I'll
write you passage to Marrowgate myself... The writ is yours"). Unlike
burning a hollow — already legible as an aggressive act with its own
well-known fallout — the `watch_sworn`/`rep_watch>=2` routes have nothing
to do with the Ironbound at all, so a player working the peaceful path has
no contextual hook to infer the tie.

**Checked the established convention before writing anything.** This
engine has no confirm/cancel step for a dialogue choice; `va_full_rite`'s
fix (`va_barrow.json:438`) and the hunter's-gap fix (`va_barrow.json:102`)
both flag the tradeoff inside the same action's own text, at the point the
choice resolves, rather than behind a separate gate that does not exist
here. What this ticket doesn't share with those: the writ's grant sits
three `if`-branches deep, in six separate `say` lines (three qualifying
routes times ask/retry). Patching all six would cost six times the text
for one fact and drift the moment any branch's wording changed later. The
topic's shared outer `say` (`:1356`, topic id `writ`) is read exactly once
per playthrough, before the nested `if` resolves — for a player not yet
eligible, strictly before they go earn the requirement; for a player
already eligible, the first sentence of the same response as the grant.
Because `writ_retry`'s own condition (`:1404`, flag
`said_wm_envoy_writ_no`) can only ever be reached by having already asked
via `writ` once, every writ recipient sees this one line at least once, at
or before the grant, on every route — one edit, full coverage, no drift
risk across the six grant lines.

**Fix:** appended seven words to `wm_wardmoor.json:1356`: "...Have you done
either yet?" → "...Have you done either yet? (Either way, the Ironbound
march.)" — "either way" is doing the real work, naming that the tie holds
regardless of which of the two requirements the player actually satisfied.
184 → 219 characters, inside the 220-char topic-`say` cap
(`docs/authoring.md:911`) with one character to spare.

**Budget.** This screen is not on the main walkthrough and is reached by
exactly one proof, `regent_deposed#warden_crown`
(`world/reach.json:2838-2991`) — confirmed by grep that no other proof and
not the walkthrough itself ever visits `wm_envoy`'s "writ"/"writ_retry"
topics. That proof carries no `PROOF_BUDGET` entry
(`test/budget.test.ts:247-249` notes it already "meets the real bar on both
counts... needs no allowance at all"), so it is held to the live 450 avg /
1100 max, same as an unlisted road. The status ratchet
(`test/format.test.ts`) is untouched and unaffected: this fix is a
one-time topic `say`, not anything `renderStatus` prints. The shared
working tree while this was in progress also carried unrelated, in-flight
work from other agents on this same file and on `src/engine.ts` (a new
generic item-departure event, landed and reconciled by the entry just
above this one) that moved several *other* proofs' numbers around — none
of it touches `wm_envoy` or `regent_writ`. Isolated this change the same
way this document's own precedent does (`:4280-4299`): `git worktree add
--detach` at HEAD, `node_modules` symlinked in, only this one-line diff
applied. There: `npm run verify` exit 0, 336/336 tests, all three worlds
validate and win-prove, both crawls clean; `scripts/budget.ts
world/reach.json` — walkthrough unchanged (439.7546 avg, 1076 max; this
screen isn't on it), `regent_deposed#warden_crown` 448.77 → 448.99 avg
(+0.22, the expected ~35 added characters spread over 159 screens), max
unchanged at 1092.

`queue/P1-issue-30e9b264.json` and `queue/P2-issue-687e8b63.json` moved to
`done/`.

### Wave 7's bearings-content claim: Thornwold's wood corroborates Ashwood's gap and pays for 14 of its 21 missing cells; Wardmoor's cluster isn't a coverage gap at all

`P1-issue-69ba212f` ("Thornwold's Split Beech/Deer Break/Black Thorn Stand
cluster, Wardmoor's Peat Score/Tower Rise cluster... bearings often didn't
list the specific landmark being sought until much closer to it") and
`P2-issue-76307816` (same report, "a lightweight compass/quest-arrow... that
always points toward the nearest unresolved quest marker, even from a
distance") are wave 7's own version of ground this session has already
settled: exit reciprocity (confirmed not a bug, `:4530-4629`), the
deliberately-deferred compass/waypoint-angle ask (`3ddba1f3`, `:4061-4068`,
`:6014-6018`), and the Iron-Downs/Wardmoor-gateway placement-gap pattern
(`:4052-4153`, `:6071-6114`) against Ashwood's real-but-not-cheap grid gap
(`2246e5db`, `:6020-6069`). The new question was narrower than "is the
mechanism missing somewhere": does `bearingsHere` itself have a distance
cutoff that would make the report's specific mechanism claim literally true,
and are the two named clusters cheap fixes (Iron-Downs-shaped) or expensive
ones (Ashwood-shaped)?

**`bearingsHere` (`src/engine.ts:753-787`) has no radius or "how far away"
cutoff, but two other things add up to the same experience.** First,
`BEARINGS_CAP = 3` (`:701`): at most 3 places named per call, quest
destinations first (up to 2 slots, `wanted`/`quests`, `:770-775`), then the
nearest landmark-tagged rooms filling what's left (`named`, `:776`), all
drawn from `walkFrom`'s unrestricted, gate-blind, whole-region BFS
(`:730-751`) — nearest-first ordering, but no distance limit on what *can*
be named, only on how many *are*. Second, a non-quest destination is only
ever named if `world.rooms[id].landmark` is set (`:776`, checked against the
room, not the exit flavor text that sometimes carries a similar-looking
`landmark` field of its own) — an authorial tag, not automatic from having a
`name`. A quest's own `.at` room is exempt from that tag requirement and
carries no distance limit either — confirmed by rendering, not inference
(below). So the report's literal claim, a hard "too far away" cutoff, does
not hold; what does hold is that `BEARINGS_CAP`'s nearest-3 ranking lets a
tagged landmark get crowded out by closer competition until the player is
close enough to outrank it, which *reads* like "didn't list it until much
closer" even though nothing computes a radius.

**Thornwold's cluster is a genuine coverage gap, the same shape as
Ashwood's, not a `BEARINGS_CAP` side effect.** `th_wood`
(`world/reach/th_thornwold.json:2629-3136`, w=5 h=5, 3 walls, 22 open cells)
carried exactly one `["bearings"]` action on its whole grid —
`th_heartwood_bearings` at the dead-center cell `th_wood_2_2` (`:2888`) —
plus the region's own gate hub, `th_gate_bearings` at Camp Gallows (`:180`).
All three of the report's named rooms (Black Thorn Stand `th_wood_0_1`,
Deer Break `th_wood_1_1`, The Split Beech `th_wood_2_1`) had none. That's 21
of 22 cells without the mechanism every sibling grid carries — worse
coverage than Ashwood's 0 of 16, not better. None of these three names, nor
Wardmoor's Tower Rise or Peat Score, is ever referenced by any quest, NPC
line, or other room's text anywhere in the realm (grepped each across
`world/reach/` individually) — they are plain flavor spots, and of the five
only Black Thorn Stand carries a `landmark` tag at all
(`th_thornwold.json:2768`); Deer Break, Split Beech, Tower Rise and Peat
Score were never nameable regardless of distance, being both untagged and
un-quested.

Replayed the walkthrough and all 13 proofs through `th_wood` directly
(`replayWalkthrough` against `state.visited`, not guessed): only 7 of the 21
missing cells are touched by any proven route at all —
`th_wood_0_1/1_1/2_1/3_1/4_1` (the report's whole named row, edge to edge)
plus `0_2` and `4_2` — and every single proof that enters the grid touches
exactly that same 7-cell row, a straight crossing from Camp Gallows west to
the region's far side. The other 14 cells are touched by none of the
walkthrough's or any proof's `visited` list. Added the sibling-grid
`["bearings"]` action to those 14 untouched cells only
(`world/reach/th_thornwold.json`, `th_wood_bearings_x_y` ids, the same
`{"free": true, "fx": [["bearings"]]}` pattern every other grid uses, then
`scripts/fmt-json.mjs` on the file). Confirmed with `git stash` on just this
file that `scripts/budget.ts --terse` is byte-identical with and without it
(`avg 439.7509 max 1076 sum 118293 screens 269`, both times) — these cells
are entirely off the walkthrough, the same "free" shape as Wardmoor's
gateway-road fix.

Tried the identical fix on the other 7 (the row the report actually names)
and it is not affordable, measured directly rather than assumed: all 21
cells together broke 5 of `test/budget.test.ts`'s ratchets —
`regent_deposed` avg 452.8 > 451, `reach_burned` avg 452.2 > 451,
`gray_crown` avg 453.4 > 452, `reach_at_rest#scout` avg 453.6 > 452, and a
new max violation, `reach_at_rest#warden` max 1177 in `th_wood_3_1` > 1100.
Walked the cost down cell by cell to see how far "some of the row" could go:
dropping just the max offender (`th_wood_3_1`, Rope Larder — an NPC room
already once trimmed to fit these same ratchets, for an unrelated reason,
per `test/budget.test.ts:96-114`) cleared the max violation but left all 4
avg overages; dropping to just the report's own 3 named cells (`0_1/1_1/2_1`)
still failed `regent_deposed` and `gray_crown`; dropping to a single cell
(Black Thorn Stand alone, keeping the other 20) still failed `regent_deposed`
by 1.2 avg characters. Only "none of the 7" clears every ratchet. Checked for
a free trim before writing this off, the way the Iron Downs fix did first:
`scripts/audit-echo.ts world/reach.json` finds nothing on this route beyond
one unrelated cross-region name reuse ("Wood's Edge," also used in
`ff_fells`) — no in-scope redundant text to cut and pay for it. This is the
same real-but-not-yet-affordable class of gap `2246e5db` already tracks for
Ashwood — smaller in degree here (single-digit average characters over, not
Ashwood's several-hundred-character bill) but the same shape, so it is not
filed as a second, parallel ticket: `2246e5db` (still open in `queue/`) now
covers both regions in substance; this entry is the record of Thornwold's
half of it.

**Wardmoor's Peat Score/Tower Rise half does not reproduce as a coverage gap
at all.** `wm_moor` (`world/reach/wm_wild.json`, w=6 h=5, 4 walls, 26 open
cells) already carries a `["bearings"]` action on all 26 of its cells
(`wm_bearings_x_y`, confirmed by direct count, not sampling) — this grid has
been fully covered since at least wave 4 (`:4078-4082` already lists
`wm_wild` among the grids done). Tower Rise (`wm_moor_1_1`) and Peat Score
(`wm_moor_2_1`) are exactly like Deer Break and Split Beech: named flavor
cells, no `landmark` tag, never a quest target, so `bearingsHere` never
prints their names verbatim at any distance — but the mechanism around them
is fully present, including at the two things a player standing in that
exact corner might plausibly be seeking: Beacon Hill, the Dark Beacon
quest's destination (`wm_moor_0_2`, `landmark`-tagged,
`world/reach/wm_hollow.json:527-537`, `.at: "wm_moor_0_2"`), and Boot-Track
Hollow, the Lost Sentry's (`wm_moor_3_1`, untagged but quest-named,
`:539-549`, `.at: "wm_moor_3_1"`). Rendered `bearingsHere` at all 26
`wm_moor` cells with both quests set active (`wm_beacon_known` and
`wm_wight_known` flags, no `done` condition met) to check this directly
rather than assume the wave-six fix still covers it: both destinations name
themselves in the sentence from every one of the 26 cells, nearest and
farthest alike — e.g. from `wm_moor_5_2` (Cliff Edge, the single farthest
cell from Beacon Hill from this stretch of moor), "the beacon hill — The
Dark Beacon, five west" and "Boot-Track Hollow — The Lost Sentry, one north,
then two west" both still print. Nothing here reproduces "didn't list it
until much closer" — the quest-priority fix from wave six has no distance
horizon, and the two names the report itself picked out were never going to
be sought by anything in the game.

**`P2-issue-76307816`** ("a lightweight compass/quest-arrow... that always
points toward the nearest unresolved quest marker, even from a distance") is
confirmed to be the same shape as `3ddba1f3`'s already-deferred
compass/waypoint-angle ask, and a larger one: `3ddba1f3` wants a static
angle toward one known place; this wants the engine to rank every currently
open quest's location by distance from wherever the player stands and
always surface the nearest — which needs everything `3ddba1f3` needs (a
bearing *angle* toward a place, since `bearingsHere`/`wildBearing` both work
in leg-counts through the graph the player has actually walked, never a
compass-rose angle) plus live multi-target ranking on top of it. Not
narrower on inspection, so it is superseded the same way `15a4244d` was
(`:6116-6134`): the ask is real, already tracked, and this entry doesn't
reopen it a second time under a new id.

One content change this entry (`world/reach/th_thornwold.json`, 14 new
`["bearings"]` actions on `th_wood`'s untouched cells). `npm run verify`
green in the shared tree (337/337 tests, all three worlds validate and
win-prove clean, both crawls clean, 0 over-cap menus) — run fresh at the end
of this entry, after the concurrent `wm_wardmoor.json`/`companions.json`/
`va_barrow.json`/`hb_hollow.json` work landing alongside it. `node --import
tsx scripts/audit-bearings.ts world/reach.json`: realm-wide 0 of 928 legs
wrong; `--prefix th` alone went from 2 bearings actions / 6 legs walked (0
wrong) before this entry to 16 actions / 48 legs (0 wrong) after — exactly
the 14 new actions × 3 legs each (`BEARINGS_CAP`) this entry added, measured
before and after with `git stash` on just `th_thornwold.json`, not assumed
from the diff. `queue/P1-issue-69ba212f.json` and
`queue/P2-issue-76307816.json` moved to `done/`; `queue/P1-issue-2246e5db.json`
stays in `queue/`, open, now understood to cover Thornwold's `th_wood`
alongside Ashwood's `va_wood` as the same class of gap.

### `P1-issue-6f775398` is `4807bbde`'s own evidence — no item-identity bug, and the honest fix costs more budget than the realm has

`P1-issue-6f775398` ("'dried herbs' vanished from inventory after an
unrelated 'use bitter forest bark' action without a clear consumption
message tied to it," `where: "The Drying Racks, Fenmarch"`, seed 11044)
and `done/P1-issue-4807bbde.json` ("Menu numbering shifts turn-to-turn...
a remembered menu number can silently map to a different action next
turn," `where: "general UI, most rooms"`) are not two reports — same
`evidence.report` (`playtest-2026-09-15T22-54-15-584Z-s11044.json`), same
seed, same `builds` (`bf108bf`/`8bacaa39`), same `created` timestamp to the
millisecond. One playtest session, one `bugs[]` array, split into two
tickets by triage. `4807bbde` is already closed: the third independent
corroboration of `d3907169`'s formally-deferred menu-renumbering-across-turns
mechanism (`:6183-6241`), which was *first filed* quoting this realm's
canonical example of the shape — "I once meant to attack but hit 'use dried
herbs'" (`:1189-1193`). This entry is that report's other half, investigated
on its own terms rather than assumed to be the same finding twice.

**Checked for an actual item-identity bug first**, per the ticket's own
steepest hypothesis: does using one item ever move a *different* item out of
inventory? `va_herbs2` ("dried herbs," `world/reach/va_wood.json:534-539`)
and `th_bitter_bark` ("bitter forest bark,"
`world/reach/th_thornwold.json:1271-1284`) each `move` only their own id on
use — grepped both ids' every appearance in `world/` (three and two hits
respectively: each item's own def, its one grant site, and `th_bitter_bark`'s
one loot-table listing at `:2886`) and none crosses into the other's fx.
`fd_drying_racks` (`world/reach/fd_fenmarch.json:476-495`), the reported
location, has exactly one action ("take the coil of tarred rope") and no
`onEnter` — nothing there touches either item at all; both are carried in
from elsewhere (`va_herbs2` handed out in the Vale's Ashwood, `th_bitter_bark`
found in Thornwold, hundreds of turns and two hold-crossings before
Fenmarch). Generalized the check realm-wide rather than trusting two items
looked at by hand: no item's `use` fx, anywhere in the realm's 327 items,
`move`s an id other than itself or its own declared `target` — a scripted
recursive walk of every `use` block (including nested `if` branches) found
zero violations. Codified as `test/reach.test.ts:50-70`, permanent and
free (no rendered screen, no budget cost): the exact shape this ticket
worried about — a copy-paste `use` block quietly moving someone else's item
— cannot reappear unnoticed.

**What actually happened, best-supported account:** `move` out of `inv`
prints nothing (`src/engine.ts`'s `move` case, `:1353-1373`) — unlike the
pickup side, which always says `"<item>: obtained."` (`:1362`), consuming an
item says only whatever `say` fx happens to ride alongside it, never the
item's own name or "gone." Both items here use exactly that pattern
(`["hp",3],["move",id,"nowhere"],["say","Bitter, ..."]`) and, worse for
telling them apart afterward, near-identical flavor text — "Bitter, but they
ease the ache." (herbs) against "Bitter as the name promises, but the ache
dulls fast." (bark). `va_herbs2` is handed out at the very start of the
game (`va_wood.json:657-661`, "herbs for the road"); Fenmarch is an eastern
hold reached only after crossing at least one other. On a run long enough to
reach Fenmarch with both items ever carried, using the herbs for their
one-time heal is easily forgotten by the time a second "bitter... ache" item
gets used somewhere else entirely — exactly the ordinary, self-corrected
memory lapse `d3907169`'s own case ("a minor, self-corrected item waste,"
`:4777`) already names, possibly *preceded* by an actual instance of that
still-open mechanism: a shifted menu number silently executing "use dried
herbs" on a turn the player meant something else, unnoticed until much
later for the same missing-message reason. No stored trace distinguishes
the two — `runs/playtest/20260915T222403/player-1-seed-11044.json` is the
session's final result object only (`result`/`usage`/timing fields), not a
turn-by-turn log; this realm's playtest harness doesn't retain one. Either
account is a known, already-priced-in shape, not a new engine defect.

**Tried the generic fix anyway**, since a missing "X: gone." is a real,
fixable gap in its own right regardless of which account is true. Built and
measured it twice with `scripts/budget.ts`/`test/budget.test.ts`, the
project's own tools, not by eye:

1. Fully generic — announce on every `move` fx that empties an item from
   `inv`, wherever authored (mirroring the "obtained." symmetry exactly).
   Broke `test/budget.test.ts` immediately: `proofs.regent_deposed: avg
   452.1 > 451`, `proofs.reach_burned: max 1125 in mg_hollow_throne > 1100`,
   `proofs.reach_at_rest#devoted: max 1118 in va_throne > 1100`. Cause:
   the throne's burn/rite endings each spend one or more items (Ironbound
   oil, the Vale's crown) in the same already-maxed screen `test/budget.test.ts`'s
   own "item 8" cuts (`:85-121`) fought down to the ceiling with nothing
   spare, and a second mechanical line re-added exactly the width that pass
   removed.
2. Scoped to the `use` action's own consumption only (`step`'s `case
   "use"`, `src/engine.ts:3274-3279`) — never fires from a scripted
   ending's own `move`, so `mg_hollow_throne`/`va_throne` stopped moving.
   Still broke it, differently: `proofs.regent_deposed: avg 452.8 > 451`,
   `proofs.reach_burned: avg 452.2 > 451`, `proofs.gray_crown: avg 453.4 >
   452`, `proofs.reach_at_rest#scout: avg 453.6 > 452`, and
   `proofs.reach_at_rest#warden: max 1177 in th_wood_3_1 > 1100` — the last
   one not even a ratcheted allowance (`reach_at_rest#warden` carries no
   `PROOF_BUDGET` entry, "meets the real bar both ways now" per
   `test/budget.test.ts:239-246`), so this is 77 characters over the
   literal, non-negotiable 1,100 cap. Measured the baseline first
   (`scripts/budget.ts world/reach.json`, no fix applied): these roads sit
   at 451.95/451.56/452.58/452.48 avg and 1097/1100 max against ceilings of
   451/451/452/452 and 1100/1100 — `reach_at_rest#devoted`'s max is exactly
   1100 with zero characters spare before either fix ever touched it. There
   is no room on these specific roads for one more character of anything,
   let alone a new line, regardless of how the line is worded or where in
   the code it's attached.

Reverted both attempts in full (confirmed via `git diff --stat src/engine.ts`
and `test/fx.test.ts`: byte-identical to `HEAD`, nothing staged from either
try). Per `AGENT.md`, the ratchet may only turn down; making one of these
roads' numbers fit this fix would be exactly the move it exists to forbid,
for a message this investigation cannot even prove would have prevented the
report (see the two competing accounts above). Worth a reader's notice: a
concurrent, apparently identical generic attempt was visible mid-session in
this same shared tree, by whoever was working `P1-issue-30e9b264`/
`P2-issue-687e8b63` at the time (`:6424-6433`, `:6437-6448` — "a new generic
item-departure event," later "reached its own green" per that entry's own
account). It is not present in `src/engine.ts` now (no diff against `HEAD`
at the time of this entry either), consistent with a later hand finding the
same wall this entry did and backing it out; this entry does not depend on
that history; either its edits fully unwound before this entry started or a
close of this window happened to be the writing.

No `src/` or `world/` file touched by this entry. One test file added
(`test/reach.test.ts`, the realm-wide `use`-effect scan). `npm run verify`:
337/337 tests, all three worlds validate and win-prove clean, both crawls
0 over-cap, mock and measure complete — exit 0. `queue/P1-issue-6f775398.json`
moves to `done/`: no code bug, corroborates two already-understood
mechanisms (the same session's own `d3907169`-lineage menu drift, and
ordinary long-run forgetting sharpened by a real but currently unaffordable
missing-message gap), and leaves a permanent, free regression against the
one thing that would have been a genuine defect.

### Wave 7: the settle-it DC and status-flag asks reconfirmed; a companion-deadline dropout, a silent quest journal, and a false "they agree" all closed

Six items, each read in full and cross-referenced against wave 5/6 and this
session's own prior work before anything was touched, per this wave's brief.
Three close on cross-reference alone with no content change; the other three
(one bundled pair, `dc7b6f14`/`1ccc55c0`, plus `7aa85f96` and `d9caff0e`) each
turned up one genuinely new, narrow wrinkle the cited prior fixes hadn't
reached, and all three are now fixed.

**`P2-issue-0e243972.json`** — "consider lowering the DC or removing the
double-disapproval penalty on a failed 'settle it' attempt, since it
currently punishes the diplomatic option harder than just picking a side."
Proposes the same two remedies `P1-issue-234f8306` (wave 5,
`docs/roadmap.md:4630-4679`) already weighed against the realm's own numbers
and declined: DC 11 is the realm's own modal will-check value (82 of 157
checks, 52%), a free no-roll "leave it between them" safety valve sits on
all 18 disputes, and a missed settle (-1/-1 regard) costs strictly less in
expectation than a guaranteed side-pick's -2. Re-verified live rather than
trusted: `src/engine.ts:1217-1221`'s own comment on `escalatedDc` still
reads "the companion-dispute checks already cost regard with BOTH
companions on a miss, by design... the double cost is the design," and the
Lys/Osk pair's three settle/side/stay ids (`companions.json:1017`, `:2305`,
`:2331`) are unchanged. This report (seed 11043) is a third data point on a
mechanic already reaffirmed twice, not a new one. No content change.
`queue/P2-issue-0e243972.json` moved to `done/`.

**`P2-issue-2f3d20ac.json`** — "Let 'status' flag which open quests will
become permanently unavailable soon, not just list them as open." Same wall
as `be79b069`/`fc1a4039` (`docs/roadmap.md:3959-3989`, still open on
purpose) and the "flagging *which* open threads are 'hold-local' versus
'persist'" gap `5350baa3`'s own triage already named and left for them
(`docs/roadmap.md:3950-3957`): the engine has no "which side of this
point-of-no-return gate does this quest's content fall on" concept, whether
the ask is phrased as a turn count or a boolean flag — both need the same
not-yet-built per-quest metadata. A flag is a smaller ask than a full
estimate in principle, but it hits the identical missing concept, not a
cheaper version of it. Corroborates; doesn't reopen the feasibility case.
`be79b069` and `fc1a4039` stay in `queue/` as the canonical open ask;
`queue/P2-issue-2f3d20ac.json` moved to `done/` as a duplicate of it, the
same disposition `5350baa3` got for the same reason.

**`P2-issue-7aa85f96.json`** — "crossing into Coldpass/Marrowgate
permanently locks out unfinished companion quests (Tamsin's mine grief
never got closed) — the warning appears only at the Pass Gate itself." The
Pass Gate's own wording is not the gap: `d1633b19` (wave 5) already added
"own" to both crossings (`cp_coldpass.json:46`, `sk_saltkerns.json:103`,
both currently read "A companion's own grief left unfinished there stays
unfinished..."), and Tamsin's arc is real and exactly on point — `q_tamsin`,
"What the Mine Took" (`companions.json:5318-5343`), is literally about a
collapsed mine at Cinderhall, one of the four companion-arc quests the
`d1633b19` write-up already confirmed name "before Coldpass" outright.

That last clause is where the residual gap actually was, checked fresh
rather than assumed from the citation: all four companion quests (`q_lys`,
`q_osk`, `q_vell`, `q_tamsin`) name "before Coldpass" in only their *first*,
no-progress-yet stage (`companions.json:5290-5293`, `:5312-5315`,
`:5361-5364`, `:5337-5341`), and drop it from every later stage of the same
quest — the `lys_brother_found`/`th_entered`, `osk_family_found`/
`fd_entered`, `said_vell_bg_marrowgate`/`hb_entered`, and
`tamsin_mine_truth`/`ir_entered` stages (8 across the 4 quests) all showed
the ongoing state ("You're in the Iron Downs. Ask after the collapsed mine
at Cinderhall.") with no deadline at all. `ir_entered`/`th_entered`/
`fd_entered`/`hb_entered` are permanent onEnterOnce flags, never cleared
anywhere in `world/reach/` (checked directly: zero `["clear", "*_entered"]`
hits) — so one step into the target region, often the very next turn after
first hearing the reminder, silences it for the rest of that quest's open
life. From that point on, until the Pass Gate itself, the *only* remaining
Coldpass warning a player sees for that specific thread is the generic gate
text — which is exactly "the warning appears only at the Pass Gate itself,"
just not for the reason a wording-only check would have found.

Fixed by extending "before Coldpass" (or the connective each quest's own
fallback stage already used) to all 8 open, not-yet-resolved stages:
`companions.json:5282` (Lys, found), `:5287` (Lys, at Camp Gallows), `:5304`
(Osk, found), `:5308` (Osk, in Fenmarch), `:5352` (Vell, in Hollowbrook),
`:5357` (Vell, heard Marrowgate), `:5330` (Tamsin, knows the truth), `:5334`
(Tamsin, in Iron Downs) — each a short appended clause, longest new string
112/120 against the quest-stage budget (`scripts/lint-world.ts:22`). None
of these four quests are on the proven walkthrough or in any proof (checked
directly: no walkthrough or proof label touches Lys/Osk/Vell/Tamsin's
personal-arc rooms or topics), so `scripts/budget.ts` and the status-ratchet
test are unaffected by construction — confirmed after the fact rather than
assumed. `queue/P2-issue-7aa85f96.json` moved to `done/`.

**`P2-issue-d9caff0e.json`** — "The relationship between 'promise the
reeve' and 'ask the priest's blessing' (order matters, but only revealed
via an NPC hint at the inn) wasn't signposted in the quest text itself."
`P2-issue-0f4d5511` (wave 6, `docs/roadmap.md:5402-5469`) already fixed the
one silent NPC line (the priest's `blessing` accept variant,
`va_village.json:710`) and confirmed the reeve's own `doors`/`promise`
topics and the innkeeper's `factions` topic all state the order rule
plainly. This ticket's framing points somewhere none of that touched: "the
quest text itself," as a surface distinct from any NPC's dialogue — the
`status`-visible quest journal.

There is such a quest, and it was silent on exactly this. `va_doors` ("The
Barrow Doors," `world/reach/va_barrow.json:790-811`) is a real,
`status`-visible quest that starts the moment the reeve's `doors` topic
fires. Its fallback stage (live from quest-start until the player promises
or the king is resolved — potentially many turns, since declining or
delaying leaves it active) read "The reeve wants the barrow sealed after;
the priest wants it open. Promise, or don't — the doors wait at the
throne." — true about the tension, silent on the order-lock. A player
reading only `status`, never re-asking either NPC, would see two competing
wants and no hint that sequencing is the actual mechanic (confirmed still
true: only promising *first* forecloses anything, per `0f4d5511`'s own
mechanics check, unchanged). Fixed at `va_barrow.json:807`: "...the priest
wants it open — see him first if you want both. The doors wait at the
throne." — reusing the reeve's own established phrase ("if you want both,"
`va_village.json:417`, `:430`) rather than inventing new wording, and net
**one character shorter** than the line it replaced (116 → 115), so no
budget risk even though this stage sits on the main walkthrough (the
"decline to promise" branch). `queue/P2-issue-d9caff0e.json` moved to
`done/`.

**`P2-issue-dc7b6f14.json`** and **`P2-issue-1ccc55c0.json`** (bundled, same
underlying surface) — dc7b6f14: "Numeric evidence puzzles (mere-stone vs
ring-ditch vs causeway for 'Which King') gave conflicting answers 2-vs-1
with no in-fiction confirmation of which was authoritative until the naming
succeeded." 1ccc55c0: "a brief recap of who said what evidence when
multiple conflicting clues feed one decision." Different from the
already-fixed hint-directionality gap (`P1-issue-c2b703e1`,
`docs/roadmap.md:3722-3807`, which gave `hb_q_evidence` an `at` for every
partial-evidence state) — that fix never touched what the stage *text*
claims, only where it points.

Read `hb_q_evidence` (`hb_hollow.json:618-664`) and all three evidence sites
(`hb_wild.json`) in full rather than assuming "2-vs-1" was purely a
legibility question. It is a real structure, and it is also a real bug, not
only an unclear one: the causeway stone (`hb_wild.json:115`, and its
grace/might/will variants at `:132`, `:152`, `:172`) and the ring-ditch
(`:590`, variants `:607`, `:627`, `:647`) both independently name Caelrin;
the mere-stone (`:711`, variants `:728`, `:748`) names Roderic, and its own
text already flags that answer as folk-repetition rather than record ("Sure
of itself, the way anything repeated long enough gets to sound"). Ossian
has zero supporting evidence, openly admitted by its own "settle on Ossian"
flavor text ("Nothing you've found points to him either way — it would be a
plain guess," `hb_hollow.json:385`). `hb_speak_name`'s actual branching
(`:396-437`) confirms Caelrin is simply the true answer outright,
independent of how much evidence was gathered — this was never a computed
majority vote, it's three discoverable hints (two true, one folk-belief,
one decoy) toward a fixed fact, and a player can name any of them blind.

But two of the three "exactly-2-of-3-found" quest stages misrepresented
that structure. `hb_evidence_ringditch` + `hb_evidence_merestone` (Caelrin
+ Roderic — sources that disagree) was captioned "The ring-ditch and the
mere agree" (`:636`, old text), and `hb_evidence_causeway` +
`hb_evidence_merestone` (same conflict) was captioned "The causeway and the
mere agree" (`:641`, old text) — both false. Only the pairing that
genuinely agrees (causeway + ring-ditch, both Caelrin, `:631`) was worded
correctly; the other two just reused the "X and Y agree" template without
checking it against what either source actually said. A player who
happened to find the mere-stone as one of their first two pieces would have
been told outright, incorrectly, that it agreed with whatever else they'd
found — a direct, mechanical explanation for "gave conflicting answers...
with no in-fiction confirmation," stronger than a pure clarity complaint.

Fixed: `:636` and `:641` now read "do not agree" in place of "agree" (76/120
and 78/120 against the quest-stage budget). Also added a short, non-spoiling
flag to the terminal "all three found" stage (`:626`): "You have every
piece, and they do not all agree. Settle on a name at the great mound, and
speak it." (99/120) — so the conflict is visible for free via `status` at
the actual point of decision, not only through the eldest king's own
once-only `about_evidence` topic (`:555`, gated on `hb_evidence_known >=
1`, likely long since used up by the time all three pieces are found).
Nothing here says which name is true; `hb_speak_name`'s own success/failure
text (`:408` vs. `:425`/`:432`) still carries the entire payoff, so the
gamble is untouched — only the game's own false claim about the sources is
gone. This also serves `1ccc55c0`'s ask directly: the corrected mid-quest
stages ("the ring-ditch and the mere do not agree — one piece left") are
exactly the "recap that clues conflict" it wants, delivered at zero cost, at
the moment it matters. A fuller "who said what" recap (naming Caelrin/
Roderic per source together in one place) was considered and rejected:
every site already states its own claimed name outright the instant it's
found (`hb_wild.json:115,132,152,172,590,607,627,647,711,728,748` — eleven
separate lines already do this), so the gap is about memory, not withheld
information, and a persistent side-by-side tally would hand over the 2-vs-1
shape outright rather than aid recall of something the game already said
once. Both `queue/P2-issue-dc7b6f14.json` and `queue/P2-issue-1ccc55c0.json`
moved to `done/`.

Verified for real rather than assumed. `npm run verify` — typecheck,
337/337 tests (including the status ratchet, `test/format.test.ts:291`,
confirmed standalone as `ok 23`), all three worlds validate and win-prove,
both crawls and both forked crawls clean (0 over-cap menus), both
`mock-player` sessions complete. `node --import tsx scripts/lint-world.ts
world/reach.json` — "all text within budget." `node --import tsx
scripts/budget.ts world/reach.json --terse` — avg 439.7509/450, max
1076/1100, sum 118293 over 269 screens, unchanged from the last-recorded
baseline to four decimal places (`va_doors`'s edit is on the walkthrough but
verified shorter, not longer; the rest — `hb_hollow.json` and the four
companion quests' mid-stages — are off-walkthrough, bounded only by
`scripts/lint-world.ts`'s per-string caps). `node scripts/fmt-json.mjs` run
only on the three files actually touched (`world/reach/hb_hollow.json`,
`world/reach/companions.json`, `world/reach/va_barrow.json`); the resulting
diffs are exactly the edited lines, nothing else reformatted.
`world/reach/th_thornwold.json`, `world/reach/wm_wardmoor.json` and
`test/reach.test.ts` were already modified in the working tree by other
in-flight work before this entry was written; left exactly as found.

`queue/P2-issue-0e243972.json`, `queue/P2-issue-7aa85f96.json`,
`queue/P2-issue-2f3d20ac.json`, `queue/P2-issue-d9caff0e.json`,
`queue/P2-issue-dc7b6f14.json` and `queue/P2-issue-1ccc55c0.json` all moved
to `done/`.

### `P2-issue-39b85b76`/`P2-issue-1f61ce96`'s real root cause, found by mapping the mechanism instead of re-triaging the report

With wave 7 closed, both playtest processing (wave 8, launched next) and a
dedicated investigation into the twice-deferred travel-search ask ran in
parallel. `39b85b76` ("long list, slow to find a specific far-off landmark
by name alone") and its second corroboration `1f61ce96` (`:6242-6295`
above) were both formally reaffirmed as deferred on the reasoning that the
remaining ask needs "a new interaction primitive, not a content edit" —
true of literal free-text search, and still true. But neither write-up
asked *why* the per-region travel list actually reaches 30+ entries before
concluding a fix was out of reach. This entry does.

`travelList`'s region-drilled branch (`src/engine.ts:1100-1111`, before
this fix) fed `localTravel`'s whole output — every room stood in, landmark
or not — through one `byTravelName` sort, merging a handful of actual
landmarks in with dozens of plain, unlabeled rooms. That breadth is
deliberate and correct (`:1042-1049`'s own comment: an earlier attempt to
gate it on region size was reverted as "narrowing a gate to hide a price"
— it exists to fix a *different*, earlier complaint, backtracking through
mapped multi-room areas). The bug was never the breadth; it was searching
a landmark by name through a list that made no distinction between "the
mill" and "the third room after the mill."

Measured directly against the real, fully-merged `world/reach.json`
(`loadWorld`, matching what `verify` validates): 164 of 936 rooms carry a
`landmark` field. Per-region landmark counts run 2 (`lf`) to 13 (`me`) —
only `me` exceeds the flat top-level list's 11-landmark threshold
(`MENU_CAP - 1`, `:1092`) — while per-region *room* counts run 31 (`lf`)
to 58 (`sh`), up to 6 pages and 5 "more places" clicks to reach a landmark
alphabetized behind two dozen plain rooms. The canonical walkthrough
alone, well before its turn-240 win, already stands 22 rooms deep in two
single regions (`va`, `sk`) — three pages each — so this is not a
theoretical worst case; a thorough playtester plausibly hits it directly.

**Fix** (`src/engine.ts`, `travelList`'s else branch): partition
`localTravel`'s result by landmark status before sorting — landmarks
first (alphabetical), then plain rooms (alphabetical) — instead of one
merged alphabetical sort. No new `Action` variant, no `State` field, no
validator rule, no crawler or mock-player change: the DSL and every
consumer of it are untouched. With the fix, 18 of 19 regions fit every
landmark on page one (zero "more" clicks to reach any of them, down from
up to 5); only `me`'s 13 landmarks still need one extra page.

Confirmed the change is genuinely free rather than merely untested: full
`npm run verify` after the fix is unchanged in every load-bearing way —
338/338 tests (337 plus one new regression test), all three worlds
validate and win-prove clean (the Reach walkthrough still wins in exactly
240 turns — `actionByLabel` already resolves by label against the
unpaged list regardless of page or order, the same guarantee
`P1-issue-05f453ff`'s whole-list-numbering fix established), both crawls
clean at 0 over-cap menus, both mock-player sessions complete.
`scripts/lint-world.ts world/reach.json` — all text within budget.
`scripts/budget.ts world/reach.json --terse` — avg 439.7881/450 (was
439.7509), max 1076/1100 (unchanged), a sub-0.04-average shift from a few
walkthrough screens landing on a differently-populated page, nowhere near
either ceiling.

Added `test/realm.test.ts`: a dedicated case giving a plain room the name
that would sort alphabetically first and a landmark the name that would
sort last, proving the partition holds rather than merely happening to
match the old merged order (the existing test at `:87-102` couldn't
distinguish the two, since its one landmark already sorted before its
plain rooms by coincidence).

Also confirmed, independently, this session's own earlier claim about
`byTravelName`'s reach: it sorts both destination leaf-lists (the flat
top-level list and now this partitioned region list) but *not*
`travelRegions`'s own region-picker list, which is left in incidental
`world.regions` key order rather than alphabetized by display name
(`hb` "Hollowbrook" lists before `hl` "Hearthlands"). Left alone
deliberately: region lists rarely page (worst case 19 regions, 2 pages),
sorting the picker would flip `test/realm.test.ts:145-162`'s expected
order and needs its own test update for a benefit smaller than this
entry's actual fix, and neither `39b85b76` nor `1f61ce96` complained about
region-picker order at all — a separate, much lower-priority polish item,
not folded into this fix.

Free-text search itself remains out of scope, now for a sharper,
confirmed reason than "no primitive exists": `src/mcp.ts`'s `act` tool
contract (`:116-156`) is strictly `{s, a: <number>}`, and `src/crawl.ts`'s
`walkFrom` (`:188-189`) and `loop/mock-player.mjs` (`:82-99`) both assume
a finite, indexable action pool with no concept of typed text at all —
adding it would change the wire protocol every consumer speaks, not just
add a new closed-DSL primitive, and would leave the harness `verify`
depends on (`npm run mock`/`npm run measure`) structurally unable to
exercise it, a real blind spot rather than mere extra effort. This
fix removes the one part of the original ask (reaching a *known* landmark
quickly) that a content-shaped change could actually solve; the
literal-search part was never the load-bearing complaint in either report.

### A pre-merge review of the branch's own source, and the six things it found

Before merging this branch to `main`, its TypeScript was read cold against
the contract in `AGENT.md` — `world/**` and this file were skipped, since
the validator, 338 tests, both crawls and the budget ratchets already cover
them and were green. Hand-written logic is what nothing else was checking.
Six findings, all fixed here; each was reproduced before being believed.

**A test asserting a guarantee this branch had deleted.**
`test/engine.test.ts` carried `test("score is clamped to maxScore")`,
asserting `score <= maxScore` after the lighthouse walkthrough. The clamp
came off deliberately earlier in this session (`src/engine.ts`'s `score`
case is `Math.max(0, …)` now, with its own reasoning above it: `maxScore`
is what one route pays, and three blind players hit it and played on for
two hundred turns earning nothing). The test went on passing for an
unrelated reason — `src/validate.ts` independently requires that
walkthrough to land *exactly* on `maxScore`, so `<=` cannot fail — while
its name advertised a contract the engine no longer honours. Proved
vacuous directly: a world with `maxScore: 5` and one `["score", 100]`
action yields 100, unclamped. Rewritten to assert what is actually true
(no ceiling above `maxScore`, a floor at zero), which makes it fail if
either half regresses. The display half of this was already covered in
`test/party.test.ts`; the mechanical half was covered by nothing.

**Two type comments describing designs that were reverted.** `src/types.ts`
still documented `["score", number]` as "clamped 0..maxScore" (same root
cause as above), and `World.clock` as "Root-only, like `walkthrough` — a
part file carrying it is a load error." The second is contradicted by
`src/validate.ts`, which puts `clock` in `LIST_FIELDS` and carries its own
comment explaining why: it was root-only for exactly one commit, which
"would have made one author the owner of every scheduled event in an
eighteen-region realm." A region author reading the type would have pushed
their scheduled event into the root file by hand, rebuilding the single-
owner shape the validator changed the design to avoid. Both corrected to
match the code.

**A `--prefix` filter that filtered nothing.** `scripts/audit-choices.ts`'s
standings table read
`.filter((v) => v !== "gold" && want(v) === (only ? prefixOf(v) === only : true))`.
With `--prefix` set, `want(v)` *is* `prefixOf(v) === only`, so the whole
comparison is `X === X` — always true. Confirmed by running it: a
`--prefix th` audit listed `kw_`, `hb_`, `va_`, `ff_`, `mc_`, `pw_`, `fl_`
and `sh_` tallies at an author who had asked for Thornwold. The rest of
the script already filters correctly with a bare `want(flag)`; this line
now matches it, and the table's `if (tracked.length)` guard means a region
that moves no tallies of its own prints nothing rather than an empty header.

**A doc comment severed by an unrelated block.** In `src/format.ts` the
`failedChecks` comment began, broke mid-sentence at "…has no other way
to", and resumed twenty-five lines later at "recall that later" — the
whole `Standing:` JSDoc and its code wedged between the two halves. A
merge artifact; rejoined with the code it describes.

**A measuring tool that dropped its inputs silently.**
`scripts/audit-play.ts` returns `null` from `read()` for any trace that
fails to parse or lacks `seed`/`actions`, then drops those with a
`.filter()`. Only a *total* failure said anything. Five traces of which
three were malformed would print coverage percentages over the surviving
two with no hint that it had. It now says what it skipped, in the spirit
`scripts/audit-fates.ts` already states outright: a blind spot in a
measuring tool is worse than no tool, because it is a green bar over the
thing you were checking.

**The last menu branch still deciding precedence for itself.**
`roomMenu` resolves `ended → class phase → pending perk → conversation →
travel`; `allActions` checked `inTravelMode` ahead of all of them.
`talkShowing` exists precisely because the talk branch had this bug, and
its comment says why both callers now share one predicate rather than each
deciding for itself — travel was the branch that never got the same
treatment. With a perk pending and the travel menu open, the screen offers
a perk while `allActions` hands back travel options: `menuNumbers` emits 0
for the shown option, `actionByNumber` rejects it by construction, and
every visible option is illegal. Nothing in today's grammar reaches that
state — travel actions are all in `BROWSING`, so no turn is spent and no
level can land mid-menu — so this is a latent fix, not a live one. Added
`travelShowing` as `talkShowing`'s sibling, wired into both callers, plus
a regression test in `test/menu.test.ts` that was checked the only way a
new test is worth anything: it fails with the fix reverted and passes with
it in. A guard that holds only by an argument about what cannot happen is
one clock entry away from being wrong.

**Considered and deliberately not changed.** `test/budget.test.ts`'s proof
ratchet compares `Math.floor(avg) > budget.avg`, so a road can drift up to
0.99 characters a screen unseen. That floor turns out to be load-bearing
rather than sloppy: several roads sit fractionally *above* their own
integer (`reach_at_rest#devoted` at 464.04 against 464, `gray_crown` at
452.7 against 452), so the table's integers mean "must stay under the next
rung." Comparing exactly would fail four proofs on the spot, and storing
the measured fraction for each would make three Node majors' worth of ICU
have to agree to the decimal. Documented the semantics in place instead of
moving the bar on the eve of a merge. Also left alone: the `do/while`
replay shape in two audit scripts was corrected to the `while` shape every
other replayer in the repo uses (checking `until` before the first press,
and reporting a missing label instead of ending the step in silence) —
verified byte-identical output from both scripts before and after, since
`audit-routes.ts`'s numbers are the stated justification for `pathTo`'s
two-pass search and must not move quietly.

`npm run verify` after all six: 339/339 tests, all three worlds validate
and win-prove clean, both crawls and both forked crawls clean at 0 over-cap
menus, mock and measure complete. `npx tsc --noEmit` clean.

### AGENT.md's crawl figures, and the five conversations that had no way to say goodbye

Two follow-ups from the pre-merge review above, both left open there for
the reason each is recorded here.

**The charter's own number had drifted twice.** `AGENT.md` described the
forked crawl as "the pass that sees the realm behind its own gates (145
rooms against 438)". Live: 149 against 460, and both halves had been wrong
since before Longford landed. The file forbids editing itself — and
`loop/dev.sh:75` enforces that by reverting any cycle whose diff touches
`AGENT.md` or `loop/`, which is why a self-directed cycle could not have
corrected it and why the docs sweep above correctly left it alone. Nothing
in `npm run verify` or CI enforces the rule, so the guard is specifically
against an agent rewriting its own charter unasked; a human asking for the
fix is the case it was never meant to stop. Rewritten as a ratio rather
than a count ("about half of it, against a sixth at random"), since the
absolute pair has now gone stale twice and `verify` prints the live figures
on every run anyway.

**Five conversation npcs ended with the engine's generic line.**
`scripts/lint-world.ts:78` flags any npc with `dialogue: true` and no topic
carrying `end: true`; `sk_tavernkeep`, `th_bray`, `th_coe`,
`wm_quartermaster` and `wm_corporal_fenn` had between nine and twelve
topics each and no farewell among them, so `docs/authoring.md`'s rule
("give every conversation-mode npc a farewell") had drifted in content
rather than in the doc. Not a bar failure — the engine falls back to the
plain `end conversation` entry, which is why this never went red — but
five of the realm's talkers parted from the player in the engine's voice
instead of their own.

Each got a `bye` topic in the house shape (`id`/`label`/`say`/`end`, the
label a phrase for disengaging, the say one short parting line), written to
the voice its own topics already establish: Otts barely talks and warns
about the reef fog, Bray does not look up from the ledger, Coe names the
tree that groans without wind, the quartermaster is still counting, and
Fenn says not to answer the boots in the mist. Checked the two the file
addresses in the third person and matched them — Coe and the quartermaster
are both "she" in their own lines, which a farewell written from the id
alone would have got wrong.

Confirmed before writing that none of the five appears in the walkthrough
or any of the thirteen proofs, so no budget ratchet could move; a farewell
also *replaces* the generic exit rather than adding an entry, so no menu
grew. Rendered all five conversations afterwards: each now closes on its
own line with the generic entry correctly suppressed.
`scripts/lint-world.ts world/reach.json` reports no npc without a farewell
and all text within budget. `npm run verify`: 339/339 tests, all three
worlds validate and win-prove, both crawls clean at 0 over-cap menus.

### The act gate: the lever item 11 names is the wrong one, measured — and the half of it that was fixable

Item 11 ("the act gate, which is why three runs saw the same half of the
realm") proposes changing **what the Coldpass gate counts**. Measured before
changing it, and the measurement rules the change out.

The pilgrim stair opens on any of four conditions (`cp_coldpass.json:74-84`):
`hollows_rested >= 3`, the Keepers' key, the Meres' covenant, or
`keepers_trusted`. Replaying the walkthrough and all thirteen proofs and
evaluating all four at the instant each one climbs: **nine routes cross by
the stair, and all nine open it on `hollows_rested >= 3` — none satisfies any
other condition.** Eight of the nine sit at exactly 3 rested, and seven sit
at exactly **5 regions seen of 19**. The proven roads are not merely near the
threshold; they are the floor of it, on both axes.

So there is no headroom. Any tightening — a higher count, a spread
requirement, a regions-seen clause — invalidates nine replay-proofs at once,
each of which would have to be replayed and re-recorded longer than it is
now. And longer is the one direction that is not available: 78% of long-form
wins (69 of 89 in `reports/triaged/`) already consume more than 540 of a ~600
turn budget, and every `stuck` report in the corpus sits on a cap (600, 600,
600, 600, 628, 650) rather than on a dead end. Players are not failing to
find the ending; they are running out of turns on the way. Making the
required road longer to widen it would trade the realm's worst
player-facing problem for its second-worst.

Item 11 stays open, and this entry is the argument that the lever it names
should not be pulled as written. The breadth problem is real; the fix has to
make breadth *pay*, not make the gate *cost*, and that is a design change to
the endgame economy rather than a condition edit.

**What was fixable, and is fixed.** The same harm has a second half that
needed no gate change at all. `questsopen` exists for exactly one purpose —
its own type comment says "for a point of no return, where a warning without
a number is easy to read past" (`src/types.ts:74`) — and the realm used it in
exactly one place: `cp_pass`'s `onEnterOnce`. It fired when the player first
walked into the Pass Gate room, and never again, because `onEnterOnce` fires
once. The four actions that actually cross — `cp_door_stair`, `cp_door_writ`,
`cp_door_seal`, `cp_door_cave`, each setting its own `cp_came_by_*` — carried
no count at all. A player could read "N threads open", leave, play two
hundred turns, come back and cross on a number that was stale by most of a
game. That is precisely `queue/P2-issue-fc1a4039`'s complaint: the crossing
"was flagged as final with a warning to check status, but it wasn't obvious
beforehand just how many (13) would be permanently orphaned."

The count now fires on the crossing itself, not on entering the room: moved
out of `onEnterOnce` and into all four crossing actions. Any one playthrough
still renders it exactly once, so the text budget is unchanged — measured,
not assumed: `scripts/budget.ts world/reach.json --terse` reads avg 439.7881,
max 1076, sum 118303 over 269 screens, identical to before, and the
mock-player's widest screen moved 1389 → 1388. Replaying the walkthrough now
prints "(11 threads of yours are still open...)" at the moment the stair is
climbed.

`npm run verify`: 339/339, all three worlds validate and win-prove, both
crawls clean.

### The intro was the one player-facing string nobody had audited

Every documentation sweep this project has run read `docs/` and `README.md`.
None read the prose the player actually reads. The intro's third sentence
said **"The Vale is one hold of eighteen"** — wrong under every reading: the
realm has 19 regions, of which 15 carry a hollow's grief (`audit-fates.ts`
lists them: em fd ff fl hb hl ir kw mc me pw sh sk th wm), plus the Vale,
which makes sixteen. Four other player-facing strings — the objectives and
three `main` quest stages — already said "fifteen holds" correctly, so the
game contradicted itself inside the first few minutes, in the first thing
anyone reads. Now "one hold of sixteen". Checked the rest of the
player-facing prose for the same class of drift in the same pass: five
count-claims exist in total and the other four were already right.

### Standing has two rungs and the realm pays it in 267 places

`audit-choices.ts` reports every major standing as inert above its highest
read, and the numbers are large enough to look like a defect:

    rep_keepers   267 moves  +242 total   nothing reads past >=9   186 deeds wasted
    rep_church    271 moves  +184 total   nothing reads past >=9   164 deeds wasted
    rep_watch     246 moves  +182 total   nothing reads past >=9   160 deeds wasted
    appr_osk      183 moves  +110 total   nothing reads past >=8    98 deeds wasted

Checked whether that ceiling is an accident before treating it as one. It is
not: scanning every condition in the realm for a `var` read against a
`rep_*`, **all six factions top out at exactly `>=9`** — the Watch (21
reads), the Free Companies (38), the Crown (9), the Church (13), the Keepers
(7), the Ironbound (6). A uniform ceiling across six factions, at the same
number, is a design, and it is the one item 3 shipped: `trusted` at `>=5`
and `sworn` at `>=9`, each collected from a named npc in a named hold.

So the finding is not "a number is broken". It is that the realm pays
standing in 267 places against a ladder with two rungs, and a player who
keeps doing the Keepers' work past the ninth point is spending deeds on a
counter nothing will ever read again. That is a question about the reward
economy — add a third rung, pay standing less freely, or accept that the
ladder finishes early and let the deeds pay in score and story alone — and
each answer is a different game. Recorded with the measurement rather than
resolved: this is the designer's call, not a defect to quietly re-tune, and
the same reasoning that kept item 11's gate from being tightened on the
strength of a tool's say-so applies here.

What *is* checkable and is already true: the deeds are not worthless, only
the counter is. Every one of them still pays score and xp, and most move a
companion's regard as well; `audit-fates.ts` shows each hold's three fates
differing in standing and regard rather than in points, which is the
mechanism working as designed.

### The bar learns to prove a quest can close, and an over-cap screen stops being a number

Two holes the audit named, both closed.

**"86% of quests are unproven" was the wrong reading, and the check that
closes it says so.** The audit measured that of 140 quests only 14 close on
the winning walkthrough and ~20 across all thirteen proofs, and called the
other 120 unproven. `src/validate.ts` now computes, from the empty starting
state, a least fixpoint of every flag, var, item, npc and companion the
content can ever reach, and reports any quest whose `done` falls outside it —
six sound sub-proofs (a flag no chain of gates can reach; a counter no sum of
raises reaches, with a repeatability rule so a re-runnable `addvar` counts as
unbounded; foreclosure, where every site that sets what `done` wants also
sets what it forbids and nothing clears it; direct contradiction; an
unreachable object; and a dead `any`). It threads the existing `checkFx`
walk rather than adding a second one, so it sees exactly the effects the
validator already validates.

**It finds zero unclosable quests, and that number is honest rather than
disappointing.** The realm's `done` conditions have almost no surface for a
combination bug: 85 are a single flag, 45 more are a single `any` of flags,
and exactly two — `hb_q_ledger` and `pw_q_dies` — are conjunctions of more
than one thing, both hand-verified satisfiable. So the 120 quests no proof
closes are **unvisited, not impossible**: 114 have none of their `done` flags
set in any of the fourteen replays. The audit's hole is real and it is a
route-coverage hole, not a correctness one, and no static check can close it
— only more proven roads can. Falsified empirically rather than argued:
every fact the sixteen proven replays across all three worlds actually reach
(449 flags, peak var values, held items, dead npcs, conditions, party
members) was re-run as a synthetic `done` — **0 false positives**, ~17ms.

It did find one real thing, from the var-ceiling sub-proof: `npc th_doss
remark r_appr_pos waits for appr_th_doss to reach 2, but nothing in this
world can raise it past 0`. Doss is the realm's fifth companion, the only one
defined outside `companions.json`, and his approval arc was half-built — the
single write to `appr_th_doss` anywhere was `-2`. His positive line was
written and could never be earned. Fixed with its missing half, a
`r_bargain_kept` remark on the bargained flags carrying `+2`.

**Over-cap screens.** `test/budget.test.ts` held every proven road to 1,100
characters; every screen off those roads was measured, printed and ignored,
so roughly half the realm could carry any width at all. Measured first: the
union is ~25 rooms of 936, the tail shallow (most 1,100-1,210) with `va_crypt`
the outlier at 1,510 under `--deep --sweep`. Four rooms trimmed, all of it
restatement rather than prose — `va_crypt` announced its hostiles and its
loot two lines above the engine's own roster and `you notice`, and said the
wight's grip beats mail four lines under the engine's pierce warning; three
others introduced an npc the engine introduces itself a line later. 1,248 →
1,043. `SCREEN_CAP` now lives in `src/crawl.ts`, every over-cap screen is an
`OVERCAP-SCREEN` finding that exits 1 in both crawl passes `verify` runs, and
`test/budget.test.ts` asserts the two ceilings are the same constant so they
cannot drift. The last proof allowance went with it:
`crowned_hollow#bloodied`'s `max: 1295` — argued in its own comment as a
fight screen wide by design, which the same room rendering 1,510 off-road
disproved — is now `MAX_CHARS_MAX`. **Every proven road meets the real
ceiling; no road has a max allowance left.**

Proved it bites rather than assuming: padding `va_crypt` ~250 characters
makes `crawl --fork` report `OVERCAP-SCREEN reach: 1 room … va_crypt 1299
(x18)` and exit 1. Reverted.

Two things deliberately not done, both recorded rather than silenced. The
mock player's `max 1388` is the `new_game` intro, governed by
`INTRO_CHARS_MAX` 1400, not an `act` screen — cutting the intro to make that
number look better would have been gaming a misread. Re-running the mock
policy per turn found the genuine one hiding behind it, a 1,101 act screen in
`hb_keepers_hall` on a Warden state no crawl mode reaches; that is 1,095 now.
And `--deep` stays informational, with eight rooms still over under
`--deep --fork` (worst `va_throne` 1,351) written into the code as the work
queue: those are content *stacking* — an ending's prose, two companions'
answers, a departure and four journal lines on one turn, none said twice —
not restatement, so none of it was cut. There is no allowlist, and the
comment says there must never be one.

`npm run verify`: 351 tests, all three worlds validate and win-prove, both
crawls clean.

### The first wave nobody chose the class for: a Warden and a Scout both finish

`TF_CLASS=Warden,Scout npm run playtest 2`, seeds 24601/24602, against the
tree with this session's fixes in it. Both **won**, both receipts replayed
`verified:true`, at 760 and 728 turns. The traces confirm the pin took:
`classpick: warden` and `classpick: scout`.

Section 8 of this document called the class claim "the largest unproven
claim in the repo" and the answer arrived in two parts. The proofs closed
the *machine* half earlier — of thirteen replay-proofs, three are Warden,
two Envoy, one Scout. This closes the other half: **no blind player had ever
picked a Warden or a Scout**, and now two have, and both reached an ending
without help. The design contract ("every obstacle has a force, a craft, and
a words route, so no class is ever locked out") has its first evidence from
someone who did not know it was a contract.

**The anchored rubric earned its keep on its first wave.** Forty-four
consecutive reports had rated `fun` 5/5 with zero variance, which is why the
audit called the instrument dead. The first wave run against the anchors
came back **5 and 4** — the Scout, who filed one bug, took the anchor that
caps fun at 4 when a P0/P1 is filed and applied it to itself. One wave is
not a trend, but the scale moved for the first time in a week.

**And the wave's one P1 is a misreport, established by replay rather than by
argument.** `P1-issue-81dd319d` says taking the headframe lantern showed no
theft tag, "unlike the consistent pattern elsewhere". Replaying the Scout's
own trace to the instant of that take: the player is in `ir_headframe`, Ness
is in `ir_headframe`, Ness is not in the party, and `oddsHint` returns
`" (Ness is watching: taking it is theft, and Brother Osk, Vell, Tamsin and
Lys will remember it)"` — the warning fires, names the owner, and names all
four companions who will hold it against you. Checked the general shape too:
all 42 owned items in the realm sit in their owner's own room, so there is
no class of silently-free theft hiding behind this.

`81dd319d` and the two P2s restating it (`4fa7adac`, `5f0cc2d1`) move to
`done/` as not reproducible. This is the third time a wave's report has been
contradicted by its own trace, and the reason the replay step exists: a
report is a witness statement, not a measurement.

The rest of the wave's findings stay in `queue/` for the next cycle — six
P2s, of which the substantive ones are the multi-step "way there" directions
not matching the room graph (the wayfinding theme, again, now the single
most-corroborated complaint in the corpus) and a request that `status` name
*which* settled griefs count toward `hollows_rested` rather than only the
tally.
