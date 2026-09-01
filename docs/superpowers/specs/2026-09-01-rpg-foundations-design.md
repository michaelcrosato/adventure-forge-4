# RPG foundations — design

Date: 2026-09-01. Status: approved by goal directive; building.

## Goal

Turn tinyforge from a one-quest demo into a deep RPG:

- multiple character classes
- choices that matter (different paths, different endings)
- dice rolls, perks, bonuses
- an overworld that can scale past Skyrim's map
- all of it as data the repo's loops (playtest, triage, dev) can keep working on

## Rules we keep (non-negotiable)

These come from the existing charter and stay true:

1. Content is data (`world/*.json`). The DSL is closed. The validator whitelists every op.
2. Same seed + same actions = same run. All game randomness flows through the PRNG cursor in state.
3. One turn = one tool call. Menu cap 12. The token budget is a test.
4. Every world carries its proof: a walkthrough that replays to a win with `score === maxScore`.
5. Every change is additive. `world/lighthouse.json` keeps validating untouched.

## System 1: attributes and classes

Four attributes. Plain names, plain meanings:

- **might** — fight, lift, break
- **grace** — sneak, climb, dodge
- **wits** — know, notice, solve
- **will** — talk, lead, hold firm

Worlds may define classes:

```json
"classes": {
  "warden": {
    "name": "Warden",
    "desc": "A soldier of the old watch. Strong and hard to kill.",
    "attrs": { "might": 2, "will": 1 },
    "hp": 4,
    "items": ["short_sword"],
    "perks": []
  }
}
```

If a world has classes, the game starts with a class menu. Picking a class is a
normal action, so it lands in the trace and replays deterministically. The
start room is entered only after the pick.

State gains: `classId`, `attrs`, `perks`, `xp`, `level`, `perkPicks`.
Worlds without classes never set these, so nothing changes for lighthouse.

New conditions: `["class", id]`, `["!class", id]`. Content can offer options to
one class only. This is the cheapest way to make class choice matter everywhere.

## System 2: dice

The d20 stays the one die. What changes is what feeds the roll:

- Skill check: `["check", name, dc, okFx, failFx]` now rolls
  `d20 + world.skills[name] + state.attrs[name] + perk check bonuses`.
  Lighthouse has no attrs or perks, so its numbers do not move.
- Attack roll: `d20 + weapon hit + might`. Crit on natural 20 doubles damage
  (already true).
- Damage taken: `max(1, npc atk - armor)`. Armor comes from carried items
  (`armor` field, best one counts) and perks. No armor means no change.

## System 3: perks

Perks are data:

```json
"perks": {
  "iron_skin": {
    "name": "Iron Skin",
    "desc": "+1 armor",
    "require": { "level": 2 },
    "bonus": { "armor": 1 }
  }
}
```

- `require` may name a minimum `level`, allowed `class` list, or a minimum
  attribute (`"attr": ["wits", 2]`).
- `bonus` may add to checks by attribute name, to `hit`, `dmg`, `armor`, or `maxhp`.
- New conditions `["perk", id]` and `["!perk", id]` gate content on perks.
- A world can also grant a perk directly with the effect `["perk", id]`
  (a trainer teaches you).

## System 4: XP and levels

- New effect: `["xp", n]`.
- Level thresholds are fixed in the engine: cumulative xp for level L is
  `5 * L * (L - 1)`. So level 2 at 10 xp, level 3 at 30, level 4 at 60, level 5 at 100.
- On level-up: +2 max hp, heal 2, and one perk pick.
- While a perk pick is pending and eligible perks exist, the menu shows only
  perk choices (at most the menu cap, sorted by id). Picking one is a normal
  action in the trace. If no perk is eligible, the pick is dropped.

## System 5: choices that matter

Most of this uses primitives that already exist — flags, vars, gated exits,
topics, and endings. What's new is that the validator now demands proof:

- `world.proofs` is a map from ending id to a walkthrough. Each one must
  replay (seed 1) to a game that ended with exactly that ending.
- Every distinct ending id used in an `["end", ...]` effect must have a proof,
  except the primary walkthrough's ending and the built-in `dead`.

So "choice matters" is not a claim. Every ending in the shipped world is
replay-proven reachable, and the primary path is still proven to reach full
score. Faction standing is plain vars (`rep_reeve`, `rep_priest`) moved by
`addvar` and read by `var` conditions.

