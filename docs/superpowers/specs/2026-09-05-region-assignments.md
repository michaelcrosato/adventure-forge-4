# Region assignments

One author per region, each writing against `docs/region-brief.md`. The
gateway ids are fixed; the neighbor's gateway must exist (or be stubbed in
`world/reach/zz_stubs.json`) for the realm to validate.

## th — Thornwold (`th_thornwold.json`)

- **Settlement:** Camp Gallows, the Free Company's camp under a hanging tree
  — palisade gate, the muster ground, the captain's tent, the quartermaster's
  wagon (trade), the cook-fire (rest). Not a town: soldiers for hire who
  answer to Captain Sorrel Vane and to coin.
- **Gateways:** `th_east_edge` → `va_west_road` (exit `east`);
  `th_north_track` → `ir_south_track` (exit `north`); `th_south_track` →
  `sk_north_track` (exit `south`).
- **Wilderness:** deep old forest — holloways, a charcoal-burners' clearing,
  a gallows oak, a river ford. Encounter: a gray boar.
- **The hollow — the Hanged Company:** forty years ago a company hired by
  Marrowgate was hanged in the Thornwold for a mutiny they say they did not
  commit; they hang there still, gray, and the wood around the gallows-glade
  will not grow. Rest them (a verse the Understory keeps, or a formal pardon
  read aloud — words); bargain (the living Company swears their oath in the
  dead men's names — a will check, and the Company becomes yours); burn (the
  Ironbound's oil and a torch — force; the Free Company will not forgive it).
- **Factions present:** the Free Companies (home); the Barrow-Keepers hide in
  **the Understory**, a hidden hollow-tree enclave reachable by a found path
  (a grace or wits check, or a Keeper's token from the Vale) — they teach the
  old rite, raise `rep_keepers`, and sell nothing.
- **Companion hook (Lys):** her brother, **Cal**, rides with the Company. Set
  `lys_brother_found` when the player meets him at the camp; `lys_brother_home`
  if he is persuaded to go home to the Vale (will, or paying his debt to the
  quartermaster); `lys_brother_buried` if he dies (he is in the glade when it
  burns, or he fights for the captain); `lys_brother_lost` if the player burns
  the hollow with the Company present and Lys is in the party.
- **Free passage:** the captain sells the smugglers' road under Coldpass
  (`free_passage`) for gold or a favour, only if `rep_free >= 1`.

## fd — Fenmarch (`fd_fenmarch.json`)

- **Settlement:** Reedholm, stilt-houses over black water — the landing, the
  net-hall (rest), the eel-market (trade), the Priory of the Gray Church
  (mother-house; Prior Halm), the drying racks.
- **Gateways:** `fd_causeway_west` → `va_causeway` (exit `west`);
  `fd_north_dike` → `hb_south_dike` (exit `north`); `fd_coast_road` →
  `sk_coast_road` (exit `south`).
- **Wilderness:** fen — reed-beds, eel-traps, a sunk fence, herons that do not
  move, a flooded orchard. Encounter: a bog-thing.
- **The hollow — the Drowned Congregation:** the old nave sank with the
  congregation inside during a flood the Priory prayed against instead of
  fleeing; they sing under the water at dusk. Rest them (the saint's bell rung
  over the water — craft to raise it, or words to have the Prior admit the
  Priory's fault); bargain (a yearly tithe of the eel-catch promised to the
  water — will); burn (pitch on the water and fire — force; the Church will
  remember).
- **Factions present:** the Gray Church (home); the Ironbound have a small
  mission of two zealots who want the nave burned.
- **Companion hook (Osk):** his family are among the drowned. Set
  `osk_family_found` when the player reaches the nave; `osk_family_rested` if
  the hollow is rested or bargained; `osk_family_burned` if burned.

## wm — Wardmoor (`wm_wardmoor.json`)

- **Settlement:** Highward, the Watch's fortress-town — the south gate, the
  parade, the barracks (rest), the armoury (trade: shields, mail), the
  Captain-General's hall, the record-house.
- **Gateways:** `wm_south_gate` → `va_north_road` (exit `south`; gated
  `["flag","act2_open"]` with lockedMsg about blighted holds);
  `wm_west_road` → `ir_east_road` (exit `west`); `wm_east_road` →
  `hb_west_road` (exit `east`); `wm_north_road` → `cp_south_stair` (exit
  `north`).
- **Wilderness:** high moor — cairns, a beacon hill, peat cuttings, a
  drovers' road, a ruined signal tower. Encounter: moor-wights in a mist.
- **The hollow — the Founding:** the Watch was founded by the first Reeve's
  men, who guarded the road while he carried the crown out of the Vale; their
  oath-stone on the moor holds them still, gray, guarding nothing. Rest them
  (read the true founding from the record-house aloud at the stone — wits, or
  words with the Captain-General to unseal the record); bargain (the Watch
  swears a new oath — the Captain-General's will check, `rep_watch` needed);
  burn (the Ironbound way; the Watch splits over it).
- **Factions present:** the Watch (home); the Crown's envoy sits in the hall
  and offers the **commission** (`regent_writ`) to anyone who burns a hollow
  or serves the Watch twice (`rep_watch >= 2`).
- **Companion hooks:** Tamsin approves of the Watch's plain dealing; Vell
  fears the record-house (it names the exile line — a remark, no flag).

## ir — The Iron Downs (`ir_irondowns.json`)

- **Settlement:** Cinderhall, a mining town under a slag hill — the tally
  gate, the miners' hall (rest), the company store (trade), the Ironbound
  chapterhouse (Preceptor Aldous), the head-frame.
- **Gateways:** `ir_east_road` → `wm_west_road` (exit `east`);
  `ir_south_track` → `th_north_track` (exit `south`).
- **Wilderness:** bare downs — spoil heaps, a flooded quarry, adits, a
  gibbet, a chapel of iron. Encounter: a slag-hound.
- **The hollow — the Hundred:** a hundred miners died when the Hundred
  Gallery came down; the company said the timbering failed, and the foreman
  who signed off on it became Preceptor of the Ironbound. They walk the
  gallery still. Rest them (the true ledger read at the face — craft to reach
  it, or words to make the Preceptor confess); bargain (the miners' hall
  takes the mine from the company — will and `rep_free` or `rep_watch`);
  burn (the Ironbound's oil — force; Tamsin's line).
- **Factions present:** the Ironbound (home): they teach fire, sell armor,
  and after two burned hollows (`hollows_burned >= 2`) write the Regent's
  writ (`regent_writ`).
- **Companion hook (Tamsin):** her mother was one of the Hundred. Set
  `tamsin_mine_truth` when the ledger is found or the confession heard;
  `tamsin_mine_avenged` if the Preceptor dies or is ruined; `tamsin_mine_forgiven`
  if the player lets him live after the truth and the hollow is rested;
  `ir_miners_sold` if the player takes the company's gold to keep the ledger
  buried.

## hb — Hollowbrook (`hb_hollowbrook.json`)

- **Settlement:** Barrowmere, a village among a hundred mounds by a mere —
  the mere-shore, the tithe barn (rest), the mound-warden's house, the
  chandler (trade), the ruined Keepers' Hall.
- **Gateways:** `hb_west_road` → `wm_east_road` (exit `west`);
  `hb_south_dike` → `fd_north_dike` (exit `south`).
- **Wilderness:** barrow downs — mounds by the dozen, a ring-ditch, a
  processional way, a mere. Encounter: a barrow-wight.
- **The hollow — the Kings' Rest:** the dynasty before the Hollow King lies
  here under the great mound; the first Reeve's men robbed it too, and the
  old kings sit up at night. Rest them (the Keeper's rite — three verses of
  their own found in the downs; or the Keeper's Key from the Hall); bargain
  (return one grave-good the chandler is selling — craft or gold); burn (the
  Ironbound way — the mounds collapse).
- **Factions present:** the Barrow-Keepers' ruined Hall (the last written
  rites, the **Keeper's Key** that opens the pilgrim stair at Coldpass when
  `hollows_rested >= 3`); a Crown surveyor mapping mounds to sell.
- **Companion hook (Vell):** the Hall's ledger names the exile line. Set
  `vell_ledger_found` when it is found. Vell reacts through
  `companions.json`.

## sk — The Saltkerns (`sk_saltkerns.json`)

- **Settlement:** Gullhaven, a fishing town on a wreck-choked bay — the quay,
  the Drowned Bell tavern (rest), the chandlery (trade), the harbourmaster's
  house, the smugglers' stair.
- **Gateways:** `sk_north_track` → `th_south_track` (exit `north`);
  `sk_coast_road` → `fd_coast_road` (exit `east`); `sk_smugglers_stair` →
  `cp_smugglers_cave` (exit `up`, gated `["flag","free_passage"]`, lockedMsg
  naming the Free Company).
- **Wilderness:** salt marsh and cliff — kern huts, salt pans, a wreck on the
  sands, sea caves, the lighthouse on the point. Encounter: wreckers.
- **The hollow — the Lost Fleet:** the Reeve's fleet sailed against the
  Saltkern free-towns and broke on the reef the lighthouse should have warned
  them off; the keeper had been paid to leave it dark. The drowned crews row
  in every fog. Rest them (light the lighthouse and say the sailors' verse —
  craft to climb, words to learn the verse from the harbourmaster's widow);
  bargain (the town admits the keeper's bribe and pays the wreck-right —
  will); burn (fire-ships on the fog — force).
- **Factions present:** the Free Companies' coast (the harbourmaster is one);
  the Watch has a customs post.
- **Companion hooks:** Lys's brother may have passed through (a rumour, no
  flag); Osk knows the sailors' verse if `appr_osk >= 1` (a topic option you
  gate on `inParty` and approval, giving the words route a second door).

## cp — Coldpass (`cp_coldpass.json`)

- **Settlement:** St. Ashwyn's Perch, a monastery on the pass — the
  pilgrims' hall (rest), the scriptorium, the bell-tower, the pass gate.
- **Gateways:** `cp_south_stair` → `wm_north_road` (exit `south`);
  `cp_smugglers_cave` → `sk_smugglers_stair` (exit `down`); `cp_pass` →
  `mg_south_gate` (exit `north`, gated on ANY of `hollows_rested >= 3`,
  `regent_writ`, `free_passage` — three separate gated exits/actions with
  their own lockedMsgs, or one action with an `if` chain).
- **Wilderness:** the Spine — scree, a frozen tarn, a pilgrim's shrine, an
  avalanche field. Encounter: the cold itself (a chance of −1 hp in the high
  cells).
- **No hollow of its own:** Coldpass's frozen pilgrims are a stamp (chapel or
  barrow), not an act-2 node. Its job is the gate: three doors into
  Marrowgate, each remembered by the city (set `cp_came_by_stair`,
  `cp_came_by_writ`, `cp_came_by_cave`).

## mg — Marrowgate (`mg_marrowgate.json`, written last, by the lead)

The capital and act 3: the south gate, the Lower Town, the Regent's Way, the
palace, the undercity, the Hollow Throne. Endings and proofs live here and in
the root.
