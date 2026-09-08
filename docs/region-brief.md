# Region author brief

You are writing one region of **The Gray Reach** for tinyforge, a data-driven
text RPG. This brief is the same for every region; your assignment (region
code, name, neighbors, hollow, factions present, companion quest hooks) comes
with it. Read, in this order, before writing a line:

1. `docs/authoring.md` — the complete DSL, id conventions, style and token
   budget, how to validate. Everything you write must pass it.
2. `docs/superpowers/specs/2026-09-05-realm-design.md` — premise, tone, the
   map and gateway ids, the acts and gates, the **state contract** (the only
   non-prefixed names you may read or write), factions, companions, the
   shared templates.
3. `world/reach/templates.json` — the seven shared templates you stamp
   (barrow, cave, tower, mine, camp, chapel, hut): their vars and loops.
4. `world/reach/companions.json` — the four companions: what they approve of,
   the `appr_<id>` vars, and the personal-quest flags YOUR region may set.
5. `world/reach/va_*.json` — the finished first region. Match its voice,
   density, and the way it gates and rewards. Do not copy its content.

## Deliverable

Part files named `world/reach/<code>_*.json` (e.g. `fd_fenmarch.json`,
`fd_wild.json`, `fd_hollow.json`), each with only these top-level keys:
`rooms`, `items`, `npcs`, `gen`, `stamps`, `templates` (only if you add a
region-specific one), `quests`, `epilogue`, `statusTracks` (optional, at most
one). Every id prefixed with your code. No `end` effects. No
`walkthrough`/`proofs` (root-only).

**Write in parts.** A whole region is far more than one response can emit:
four authors lost their work to the output limit by writing one huge file.
Write the settlement first, validate, then the wilderness and stamps,
validate, then the hollow, quests, and epilogue — each file in its own write,
each under ~900 lines. The loader merges them; ids must not repeat across
your files.

Do not edit any other file. Do not commit. Scratch files go under `/tmp`.

## What a region contains

- **A settlement** (6–10 authored rooms): an inn or hearth where `rest`
  heals (`["hp", 10]`), a place of trade (a shop is just actions gated on
  `["var","gold",">=",n]` with `addvar gold -n` and `move item inv`), the
  faction presence named in your assignment, 5–8 npcs with real opinions.
  Anyone with 4+ topics uses `dialogue: true` and has a farewell topic
  (`end: true`).
- **Gateway rooms** with the exact ids and neighbor targets from your
  assignment. Every gateway's `onEnterOnce` sets `<code>_entered` and says
  in one line what this hold is ("This is X: …", its grief in a breath),
  wrapped in `["if", [["!flag","<code>_entered"]], …]` so the hold
  introduces itself once whichever road you come in by (companions react
  to the flag). A neighbour's grid cell that links straight into your
  region must set the flag and say the line too. Gateways are landmarks.
- **Wilderness** as one `gen` region (5×5 to 7×7, walled into a shape, ≤ 30
  open cells): a `scenes` pool with **at least as many scenes as open
  cells**, each a distinct named place with one concrete detail; `links` to
  the settlement, the gateways, the hollow, and stamped places; `cellFx`
  with one wandering encounter at ≤ 10% chance that brings one named
  aggressive npc `here` while it lives (`["if", [["!npcDead", ...]], ...]`).
  Wilderness text must be direction-true: if a scene says "the tower rises
  east", put it on a cell where that is so, as a `spot` — scenes are dealt
  randomly. A generic scene never names a direction.
- **3–5 stamped places** using the shared templates (distinct `NAME`s and
  inhabitants; vary which route is easiest), plus optionally one
  region-specific template. Stamp onto wilderness cells (`at: "<gen>_x_y"`)
  or authored rooms; mark them `sideTrip: true` with a `landmark` preview.
