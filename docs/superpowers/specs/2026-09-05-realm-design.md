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

**As built** (after the ninth playtest round): thirteen regions, ten holds;
625 rooms, 183 npcs, 195 items, 95 quests, 48 stamped places each with its own
sign, reward and hermit's voice, 450 epilogue lines, 4 companions, 6 factions,
7 endings each with a proof; every gate in the holds and the capital has a
force, a craft and a words route, every hollow room weighs its grief for
free, ten waystations on the roads between the holds each put a small choice
in the traveller's way, and a travel list or a conversation that outgrows the
menu cap turns pages, so neither regions nor landmarks are capped. `maxScore`
366, the score the proven walkthrough reaches: a Scholar with Lys along rests
Thornwold (the Keeper's verse), the Iron Downs (the true ledger) and the
Saltkerns (the sailors' verse under the Farlight), earns the Free Companies'
stair in Gullhaven, climbs the Keepers' pilgrim stair at Coldpass, hears the
first Reeve's confession, and speaks the Great Rite — 255 turns, about 417
characters a screen on average. Proofs replay the Regent deposed by the
Companies, the throne burned with the Regent's own oil, the Vale's crown worn
on the gray seat, and kneeling to the hollow. Forty-two blind playtests of the
whole realm (300–600 turns) reached thirty-five wins on four different roads,
one loss, and six players who ran out of turns in the holds; every one of the
804 findings they raised is fixed, disproven by replaying the trace, or
judged by design.

**Roads Between** (added after the first playtest rounds): a ring of six
cross-hold quests, each asked in one hold and settled in the next, flagged
`rb_<a>_<b>_*`. Quartermaster Bray's second dead-letter, in Thornwold, is
settled at the Priory's tablets, the net-hall's fire, or the drowned nave, in
Fenmarch. A Reedholm mother's plea for her pressed son Perrin, in Fenmarch, is
settled at Highward's barracks — sent home, covered for, or reported — in
Wardmoor. Corporal Fenn's dead partner's pawned ring, in Wardmoor, is forced,
read from the ledger, or bought fairly out of Cinderhall's company store, in
the Iron Downs. Old Crick's grandson Berin, gone to the coin road, in the Iron
Downs, is bought home, left to his own way, or guilted home, in the Saltkerns.
The Drowned Bell's unrung tithe, in the Saltkerns, is given to Keeper Wren,
sold to the chandler, or hung on the great mound's door, in Hollowbrook. And
Keeper Wren's question for a sister Hall, in Hollowbrook, is answered — the
verse sent whole, a lesser token, or nothing at all — by Keeper Rowan in
Thornwold's Understory, closing the ring.

**Remembered** (after the choice audit, `scripts/audit-choices.ts`): the
forks the realm forgot now echo somewhere else. The herald's oath is met
again in the Regent's chamber and by the Marshal and Quill; each companion's
advice is quoted back when their grief resolves and colors their epilogue;
their confidences are recalled; Vell's promise is tested in Marrowgate, kept
or broken; Cal staying with the Company is its own ending line. The chapel
crypts count the dead laid to rest and the dead robbed, and the Prior, Keeper
Wren and the abbot answer for it; Rennick's smuggling and informing on him are
told apart; the Drowned Chapel wears the Third Bell's outcome; the pilgrim's
token and the drovers' family, the chandler's ring and three pieces of
knowledge all find a second place. Eighteen forgotten forks remain, all
single-path markers or warnings by design.

**Emberfall** (the tenth region, `em_`): west of Thornwold by the wayfire's
ash road, the hold that was burned once. Glasswick among the ruins — a
glass-master, a prior who guards the Church's sealed record of the old
burning, a charcoal-burner, an Ironbound factor, a Companies runner, a Keeper
hiding from her own Church, a child of the ash, a woman whose brother died
stopping the last fire — a walled flat of ash and glass with a piercing
glass-ash wraith, four stamped places (the Glazed Cairn, the Cinder Watch,
the Sand Mine, the Charcoal Run), and the Choir of Ash on the ridge: rested
with the prior's confession and the Keeper's suppressed verse together,
bargained with the chapel's bell or the confession made public, or burned a
fifth time with Ironbound cinder-oil — after which it sings louder, and
Marrowgate's Preceptor-General admits as much. Six quests, eleven epilogue
lines, three Marrowgate echoes, ten companion remarks; the hollow tallies
run to seven.

**The company** (after the third playtest round): companions can be hurt —
an enemy's blows rotate between the player and the companions standing with
them, in join order and with no die involved, so replays hold; a companion
struck to nothing falls back out of the fight and gets up at half strength
once it is over, and remembers the fall. The four talk among themselves:
thirty paired exchanges fire when both are present — entering a hold
together, a hollow's fate they disagree on, each road into Marrowgate, the
Hollow Throne, one of them having gone down, one high and one low in regard —
and twelve pair epilogue lines tell what became of two of them together or at
odds. Owned things (the `owner` field) let the world notice theft: 31 owned
items across eleven settlements, 29 owner reactions, the Watch and Quill on a
habit of it, and the company thinking less of a thief.

**Second visits** (after the fourth playtest round): every hold has an
aftermath once its hollow's fate is settled, flagged `sv_<hold>_*` and
started silently from the settlement's own `onEnter`. Each fate gets its own
beat with a fork: the rested hold's thanks with a price (the Hundred's names
on Cinderhall's Marker Stone, a netmender's boy the bell's rite never
covered, a barrow-widow's ordinary mound, the officer's name on Thornwold's
memorial stone, Highward's freed oath-ground, a drowned husband's rest, the
Choir's silence and the chapel's glass), the bargain come due (a toll to
Marrowgate, a tithe to the water, a vigil over the Hundred, the queen's mound
for sale, the wreck-right tithe, the Watch's patrols outrunning the ledger,
Prior Wenlock answering to the mother-house — each payable yourself, kept by
the hold at its own cost, or let lapse with `<hold>_bargain_broken`), and the
burned hold's grievance (a new rope on the old tree, nets over the burned
nave, peat cut from the oath-ground, a plaque for Aldous against the
Hundred's names, fire-freed grave-goods at the chandler's counter, wreckers
diving the Pride, Neave leaving the ash). Twenty-one vignettes, 81 topics,
seven `<hold>_q_after` quests, 24 room variants, 59 epilogue lines, one new
npc; every branch is read back in its hold's epilogue, 21 companion remarks
read them on the road (a broken bargain costs regard with the companion whose
line it crosses), and five Marrowgate topics — Archivist Penn on the Marker
Stone, Mother Ysme on Wenlock's answer, Quill on Gullhaven's tithe, the
Preceptor-General on the Choir's bell made whole, the first Reeve's shade on
every bargain a hold let lapse — carry the word to the capital.

