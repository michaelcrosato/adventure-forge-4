# The Gray Reach — realm design

Date: 2026-09-05. Status: in progress. The engine features this design needs
(conversation mode, companions, aggressive npcs, chance, fast travel across
regions, room variants, quest journal, epilogue, hud, templates and stamps,
worlds in parts, if/slay/here) shipped first; this document is the content
contract every region file is written against. Where it and `world/reach*`
disagree, the world files are the truth.

## Goal

Grow tinyforge from one hold and one quest into a realm: choices with
consequences that follow the player across the map (the BG3 bar), and a world
with the named-location count of Skyrim (~340 named places), all inside the
same bar — closed DSL, determinism, replay-proven endings, the token budget,
menu cap 12.

## Premise

Four hundred years ago the Hollow King's own blood — the first Reeve — took
the crown from his father's barrow and founded the House that rules the Reach
from Marrowgate. The barrow-rites that kept the realm's dead asleep remembered
the theft, so the House let them lapse, hold by hold, until the last keepers
died or hid. Now the dead have lost their sleep. Grief spills out of every
hollow place as the gray: crops first, then cattle, then the will to stay.

The Vale of Ash is where it began. The player walks into the barrow there
(act 1), learns that the king's grief is one of many, and carries what they
learned across the Reach (act 2) to Marrowgate, where the first Reeve's own
unrested grave lies under the Hollow Throne and the Crown Regent rules on a
stolen legitimacy (act 3).

Tone: low fantasy, grounded, plain-spoken, morally gray. Ghosts, grief, iron,
ash. No dragons, no demons, no spells. The gray is never cured by killing
alone, and never by kindness alone.

## The map

```
                   [cp Coldpass] ─── [mg Marrowgate]
                        │
   [ir Iron Downs] ─ [wm Wardmoor] ─ [hb Hollowbrook]
         │                │                │
   [th Thornwold] ── [va Vale of Ash] ── [fd Fenmarch]
         │                                 │
   [sk Saltkerns] ─────── coast road ──────┘
```

Nine regions, nine two-letter codes. Every id in a region file carries its
code. Neighbors connect through **gateway rooms** with fixed ids; each region
defines its own gateway room and the exit pointing at the neighbor's gateway.

| code | region | settlement | gateways (own room → neighbor room) |
|---|---|---|---|
| `va` | The Vale of Ash | Last Light | `va_west_road`→`th_east_edge`; `va_causeway`→`fd_causeway_west`; `va_north_road`→`wm_south_gate` |
| `th` | Thornwold | Camp Gallows (Free Company) | `th_east_edge`→`va_west_road`; `th_north_track`→`ir_south_track`; `th_south_track`→`sk_north_track` |
| `fd` | Fenmarch | Reedholm | `fd_causeway_west`→`va_causeway`; `fd_north_dike`→`hb_south_dike`; `fd_coast_road`→`sk_coast_road` |
| `wm` | Wardmoor | Highward | `wm_south_gate`→`va_north_road`; `wm_west_road`→`ir_east_road`; `wm_east_road`→`hb_west_road`; `wm_north_road`→`cp_south_stair` |
| `ir` | The Iron Downs | Cinderhall | `ir_east_road`→`wm_west_road`; `ir_south_track`→`th_north_track` |
| `hb` | Hollowbrook | Barrowmere | `hb_west_road`→`wm_east_road`; `hb_south_dike`→`fd_north_dike` |
| `sk` | The Saltkerns | Gullhaven | `sk_north_track`→`th_south_track`; `sk_coast_road`→`fd_coast_road`; `sk_smugglers_stair`→`cp_smugglers_cave` (gated: `free_passage`) |
| `cp` | Coldpass | St. Ashwyn's Perch | `cp_south_stair`→`wm_north_road`; `cp_smugglers_cave`→`sk_smugglers_stair`; `cp_pass`→`mg_south_gate` (gated, see act 2) |
| `mg` | Marrowgate | the capital | `mg_south_gate`→`cp_pass` |

