# Authoring guide — writing tinyforge content

Content is data (`world/*.json`). This is the complete DSL, the conventions
every part of a shared world follows, and the bar your file must clear. Read it
once before writing a region; keep it open while you do.

## 1. How a world is put together

A world is one root file, plus part files it `include`s:

```json
{ "id": "reach", "title": "The Gray Reach", "intro": "...", "start": "va_gate",
  "hp": 10, "maxScore": 250,
  "include": ["reach/*.json"],
  "classes": {...}, "perks": {...}, "regions": {...}, "hud": [...],
  "rooms": {}, "items": {}, "npcs": {},
  "walkthrough": [...], "proofs": {...} }
```

A **part file** is a slice of the same world. It may carry only:

- records that merge by id — `rooms`, `items`, `npcs`, `classes`, `perks`,
  `regions`, `quests`, `proofs`, `templates`, `skills`. Two files defining the
  same id is a load error that names both files.
- lists that concatenate — `gen`, `stamps`, `epilogue`, `statusTracks`,
  `statusPaths`, `hud`.

Root-only fields (`id`, `title`, `intro`, `objectives`, `start`, `hp`,
`maxScore`, `walkthrough`, `progress`) in a part are a load error. Anything
else at the top level is too.

Load order: root, then parts in `include` order (globs sort by file name);
then `gen` regions expand into rooms; then `stamps` expand templates into
rooms. The validator sees the finished world, so generated and stamped
content is checked exactly like authored content.

## 2. Ids and names

- Every id you create is prefixed with your region code: `fd_reedholm`,
  `fd_saint_bell`, `fd_prior`. Flags and vars too: `fd_bell_rung`,
  `fd_toll_paid`. Cross-region names come from the design doc's contract only.
- Ids are `[a-z0-9_]`. Room, item, npc ids live in separate namespaces but keep
  them distinct anyway (an item and an npc both called `fd_bell` will confuse
  `use ... on`).
- Auto-flags the engine sets for you: `did_<actionId>` (an action with
  `once`), `said_<npc>_<topicId>` (a topic with `once`),
  `remarked_<npc>_<remarkId>`, `<itemId>_lit`, and the engine's own
  `_seenCheck`. You can read them in conditions.

## 3. Conditions

Every `if` is a list; all must pass. An empty list always passes.

| cond | means |
|---|---|
| `["has", item]` / `["!has", item]` | item is / is not in the inventory |
| `["flag", f]` / `["!flag", f]` | flag set / not set |
| `["npcDead", npc]` / `["!npcDead", npc]` | npc hp ≤ 0 (or not) |
| `["var", v, op, n]` | `op` is `<`, `>`, `=`, `>=`, `<=`; unset vars read 0 |
| `["class", c]` / `["!class", c]` | the player's class |
| `["perk", p]` / `["!perk", p]` | the player owns the perk |
| `["inParty", npc]` / `["!inParty", npc]` | companion travels with the player |
| `["any", [cond, cond, ...]]` | passes when at least one listed condition passes — the one OR inside an all-of list |

## 4. Effects

Effects run in order and stop the moment the game ends.