**The company at odds** (after the fourth playtest round): once per pair,
the companions disagree hard enough that the player has to take a side. Lys
and Osk over a mercy refused (the drowned boy denied his name), Osk and
Tamsin over a second hollow burned or the Choir of Ash, Lys and Tamsin over
the Company's hanging tree turned harsh again, Osk and Vell over a Church
confession forced into the open, Tamsin and Vell over Highward's founding
lie, Lys and Vell over a Keeper's bargain a hold let lapse. A pair remark
opens the quarrel and sets `quarrel_<a>_<b>`; each of the two offers a topic
to take their side (+2 regard with them, −2 with the other), and one offers a
will check to make them settle it themselves (peace at no cost, or −1 each
when it sours); the loser of a quarrel walks at regard −2 with a farewell of
their own; follow-up remarks carry the grudge into Marrowgate and to the
throne, an Osk who won his quarrel will not speak a rite beside a third fire,
and a Tamsin who won hers promises to stand between the Company's rope and
Lys's brother; 24 epilogue lines tell how each quarrel ended. Thirty remarks,
eighteen topics, twelve leaves; none can fire on the walkthrough, which
travels with Lys alone. Two more quarrels wait on the first road, where every
party walks: Osk and Tamsin over the Vale's barrow doors (sealed or left open
— whichever lost the argument raises it), Lys and Vell over the Hollow King's
crown kept or the king slain (a crown given back satisfies them both); the
same three ways to settle them, and no leaving over the first argument of the
road. Each companion's ending lines about their own grief are mutually
exclusive — forgiven, avenged, truth known and unresolved, never went —
whatever order things happened in.