- **The hollow**: an authored site (2–4 rooms) holding the region's
  unrested grief, reachable from the wilderness, its own landmark. It must be
  resolvable three ways, each ending in exactly one of:
  `["set","<code>_hollow_rested"], ["addvar","hollows_rested",1]` (a rite or
  a kept bargain), `["set","<code>_hollow_burned"], ["addvar","hollows_burned",1]`
  (fire; quick; the Ironbound way), or `["set","<code>_hollow_bargained"],
  ["addvar","hollows_rested",1]` (the dead stay, quieter). Each way is a
  force, craft, or words route, and no class is locked out of resting it.
  Each outcome moves two faction vars by ±2 and one or two companion
  approvals by ±1, changes the hollow's rooms (`variants`), changes something
  in the settlement (a variant, an npc line), and adds an epilogue line. Score
  25 for resting, 20 for bargaining, 15 for burning; xp 8.
- **4–6 quests** (`quests`), each with 3–5 stages most-advanced-first, a
  `start`, a `done`, and where sensible a `failed`. At least two must have
  two or more resolutions with different flags and consequences, and at least
  one consequence must be met again later (a variant, a different npc line,
  an epilogue line). Include the companion quest hook(s) from your assignment
  exactly: set the named flags where the design says.
- **Choices that matter**: every settlement npc who matters reacts to at
  least one thing the player did (act-1 flags from the contract, your own
  hollow outcome, a quest outcome). Use `["if", ...]` in topic effects and
  `variants` on rooms. Reputation moves by ±1 per deed.