## System 6: the overworld generator

Worlds may carry `gen` regions:

```json
"gen": [{
  "id": "ashwood",
  "name": "Ashwood",
  "seed": 11,
  "w": 8, "h": 8,
  "pools": { "descs": ["Ash trees, gray and close.", "..."], "briefs": ["Gray trees."] },
  "links": [
    { "cell": [0, 4], "dir": "west", "to": "village_gate", "back": "east" },
    { "cell": [7, 3], "dir": "east", "to": "barrow_field", "back": "west" }
  ],
  "spots": [
    { "cell": [5, 1], "items": ["old_cairn_coin"], "onEnterOnce": [["xp", 2], ["say", "A cairn of gray stones."]] }
  ]
}]
```

`expandWorld` (new `src/worldgen.ts`) runs inside `loadWorld`, before
validation. Each region becomes a w×h grid of rooms (`ashwood_3_4`), joined by
north/south/east/west exits, with names and text drawn from the region's pools
by a PRNG seeded from `gen.seed`. `links` stitch region cells to authored
rooms. `spots` place authored items, npcs, and one-off events on exact cells.

Facts that make this safe:

- Expansion is deterministic: same file, same world, every run and machine.
- The validator sees the expanded world, so every generated room and exit is
  checked like authored content.
- Text comes from pools in the world file. Content stays data; the generator
  only builds structure.
- Scale is a parameter. The shipped world stays small enough to play inside
  the token budget. A test proves the same generator expands and validates a
  25,000+ room world in seconds — that is the "bigger than Skyrim" claim, kept
  honest and cheap instead of shipped and unplayable.

## System 7: the world — The Vale of Ash

New world `world/vale.json`. Lighthouse stays as the tiny regression world.

Story, in one line: the barrow of the Hollow King has opened, a gray blight
spreads across the vale, and you are the one who walked in anyway.

- **Classes:** Warden (fight), Scout (move and notice), Scholar (know), Envoy (talk).
- **Hub:** the village of Last Light — inn (rest heals), forge, chapel, elder.
- **Factions:** the Reeve (seal the barrow) and the Gray Priest (honor the king).
  Helping one costs the other's aid. Tracked in vars.
- **Wilderness:** generated Ashwood region between village and barrow, with
  placed sites: hunter's camp, drowned chapel, watchtower.
- **Barrow:** authored dungeon — antechamber, hall of verses, crypt, throne.
- **Three ways to win**, each favoring different classes but open to all:
  1. `king_slain` — go down and destroy him (fight path)
  2. `blight_bound` — recover the three verses and bind him (lore path)
  3. `debt_paid` — learn his grievance and return the stolen crown (talk path)
- **Lose endings:** `dead`, and `crowned_hollow` — accept his offer.
- Rest at the inn heals. Herbs heal on use. (Direct answer to the playtest
  finding that hp loss had no recovery.)
- Primary walkthrough: the lore path played thoroughly, reaching `maxScore`.
  `proofs` carry the other three endings.

## What changes where

| file | change |
|---|---|
| `src/types.ts` | ClassDef, PerkDef, GenDef, new conds/fx, state fields |
| `src/engine.ts` | classpick + perkpick actions, xp/level, attr/perk math in checks and combat |
| `src/worldgen.ts` | new — deterministic region expansion |
| `src/validate.ts` | new op whitelists, class/perk/gen reference checks, ending proofs |
| `src/format.ts` | class menu header, level-up lines (small) |
| `world/vale.json` | the new world |
| `test/` | character, perks, worldgen, endings-proof tests; budget test runs on every world |
| `src/mcp.ts`, `src/play.ts` | default world becomes vale (`TF_WORLD` still overrides) |

## Build order

Each stage ends verify-green and committed:

1. types + engine: classes, attrs, checks, combat math — with tests
2. perks + xp + level-ups — with tests
3. validator: new ops + ending proofs — with tests
4. worldgen + scale bench — with tests
5. `world/vale.json` + walkthrough + proofs; budget test over all worlds
6. defaults, README, AGENT.md notes

## Out of scope (on purpose)

- Ranged combat, spell lists, equipment slots beyond best-weapon/best-armor
- Companions that follow the player
- Save/load beyond what traces already give
- Any second die size

Small systems that compose beat big systems that don't. Every one of these can
be added later as data plus one small engine change, behind the same validator.