**Origins** (after the fourth playtest round): the four classes were numbers
only — six class-gated lines in the whole realm. Now each is a role the world
sees: 160 class-gated actions and topics across the ten regions and the
seven shared templates, about two per class per region, gated `["class", id]`
and flagged `or_<class>_<hold>_<what>`, each read back in a variant, a later
topic, a quest, a faction's standing or an epilogue line (81 of them), and the
engine tags every such line "(as a Scholar)" in its hint. Wardens get
sergeants' frankness, orders that open barracks doors without a roll, a tower
watcher's stair for the old watch's answer, the Marshal's escort token and the
Preceptor-General's oil on bearing alone — and a cold shoulder, and a point
lost, wherever the Companies rule. Scouts get free looks that find caches,
cellars, a false-bottomed skiff and smugglers' marks, easier lines past a den
or a camp once the spoor is read or the sentries counted, and professional
courtesy from poachers, fences and runners. Scholars read tallies, charts,
ledgers, lintels and sills outright, argue with priests, keepers and the
archivist as peers, and carry Canoness Fane's name from Emberfall to Mother
Ysme. Envoys broker third branches on existing forks — a truce between
Cinderhall's hall and chapterhouse, the Ironbound stood down at Fenmarch, a
toll agreed between Gullhaven's harbourmaster and its sergeant, the Regent's
oil on terms that cost the company nothing — talk prices down, pay a camp's
toll in a promise the captain holds them to, and meet plain folk who do not
trust the smooth talk. Class lines are extra, never the only way: every gate
keeps its force, craft and words routes for everyone.

**The Fallows** (the eleventh region, `fl`): east of Hollowbrook's south
dike, the hold the gray already took — emptied in the Winter of Lying Down
forty years ago, when its people lost the will to stay and lay down in their
own fields, and the few left standing buried the rest in one long furrow.
Wickstead, the crossroads village around the last standing chapel, holds the
emptied hold's grandchildren come back for the land and the people who came
after them: Old Ede, who was a girl that winter and remembers every name;
Surveyor Pell, staking the Crown's escheat; Recruiter Dace, drilling the
desperate for the Companies in an empty barn; Sister Merrow, the Church's
uninvited rite-giver; Frey, a Keeper who will not say so; Lay-brother Cobb
with a cart of cinder-oil; Rue Aldern's trade counter; Dain, whose father
lies in the furrow. A 6×6 walled wilderness of emptied hamlets, a market
cross with no market and a mill with its wheel still carries four stamped
places (Longacre Chapel, the Forebarrow, the Picker's Hut, the Sump Camp)
and leads to the Long Furrow. Rested with every name — Ede's memory, the
parish roll, the headland's markers — and Frey's verse and Merrow's rite
together; bargained with a vow that the land stays the dead's (no stakes, no
muster — declaring it for the Crown or the Companies afterwards breaks the
bargain); or burned with Cobb's oil, after which the surveyor calls the ash
farmland. The land question is the region's own fork, wanted by all six
factions: the Crown's stakes, the Companies' muster, the returners, or
fallow for the dead. Eight quests (the names for the rite, the boy at the
row, the surveyor's stakes, the muster in the barn, the woman who won't
leave, the land, the furrow, the aftermath), 53 rooms, 13 npcs, 80 topics,
14 epilogue lines, a class moment for each class, all four companions with
lines on entering and at the furrow; the act recap counts eight holds and
the tallies run to eight.

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
