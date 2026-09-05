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

One file, `world/reach/<code>_<name>.json` (e.g. `fd_fenmarch.json`), a part
file with only these top-level keys: `rooms`, `items`, `npcs`, `gen`,
`stamps`, `templates` (only if you add a region-specific one), `quests`,
`epilogue`, `statusTracks` (optional, at most one). Every id prefixed with
your code. No `end` effects. No `walkthrough`/`proofs` (root-only).

Do not edit any other file. Do not commit. Scratch files go under `/tmp`.

## What a region contains

- **A settlement** (6–10 authored rooms): an inn or hearth where `rest`
  heals (`["hp", 10]`), a place of trade (a shop is just actions gated on
  `["var","gold",">=",n]` with `addvar gold -n` and `move item inv`), the
  faction presence named in your assignment, 5–8 npcs with real opinions.
  Anyone with 4+ topics uses `dialogue: true` and has a farewell topic
  (`end: true`).
- **Gateway rooms** with the exact ids and neighbor targets from your
  assignment. Set `["set","<code>_entered"]` in `onEnterOnce` of every
  gateway (companions react to it). Gateways are landmarks.
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

## Budget (hard limits the tests enforce)

`desc` ≤ 260 chars; `brief` ≤ 70; topic `say` ≤ 220; `label` ≤ 40; any
single `say` effect ≤ 220; epilogue ≤ 140; stage text ≤ 120. Room menus ≤ 12
always, ≤ 8 typically — gate topics and actions on state. No check labelled
safe if failure costs hp; state the cost in the label. Every check you want
previewed goes FIRST in its effect list.

## Validate before you hand in (mandatory)

Your file is validated as part of the whole draft realm:

```bash
node --import tsx src/validate.ts drafts/reach.json     # must print ✓ for the realm
node --import tsx src/crawl.ts drafts/reach.json        # must be clean; note rooms seen
```

Run them from the repo root. Fix every line that names one of your ids. If
an error names an id that is not yours and not in the contract, you have a
typo. Then check your text budgets programmatically (write a small script)
and play your region blind for a dozen turns:

```bash
TF_WORLD=drafts/reach.json npm run turn -- new 5      # then act <id> <n>, look, status
```

Read your own screens as the player will. Finally write, in your report: the
flags your region SETS (contract and own), the contract flags it READS, the
rooms/named places/npcs/quests/stamps counts, the routes into and out of the
hollow with their checks, and anything the DSL would not let you do.