| effect | does |
|---|---|
| `["say", text]` | prints text |
| `["set", f]` / `["clear", f]` | flag on / off |
| `["score", n]` | add score (clamped 0..maxScore); prints `(+n)` |
| `["hp", n]` | heal or hurt (clamped 0..maxHp); 0 hp is the engine's `dead` loss |
| `["xp", n]` | grant xp; levels apply themselves (+2 max hp, a perk pick) |
| `["perk", p]` | grant a perk outright (a trainer) |
| `["move", item, where]` | `where` is `"inv"`, `"nowhere"`, `"here"` (drop in the player's room), or a room id |
| `["goto", room]` | move the player (fires the room's onEnter effects) |
| `["npcgo", npc, where]` | move an npc to a room id, `"here"` (the player's room), or `null` (gone) |
| `["setvar", v, n]` / `["addvar", v, n]` | numbers: gold, reputation, approval, counters |
| `["check", skill, dc, okFx, failFx]` | d20 + skill/attribute/perk mods vs dc (`>=` succeeds) |
| `["chance", pct, okFx, failFx]` | pct% from the seeded PRNG — replay-safe randomness |
| `["if", conds, thenFx, elseFx]` | branch inside an effect list |
| `["party", npc, "join"]` / `["party", npc, "leave"]` | companion joins / leaves (npc needs a `companion` block) |
| `["slay", npc]` | scripted death: no fight, no onDeath |
| `["end", "win"|"lose", endingId, text]` | ends the game (every ending id needs a proof — see §10) |

`check` skills are the four attributes `might`, `grace`, `wits`, `will`, or a
name in `world.skills`. Put the `check` **first** in an action's or topic's
effects when you want the menu to preview its odds (`(roll 9+ on the die;
+2 wits)`); a check buried after a `say` or inside an `if` gets no preview.

## 5. Rooms

```json
"fd_reedholm": {
  "name": "Reedholm",
  "desc": "Stilt-houses over black water. Nets dry on every rail; nobody mends them.",
  "brief": "Stilt-houses, black water.",
  "region": "fd",
  "landmark": "Reedholm",
  "exits": {
    "north": { "to": "fd_causeway" },
    "east":  { "to": "fd_priory", "if": [["flag", "fd_bell_rung"]],
              "lockedMsg": "The priory door is barred from inside.",
              "hint": "ring the saint's bell first", "landmark": "the priory" },
    "down":  { "to": "fd_under", "sideTrip": true }
  },
  "onEnterOnce": [["xp", 2]],
  "onEnter": [["if", [["inParty", "osk"]], [["say", "Osk: \"My mother mended nets on that rail.\""]], []]],
  "variants": [
    { "if": [["flag", "fd_hollow_burned"]], "name": "Reedholm, smoking", "desc": "The stilt-houses are char and steam.", "brief": "Char and steam." }
  ],
  "actions": [
    { "id": "fd_ring_bell", "label": "ring the saint's bell", "if": [["has", "fd_saint_bell"]], "once": true,
      "fx": [["set", "fd_bell_rung"], ["score", 5], ["say", "The bell's note goes out over the water and does not come back."]] }
  ]
}
```

- `desc` shows on first visit and `look`; `brief` on revisits. A room without
  a brief prints nothing on revisits.
- `exits` keys are direction words: `north south east west up down in out`
  (others work but read worse). A gated exit is still listed, marked
  `(locked: hint)` in the menu, and prints `lockedMsg` if tried.
- `landmark` makes the room a fast-travel destination once visited. Travel is
  offered **from** a landmark room with no aggressive npc present. Every
  landmark needs a `region`. Each region may hold at most 11 landmarks.
  Landmark names are what the player sees: `to Reedholm`.
- `variants`: first match overrides `name`/`desc`/`brief`. This is how the
  world shows a choice's consequence: a burned village, a reopened mine.
- `dark: true` rooms show only exits unless a lit `light` item is carried.
- Every room must be **reachable** from the start through some exit or `goto`
  (conditions ignored). An orphan room is a validator error.

## 6. Items

```json
"fd_saint_bell": { "name": "the saint's bell", "loc": "fd_chapel_nave", "takeable": true,
  "hint": "ring it where grief is loudest",
  "use": [ { "target": "fd_drowned", "fx": [["say", "..."], ["set", "fd_congregation_rested"]] } ] }
```

`loc` is a room id, `"inv"` (start in inventory), or `"nowhere"` (given later
by `move`). `hit`/`dmg` make a weapon (best carried counts, unarmed = 1 dmg),
`armor` reduces damage taken (best carried counts). `light: true` lights dark
rooms while flag `<id>_lit` is set. `use` entries run the first whose `if`
passes and whose `target` (item or npc) is at hand; `hint` shows on pickup and
as the menu preview for a use without a leading check.

## 7. Npcs, topics, conversations

```json
"fd_prior": {
  "name": "Prior Halm", "room": "fd_priory", "dialogue": true,
  "desc": "A thin man in gray, hands never still.",
  "topics": [
    { "id": "greet", "label": "who are you?", "once": true, "say": "Prior of a drowned house. Sit, if the damp doesn't trouble you." },
    { "id": "bell", "label": "the saint's bell", "if": [["flag", "said_fd_prior_greet"]], "once": true,
      "say": "Sunk with the nave. Ring it and they'll rise to answer — and I don't know which answer.", "fx": [["set", "fd_knows_bell"], ["xp", 2]] },
    { "id": "threat", "label": "give me the bell or I burn this house", "if": [["!flag", "fd_prior_threatened"]],
      "say": "You would, would you.", "fx": [["set", "fd_prior_threatened"], ["addvar", "rep_church", -1], ["addvar", "appr_osk", -1],
             ["check", "will", 12, [["say", "He tells you where it lies, and does not look at you again."], ["set", "fd_knows_bell"]], [["say", "He says nothing at all."]]]] },
    { "id": "bye", "label": "leave him to his damp", "say": "Go carefully.", "end": true }
  ]
}
```

- **Inline npcs** (no `dialogue`) list every visible topic in the room menu as
  `ask <name>: <label>`. Use for npcs with 1–3 topics.
- **Conversation mode** (`"dialogue": true`) folds them behind one `talk to
  <name>` entry; inside, the menu is the topics plus `end conversation`, and
  the room's menu waits. Use for anyone with 4+ topics. A topic with
  `"end": true` is a farewell: it closes the conversation after its line, and
  while one is visible the plain `end conversation` entry is not shown — so
  give every conversation-mode npc a farewell. Gate later topics on earlier
  ones with `said_<npc>_<topic>` flags to build a tree.
- Keep a topic's `say` under ~220 characters. Split long speeches across
  chained topics; the player chooses to hear more.
- Npc `name`s: common nouns lowercase and without an article ("barrow-wight",
  "gray husk"); proper names capitalized ("Lys", "Regent Ysolde"). Combat
  text adds "the" before a lowercase common noun and never before a capital
  or an existing the/a/an. `desc` (one line) shows after "is here" on the
  room's full view — first sight and `look` — and never on revisits.
- Fighting: `hp`, `atk` (damage per strike), `df` (the d20 + weapon hit +
  might total needed), `onDeath` effects. `hostile: true` only changes the
  room line (`(hostile, hp3/3)`); a non-aggressive hostile waits to be
  attacked. **`aggressive: true`** (needs hp and atk) strikes every turn the
  player stays in its room — walking through costs hp, and leaving is the
  answer. Use aggressive sparingly and never on a room the main path must
  linger in.
- Companions: a `companion` block (`hit`, `dmg`, `remarks`) lets `["party",
  id, "join"]` recruit them. See the design doc for who the companions are;
  their definitions live in `companions.json`. In your region, react to them
  with `["if", [["inParty", "osk"]], [["say", "Osk: \"...\""]], []]` in room
  effects or topic effects, and move their approval with `addvar appr_<id>`.

## 8. Wilderness regions (`gen`)

```json
"gen": [{
  "id": "fd_fen", "name": "the Fens", "seed": 41, "w": 6, "h": 5, "region": "fd",
  "walls": [[0,0], [5,4], [2,2]],
  "pools": {
    "scenes": [
      { "name": "Heron Stand", "desc": "Dead reeds in ranks, and one heron that does not move when you do.", "brief": "The unmoving heron." },
      { "name": "Sunk Fence", "desc": "Fence posts march into the water and keep going under it.", "brief": "Posts into the water." }
    ],
    "descs": ["Reeds, water, and the smell of iron."],
    "briefs": ["Reeds and water."]
  },
  "links": [
    { "cell": [0, 2], "dir": "west", "to": "va_causeway_east", "back": "east", "landmark": "the Vale road" },
    { "cell": [5, 1], "dir": "east", "to": "fd_reedholm", "back": "west", "landmark": "Reedholm" }
  ],
  "spots": [
    { "cell": [3, 3], "name": "The Drowned Nave", "landmark": "the drowned nave",
      "desc": "A chapel roof breaks the water like a whale's back.", "brief": "The chapel roof.",
      "items": ["fd_saint_bell"], "onEnterOnce": [["xp", 3], ["score", 5]] }
  ],
  "cellFx": { "onEnter": [["chance", 8, [["if", [["!npcDead", "fd_bog_thing"]], [["npcgo", "fd_bog_thing", "here"], ["say", "Something surfaces beside you."]], []]], []]] }
}]
```

- Cells are `<id>_<x>_<y>`; north is y−1, east is x+1. Cells in `walls` are
  not made and nothing leads into them — draw rivers, cliffs, the coast.
- Write **at least as many `scenes` as open cells** (w×h minus walls) so every
  cell is a distinct named place; `descs`/`briefs`/`names` only fill leftovers.
  A scene's desc should mention what makes the spot recognizable and, where
  it matters, which way the important things lie.
- `links` stitch cells to authored rooms; `spots` put authored content on a
  cell (name, desc, landmark, items, npcs, actions, variants, effects).
- `cellFx.onEnter` runs on every cell: put the region's wandering encounter
  there as a `chance` (≤ 10%) that brings a **single named** aggressive npc
  `here` while it lives — never spawn something unkillable or unavoidable.
- The region must stay connected (walls cannot cut it in two): the
  reachability check will tell you.

## 9. Templates and stamps

A template is a place written once with placeholders; a stamp is one copy of
it standing somewhere.

```json
"templates": {
  "fd_stilt_ruin": {
    "entrance": "$deck", "vars": ["NAME", "OWNER"],
    "rooms": {
      "$deck": { "name": "{{NAME}} — deck", "desc": "A sunk stilt-house; {{OWNER}}'s, once.", "exits": { "down": { "to": "$hold" } } },
      "$hold": { "name": "{{NAME}} — hold", "desc": "Water to the knee. Something bumps your shin.", "exits": { "up": { "to": "$deck" } },
                 "actions": [{ "id": "$search", "label": "search the hold", "once": true, "fx": [["check", "wits", 9, [["move", "$cache", "inv"], ["score", 3]], [["hp", -1], ["say", "Whatever bumped you bites."]]]] }] }
    },
    "items": { "$cache": { "name": "{{OWNER}}'s cache", "loc": "nowhere", "hint": "coin and a keepsake" } }
  }
},
"stamps": [
  { "template": "fd_stilt_ruin", "id": "fd_ruin1", "at": "fd_fen_1_3", "dir": "in", "back": "out", "vars": { "NAME": "Marl's House", "OWNER": "Marl" }, "sideTrip": true, "landmark": "a sunk house" }
]
```

- Inside a template, every id you own (rooms, items, npcs, flags, vars,
  action ids) starts with `$`; `$hold` in stamp `fd_ruin1` becomes
  `fd_ruin1_hold`. Ids you reference from outside (a global flag, a shared
  item) are written plain and stay shared. `{{VAR}}` is replaced from the
  stamp's `vars`; every var the template lists is required.
- `at` may be an authored room or a generated cell; stamps expand after
  regions. Stamped rooms inherit the host's `region`. `entranceLandmark`
  makes the copy's entrance a fast-travel destination by that name (it counts
  toward the region's 11).
- Shared templates (barrow, cave, tower, mine, camp, chapel, hut) live in
  `templates.json`; a region may add its own. Use 3–5 stamps per region.
  Give each copy a distinct `NAME` and a distinct inhabitant; vary which
  class-favored solution works.

## 10. Quests, journal, epilogue, hud

```json
"quests": {
  "fd_bell": { "name": "The Saint's Bell",
    "start": [["flag", "fd_knows_bell"]], "done": [["flag", "fd_congregation_rested"]], "failed": [["flag", "fd_bell_sold"]],
    "stages": [
      { "if": [["has", "fd_saint_bell"]], "text": "Ring the bell at the drowned nave." },
      { "if": [], "text": "Find the saint's bell in the sunk nave, east of Reedholm." } ] }
},
"epilogue": [
  { "if": [["flag", "fd_congregation_rested"]], "text": "In Reedholm they ring a bell at dusk now, and the water stays quiet." },
  { "if": [["flag", "fd_hollow_burned"]], "text": "Reedholm was rebuilt on the ashes of its stilts. Nobody there says the saint's name." }
]
```

- A quest lists once `start` passes (default: from the beginning) until
  `done` or `failed`. Stages are tried top to bottom; put the most advanced
  first. Any change prints `Quest — name: text` the turn it happens; `status`
  lists the journal. Every region quest (4–6 per region) needs a stage for
  each state a player can be in.
- Epilogue lines print after any ending when their conditions hold, in file
  order, at most 6. Write 4–8 per region: rested / burned / bargained /
  untouched, plus one or two for memorable side choices. One sentence each.
- `hud` (root) puts counters on the status line; `gold` is already there.
- `factions` (root) names reputation vars (`rep_church` → "the Gray Church"):
  any `addvar` to a named var prints `(the Gray Church -1)` the turn it
  happens, and an `addvar` to `appr_<npc>` prints "<Name> approves." or
  "disapproves." when that companion is in the party or the room. Choices
  are legible without the player calling `status`.

## 11. Endings and proofs

Only the root world (act 1 and act 3 files) ends the game. A region file
never uses `end`. Every ending id used anywhere needs `proofs.<id>`: a list of
menu labels that replays (seed 1) to exactly that ending. The root
`walkthrough` must replay to a **win with score === maxScore**. Labels are the
canonical text without the display hints: `go east`, `talk to Prior Halm`,
`the saint's bell`, `end conversation`, `travel to a known place`, `to
Reedholm`, `attack bog-thing with belt knife`, `perk: Iron Skin (+1 armor)`,
`be a Scout — ...` (the full class line). A step may be
`{"repeat": "<label>", "until": <cond>, "max": n}`.

To record labels instead of writing them: play with `npm run turn -- new 1`,
`act <id> <n>`…, then `npm run turn -- labels <id>`.

## 12. Style and budget

The player is a language model reading one screen per turn. Every screen is
paid for. `test/budget.test.ts` fails the build if the average `act` response
along the walkthrough exceeds 450 characters or any single one exceeds 1100.

- `desc` ≤ 260 characters; `brief` ≤ 70; topic `say` ≤ 220; action/topic
  `label` ≤ 40; epilogue line ≤ 140. One striking, concrete detail beats three
  adjectives. Say what is here and which way things lie; do not explain the
  game.
- Menus: at most 12 entries anywhere, aim for ≤ 8 in a room. Gate topics and
  actions on state so only the live ones show. Use conversation mode for
  anyone with 4+ topics. Use `if` effects instead of parallel gated copies of
  the same action.
- Never label a check "safe to try" if its failure costs hp
  (`test/content.test.ts` enforces it). State costs plainly: `force the gate —
  a failed try costs 1 hp`.
- Every reward once: `once: true`, or a flag, on anything that grants xp,
  score, or items. Repeatable topics must be plain reminders with no `fx`.
- Voice: plain, grounded, a little dry. No modern idiom, no exclamation marks
  in narration. Npcs have one distinct tic each. The blight is "the gray";
  the dead are "unrested" or "hollow", never "zombies".
- Choices that matter: at least one decision per region with a consequence
  the player meets again later (a flag another room, quest stage, companion
  remark, or epilogue line reads). Prefer three ways past an obstacle: force
  (might / a fight), craft (grace / wits), and words (will / an item / a
  favor). No class is ever locked out of a region's hollow.

## 13. Before you hand it in

```bash
npm run validate world/reach.json   # every reference, every proof, the menu cap
npm run crawl world/reach.json      # random walks: crashes, empty menus, "undefined" holes
npm run test                        # budget, content rules, determinism
```

Fix every line the validator prints about your ids. Then play your region
blind for ten turns with `npm run turn -- new 3` and read your own screens as
the player will.