- **Rewards**: score ~70–90 available across the region (hollow 25 + quests
  5–10 each + discoveries 1–5), xp ~40, gold ~20 in small amounts, one or two
  items worth having (a weapon or armor a step above the Vale's, a use-item).
  Everything once (`once: true` or a flag).
- **Epilogue**: 4–8 lines (≤ 140 chars): hollow rested / burned / bargained /
  untouched, and one or two memorable side choices.

## Density and consequence — the two the realm got wrong

Both were measured across the eighteen finished regions on 2026-09-08. Neither
is a matter of taste; both are the difference between a place and a corridor.

**Every room owes the player a choice.** Not a good one, not a big one — but
something other than which way to walk. Across the realm, 220 of 905 rooms
(24%) offer no action, no one to speak to, and nothing to take. They are the
best-written rooms in the game and they are corridors. The split is by
authoring age, not design: the regions written last sit at 4-7% bare, the
ones written first at 44-60%. **Count it per class, not once.** An action gated on one class is not an
action for the other three, so a room whose only content is a Scout's find is
a corridor to a Warden — the class-blind figure is the optimistic one. Across
the realm the blind count is 94 and the per-class counts are 124 to 141, and
the gap is entirely made of class-gated finds. Filling a room for everybody
beats filling it for a quarter of players; where you do gate, gate four ways.

**Your region ships under 15%, for every class.** Check it:

```bash
node --import tsx scripts/audit-shape.ts world/reach.json --prefix <code>
```

**Every open cell of your grid gets its own named scene.** A cell with no
`scene` or `spot` falls back to a generated name and one generic line — "the
Warrens 1,2", "Alleys stacked on alleys" — and every such cell in a grid
reads identically. Two regions shipped with this hole (the Saltkerns, 24 open
cells and 5 authored; Marrowgate's warrens, 9 and 3), so count them before
you hand in: open cells = `w × h − walls`, and `scenes + spots` must reach it.

A wilderness cell earns its keep with a one-turn find, a check with a real
price, a free beat that weighs what you are looking at, or a `variant` that
reads a choice made elsewhere. Vary the shapes; do not put an npc on every
cell. Emptiness can be the subject of a room without being its whole content:
give the player something to *do about* what they are looking at.

**Do not write a sentence the realm already has.** Two Ironbound lay-brothers
in two different holds open with the same line ("cheerful in the way of
someone who has made his peace with fire being the answer to most things"),
and two holds carry a quest named "The Child at the Wall". `audit-echo.ts`
compares every authored line against every other and prints the pairs that
are effectively the same sentence; a stamped place matching its own template
is expected and counted separately. Run it before you hand in.

**A number you move must be read back at the height it can reach.** The realm
moves faction standing in about twelve hundred places and reads it at six
thresholds, all of them `>= 2`, so a player who has done fourteen things for
the Barrow-Keepers meets the same doors as one who has done two. Every
`addvar` you write is a promise. Before you hand in:

```bash
node --import tsx scripts/audit-choices.ts world/reach.json --prefix <code>
```

Every flag your region sets should be read somewhere else — the audit's
"forks the world forgets" list is yours to keep empty. Every tally your
region counts should be read at a height a player can actually reach, and at
more than one height if it can be raised more than twice. A standing your
region only ever raises, and never reads, is a line of text pretending to be
a consequence.

## Budget (hard limits the tests enforce)

`desc` ≤ 260 chars; `brief` ≤ 70; topic `say` ≤ 220; `label` ≤ 40; any
single `say` effect ≤ 220; epilogue ≤ 140; stage text ≤ 120. Room menus ≤ 12
always, ≤ 8 typically — gate topics and actions on state. No check labelled
safe if failure costs hp; state the cost in the label. Every check you want
previewed goes FIRST in its effect list.

**Above those, one budget for the whole realm**: the average `act` response
along the proven walkthrough must stay under 450 characters, and no single
response may pass 1,100. Measure it — do not estimate it:

```bash
node --import tsx scripts/budget.ts world/reach.json          # slack left, and the biggest screens
node --import tsx scripts/budget.ts world/reach.json --terse   # one line, to diff before against after
```

Three things about that number, each of which has already cost someone a
day's work:

- **"It did not move the budget" is not evidence your content is fine.** The
  measurement walks the *proven walkthrough*. A screen it never reaches costs
  nothing there and is measured by nothing else. A byte-identical result
  means your content is off the proven path — which may be exactly right, and
  is never on its own a pass.
- **Narrowing a gate until an addition stops costing budget is deleting it,
  done less honestly.** An ability shipped gated on a DC-13 wits check when
  the hardest wits check in eighteen regions is DC 12: it could never appear
  for anybody, and the budget read "unchanged" because nothing had been
  added. Before you gate on anything, count what satisfies it.
- **A menu line is the most expensive thing you can add**, because it prints
  on every screen the room renders. The menu is 34.5% of the realm's whole
  budget; prose is 28%.

And run the linter on **the world you touched**, not only the one you had in
mind. 197 over-budget strings sat in `world/vale.json` for months — including
a 2,376-character notice board, the first thing a new player reads — because
CI and everyone's habit pointed at `world/reach.json` alone.

## Validate before you hand in (mandatory)

Your file is validated as part of the whole draft realm:

```bash
node --import tsx src/validate.ts world/reach.json      # must print ✓ for the realm
node --import tsx src/crawl.ts world/reach.json         # must be clean; note rooms seen
node --import tsx src/crawl.ts world/reach.json --deep  # 400 walks x 300 steps: the numbers move with depth
```

```bash
node --import tsx scripts/lint-world.ts world/reach.json    # text budgets, per-region counts
node --import tsx scripts/audit-shape.ts world/reach.json --prefix <code>    # bare rooms, the shape of the hold
node --import tsx scripts/audit-choices.ts world/reach.json --prefix <code>  # what is read back, and what is forgotten
node --import tsx scripts/audit-echo.ts world/reach.json --prefix <code>     # sentences the realm has already written once
node --import tsx scripts/audit-bearings.ts world/reach.json --prefix <code>  # walks your wilderness bearings; they are wrong more often than not
```

Run them from the repo root. Fix every line that names one of your ids. If
an error names an id that is not yours and not in the contract, you have a
typo. Then play your region blind for a dozen turns:

```bash
npm run turn -- new 5                                   # then act <id> <n>, look, status
```

Read your own screens as the player will. Finally write, in your report: the
flags your region SETS (contract and own), the contract flags it READS, the
rooms/named places/npcs/quests/stamps counts, the routes into and out of the
hollow with their checks, and anything the DSL would not let you do.