Each region is: a settlement (6–10 authored rooms, with an inn that heals),
a wilderness `gen` grid (5×5 to 7×7, walled into a shape, **every open cell a
named scene**), 3–5 stamped places (barrows, caves, towers, mines, camps,
chapels, huts — from `templates.json` or the region's own), one **hollow**
(the region's unrested grief and the act-2 node), 4–6 quests, 6–12 npcs, and
4–8 epilogue lines. Budget: ~55 rooms and ~35 named places per region.
Marrowgate is larger (~30 authored rooms). Total ≈ 500 rooms, ≈ 350 named
places.

## Acts and gates

**Act 1 — the Vale.** The barrow quest as shipped in `world/vale.json`,
re-authored leaner and **non-terminal**: resting, slaying, or forsaking the
Hollow King sets flags instead of ending the game (kneeling still ends it —
`crowned_hollow` stays a lose ending). The first Reeve's herald, **Corvane**,
arrives in Last Light square when the king is resolved: the Regent wants the
gray declared treason and every hollow burned. He opens act 2 by naming the
Reach's other hollows and the road to Marrowgate.

Open from the start: Thornwold (west), Fenmarch (east), and through them the
Iron Downs, Saltkerns, Hollowbrook. Highward's south gate (Wardmoor) admits
no one from a blighted hold until the barrow is dealt with (`act2_open`).

**Act 2 — the holds.** Six regions, six hollows. Each hollow can be
**rested** (a rite: verses, a relic, a bargain kept), **burned** (the
Ironbound way — quick, permanent, and remembered), or **bargained** (the
grief is bought off or turned; the dead stay, quieter). Resting or bargaining
adds 1 to `hollows_rested`; burning adds 1 to `hollows_burned`. Every hollow
has a force, a craft, and a words solution and never needs a specific class.

Coldpass's `cp_pass` exit into Marrowgate opens on **any one** of:

- `["var", "hollows_rested", ">=", 3]` — the covenant road: the Keepers open
  the old pilgrim stair.
- `["flag", "regent_writ"]` — the crown road: earned by burning two hollows
  for the Ironbound, or by the Watch's commission in Wardmoor.
- `["flag", "free_passage"]` — the smugglers' road: the Free Companies take
  you under the pass through the Saltkerns caves.

**Act 3 — Marrowgate.** How you arrived colors the city (variants and npc
placement on the three flags above). The finale is under the palace at the
Hollow Throne, where the first Reeve's shade waits and the Regent comes to
watch. The endings (all proof-replayed):

| id | kind | how |
|---|---|---|
| `reach_at_rest` | win | the Great Rite: `hollows_rested >= 3`, the crown returned or broken in the Vale, the Reeve's shade rested |
| `reach_burned` | win | the Hollow Throne burned with the Ironbound; the dead of the Reach gone for good, rites and all |
| `regent_deposed` | win | the Regent removed by the Watch, the Companies, or your own hand; the crown goes back to the barrow line or to the Keepers |
| `gray_crown` | win (bitter) | you take the throne with the Vale's crown in hand; the gray thins but does not leave |
| `hollow_reach` | lose | you kneel to the first Reeve's shade, or leave the throne unresolved with every hollow burned and no rite left to speak |
| `crowned_hollow` | lose | act 1: kneeling in the Vale barrow |
| `dead` | lose | the engine's |

Epilogue lines (root and per region) make each ending read differently:
which hollows rested or burned, who ruled after, which companions stayed,
what the Vale remembers.

## The state contract

Names every file may read or write. Anything else stays region-prefixed.

**Vars.** `gold`; `hollows_rested`, `hollows_burned`; reputation `rep_watch`,
`rep_church`, `rep_iron`, `rep_free`, `rep_keepers`, `rep_crown`; approval
`appr_lys`, `appr_osk`, `appr_tamsin`, `appr_vell`. Reputation moves by ±1
per deed (±2 for a hollow); thresholds at 2 and −2 gate faction content.
Approval likewise; a companion at −3 leaves at the next settlement.

**Flags.** `act2_open`, `regent_writ`, `free_passage`;
act-1 outcomes `va_king_rested`, `va_king_slain`, `va_king_forsaken`,
`va_crown_returned`, `va_crown_broken`, `va_crown_kept`, `va_sealed`,
`va_verses_all`; per region `<rg>_hollow_rested`, `<rg>_hollow_burned`,
`<rg>_hollow_bargained`; companions `lys_joined`, `lys_left`, `lys_dead`
(same for `osk`, `tamsin`, `vell`), plus each companion's personal-quest
flags below.

## Factions

| var | faction | wants | home | gives |
|---|---|---|---|---|
| `rep_watch` | the Watch | order; hollows sealed, roads safe | Highward (wm) | shields, the commission (`regent_writ` route), gate passes |
| `rep_church` | the Gray Church | grief given air; rites kept | the Priory (fd), chapels everywhere | healing, blessings that open barrow doors, the bell |
| `rep_iron` | the Ironbound | the dead burned, the gray ended for good | Cinderhall chapterhouse (ir) | fire, armor, the writ, a clean answer |
| `rep_free` | the Free Companies | coin and no masters | Camp Gallows (th), Gullhaven (sk) | passage, muscle, stolen things, `free_passage` |
| `rep_keepers` | the Barrow-Keepers | the old covenant restored | the Understory (th), Keepers' Hall (hb) | verses, the Keeper's Key, the pilgrim stair |
| `rep_crown` | the House of the Reeve | the theft forgotten | Marrowgate | titles, gold, the Regent's ear, a knife in the back |

Helping one faction costs another where their aims cross (Church vs Watch on
doors; Ironbound vs Keepers on the dead; Free vs Crown on everything).

## Companions

Four, all recruitable in act 1, all `dialogue: true`, all with a personal
quest that resolves in another region and at least one way to lose them.
Their definitions live in `world/reach/companions.json`; regions react to
them with `inParty` conditions and move `appr_<id>`.

| id | who | style | approves | disapproves | personal quest | can leave |
|---|---|---|---|---|---|---|
| `lys` | the Vale hunter's daughter, a scout | quiet, dry, watches the trees | mercy to beasts and the desperate; keeping promises | cruelty, burning, lying to the poor | her brother rides with the Free Company at Camp Gallows (th); bring him home, or bury him | leaves if you burn Thornwold's hollow with her brother's company inside |
| `osk` | Brother Osk, a Gray Church novice | earnest, quotes verses badly | rites, open doors, honoring the dead | sealing, burning, mocking the Church | his drowned family in the Fenmarch nave (fd); rest them, and he becomes a priest; burn them, and he breaks | leaves if `fd_hollow_burned` while in party |
| `tamsin` | the smith's apprentice, a warden | blunt, practical, counts blows | force met with force, plain dealing, protecting the living | wasted words, betrayal, robbing the dead | her mother died in the Iron Downs' collapsed mine (ir); find the cause; the Ironbound or the foreman lied | leaves if you sell out Cinderhall's miners to the Ironbound |
| `vell` | the wandering scholar | precise, curious, evasive about Marrowgate | knowledge, verses, keeping the crown whole | destroying the crown, burning archives, the Ironbound | Vell is a Marrowgate exile of the Reeve's line; the Keepers' Hall (hb) holds the ledger that proves it | if `appr_vell <= -2` and you hold the crown at the Hollow Throne, Vell takes it — `gray_crown` becomes theirs, a betrayal ending variant |

Companion mechanics: each has `companion.hit`/`dmg` (Tamsin the strongest,
Vell the weakest), remarks on arrival in each region and on the big choices,
approval-gated topics (a confidence at +2, a rebuke at −2), and a personal
quest with two or three resolutions that set a `<id>_quest_*` flag the
epilogue reads.

## Shared templates (`templates.json`)

Built as written below, with one liberty: every template offers a force, a
craft, and a words route (the table's loop column omitted one for barrow,
tower, and camp), so no class is ever locked out of a stamped place. Where
this table and `world/reach/templates.json` disagree, the file is the truth.

| template | rooms | vars | the loop |
|---|---|---|---|
| `barrow` | mouth, passage, chamber, rest | NAME, WIGHT | a wight guards a verse-stone; read it (wits) / trace it (grace) / cut the wight down (fight); the rest room holds a keepsake |
| `cave` | mouth, throat, den | NAME, BEAST | a beast that is aggressive in its den only; bait it (item) / sneak (grace) / kill it; loot |
| `tower` | base, stair, top | NAME, WATCHER | a watcher-shade with a question; answer (wits), bluff (will), or climb past (grace); the top shows the region (a bearings action naming landmarks) |
| `mine` | adit, gallery, face, deep | NAME, FOREMAN | blight pooled in the deep; a foreman's ghost; shore the gallery (might) / find the ledger (wits) / promise the dead (will) |
| `camp` | palisade, fire, tent | NAME, CAPTAIN, TOLL | a company that takes a toll: pay (gold) / fight / talk them down (will); the captain remembers |
| `chapel` | porch, nave, crypt | NAME, SAINT | a relic under a saint's name; the congregation's remains; a rite or a theft |
| `hut` | hut | NAME, HERMIT | one hermit with one secret and one need |

## Act 1 rebuild — what changes from `world/vale.json`

Keep: the cast (reeve, innkeep, wandering scholar, gray priest, smith, elder,
hunter), the places, the verses, the crown, the seal/open choice, the
kneel-warning, the class-specific solutions. Change: room and topic prose cut
to the style budget; conversation mode for reeve, priest, elder, hunter,
king; the twenty `trail_to_*` actions replaced by landmarks and fast travel;
the six-way rite duplication replaced by `if` effects; the wolves made
aggressive in their own cells only; the throne's resolutions set the act-1
flags instead of ending the game; Herald Corvane arrives; the four companions
are met here (Lys at the hunter's camp, Osk in the chapel, Tamsin at the
forge, Vell at the inn) and can be recruited before or after the barrow.

## Scale and proof

Target counts: ≈500 rooms, ≈350 named places, ≈120 npcs, ≈45 quests, ≈36
stamped places, 4 companions, 6 factions, 7 endings each with a proof, an
epilogue of 60+ lines. `maxScore` 250 with roughly twice that much score
available across the realm, so any thorough route reaches the cap and the
walkthrough proves one does. The walkthrough is the covenant road played
straight: Vale (verses and crown), Fenmarch, Hollowbrook, Thornwold's
Understory, Coldpass, Marrowgate, `reach_at_rest`.

**As built** (after the first playtest rounds): 405 rooms, 122 npcs, 108
items, 49 quests, 32 stamped places, 108 epilogue lines, 4 companions, 6
factions, 7 endings each with a proof; every gate in the holds and the
capital has a force, a craft and a words route. `maxScore` 366, the score the
proven walkthrough reaches: a Scholar with Lys along rests Thornwold (the
Keeper's verse), the Iron Downs (the true ledger) and the Saltkerns (the
sailors' verse under the Farlight), earns the Free Companies' stair in
Gullhaven, climbs the Keepers' pilgrim stair at Coldpass, hears the first
Reeve's confession, and speaks the Great Rite — 255 turns, 417 characters a
screen on average. Proofs replay the Regent deposed by the Companies, the
throne burned with the Regent's own oil, the Vale's crown worn on the gray
seat, and kneeling to the hollow. Nine blind playtests of the whole realm
(300–600 turns) reached four wins on three different roads — two of them at
full score — and one loss; their findings are fixed.

## Build order

1. `world/reach.json` root + `companions.json` + `templates.json` + the
   rebuilt Vale (`va_vale.json`), validating and proving `crowned_hollow` and
   a temporary act-1 walkthrough. Land it.
2. Six hold regions in parallel worktrees (one author each), each validated
   against the landed base with only its own file added. Land them one by one.
3. Coldpass and Marrowgate, the act-3 endings and proofs, the real
   walkthrough, the root epilogue. Switch the default world to the Reach.
4. Blind playtests; triage; fix; repeat. (Steps 1–3 are done; this loop is
   where the realm lives now.)
