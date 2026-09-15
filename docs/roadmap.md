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
