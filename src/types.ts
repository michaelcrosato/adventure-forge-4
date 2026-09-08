/**
 * tinyforge types — the whole content + state contract in one file.
 *
 * Content is DATA (world/*.json), never code. The DSL is closed: the ops below
 * are all there are, and the validator whitelists them.
 */

// ---------- conditions ----------
export type Cond =
  | ["has", string] // item in inventory
  | ["!has", string]
  | ["flag", string]
  | ["!flag", string]
  | ["npcDead", string]
  | ["!npcDead", string]
  | ["var", string, "<" | ">" | "=" | ">=" | "<=", number]
  | ["class", string] // player picked this class
  | ["!class", string]
  | ["perk", string] // player owns this perk
  | ["!perk", string]
  | ["inParty", string] // npc travels with the player
  | ["!inParty", string]
  | ["npcHere", string] // npc stands alive in the player's room (a companion's warning before a fight, a line only said in someone's presence)
  | ["!npcHere", string]
  | ["cond", string] // the player currently holds this timed condition
  | ["!cond", string]
  | ["npccond", string, string] // an npc currently holds this timed condition
  | ["!npccond", string, string]
  | ["turn", "<" | ">" | "=" | ">=" | "<=", number] // the turn counter so far — deterministic state, read-only (never mirrored into vars, so content can't write it)
  | ["since", string, string, number] // turns since a flag was set: op/n as `var`. False while the flag is unset, so it never reads as "0 turns ago"
  // These five read the room or the player rather than naming an id. Each has
  // its negated twin, like every other op here — without them there was no way
  // to write "only when nothing in this room ignores armor".
  | ["horrorHere"] | ["!horrorHere"] // a hostile npc with `pierce: true` (the realm's horrors — see docs §7) stands alive in the player's room
  | ["holdsGround"] | ["!holdsGround"] // a hostile npc that is not aggressive stands alive in the player's room (the "leave ... be" category)
  | ["companionDown"] | ["!companionDown"] // a party member currently carries the `down_<id>` flag (struck out of a fight, not yet back up)
  | ["checkHere", string, number] | ["!checkHere", string, number] // a currently-visible room action or npc topic previews a `check` of this skill at dc >= n (see checkHere in engine.ts)
  | ["lowHp"] | ["!lowHp"] // the player's hp is at half or less of maxHp — the same "a fight is going badly" threshold the disengage gate uses
  | ["region", string] | ["!region", string] // the player stands in a room of this region (world.regions' code). A companion's line about a hold, said while you are in that hold.
  | ["any", Cond[]]; // passes when at least one of the listed conditions passes (the one OR in an all-of list)

// ---------- effects ----------
export type Fx =
  | ["say", string]
  | ["set", string] // set flag
  | ["clear", string]
  | ["score", number] // add (clamped 0..maxScore)
  | ["hp", number] // delta (clamped 0..maxHp); reaching 0 => the engine's "dead" lose ending
  | ["move", string, string] // item -> "inv" | "nowhere" | "here" (the player's room) | roomId
  | ["goto", string] // move player (fires room entry)
  | ["npcgo", string, string | null] // move npc to a roomId, "here" (the player's room), or null (removes)
  | ["if", Cond[], Fx[], Fx[]] // branch on conditions: thenFx if all pass, else elseFx
  | ["slay", string] // npc drops dead with no fight and no onDeath (a scripted death)
  | ["calm", string] // a hostile npc stands down for good: no longer blocks travel, no longer reads hostile, attack listed last
  | ["setvar", string, number]
  | ["addvar", string, number]
  | ["check", string, number, Fx[], Fx[]] // skill, dc, okFx, failFx (d20 + skill/attr/perk mods)
  | ["xp", number] // grant xp; levels apply themselves
  | ["perk", string] // grant a perk directly (a trainer teaches you)
  | ["chance", number, Fx[], Fx[]] // pct 0..100 from the state's PRNG: okFx if the roll lands, else failFx
  | ["party", string, "join" | "leave"] // npc joins the player's company (follows room to room, fights beside them) or leaves it
  | ["cond", string, number] // put a timed condition on the player for N spent turns; re-applying refreshes to the longer remaining duration
  | ["npccond", string, string, number] // same, on an npc: npc, conditionId, turns
  | ["uncond", string] // clear a timed condition from the player before it would expire on its own
  | ["unnpccond", string, string] // clear a timed condition from an npc: npc, conditionId
  | ["harm", string, number] // n damage to an npc with no attack roll; runs onDeath if it drops, like a killing attack. Safe if the npc is absent or already dead
  | ["harmhostile", number] // `harm` applied to every currently-hostile npc in the player's room (usually exactly one) instead of one named id
  | ["condhostile", string, number] // `npccond` applied to every currently-hostile npc in the player's room
  | ["calmhostile"] // `calm` applied to every currently-hostile npc in the player's room
  | ["bearings"] // say the way to this region's named places, nearest first, walked through the real exits (see bearingsHere) — replaces a hand-written direction, which a grid with walls makes a guess
  | ["revive"] // every party member currently down (flag `down_<id>`) gets back up now, at half strength — the same recovery recoverDowned grants once a fight clears, just not waiting for that
  | ["sayunvisited"] // names this room's region's landmarks not yet visited (or says there are none left) — for a free "what haven't I seen near here" ability
  | ["end", "win" | "lose", string, string]; // kind, endingId, text

// ---------- content ----------
export type ExitDef = {
  to: string;
  if?: Cond[]; // all must pass, else lockedMsg
  lockedMsg?: string;
  hint?: string; // short "what's missing" clue shown in the menu while locked, before a turn is wasted
  landmark?: string; // short destination preview shown in the menu once unlocked, e.g. "hunter's camp"
  sideTrip?: boolean; // optional content off the main path; exits line marks it unexplored until the destination is visited
};

export type CustomAction = {
  id: string;
  label: string; // shown verbatim in the menu
  if?: Cond[];
  once?: boolean; // auto-flag `did_<id>` and hide after
  free?: boolean; // costs no turn and says so in the menu: a flavour action that reads like `look` (getting your bearings)
  fx: Fx[];
};

/** A room's face under some condition: the first matching variant overrides name/desc/brief. */
export type RoomVariant = {
  if: Cond[];
  name?: string;
  desc?: string;
  brief?: string;
};

export type RoomDef = {
  name: string;
  desc: string; // full text, shown on first visit / look
  brief?: string; // shown on revisits (default: nothing)
  dark?: boolean; // without light: no desc/items/npcs/actions, only exits
  exits?: Record<string, ExitDef>; // key is the direction word ("north", "up", "in"...)
  onEnter?: Fx[]; // every entry
  onEnterOnce?: Fx[]; // first entry only
  actions?: CustomAction[];
  /** The world changes with the player's choices: a burned village, a rebuilt bridge. First match wins. */
  variants?: RoomVariant[];
  /** Region this room belongs to (a key of world.regions); groups fast-travel destinations. */
  region?: string;
  /**
   * A fast-travel node. Once visited, the room can be travelled to from any
   * other landmark room (with no aggressive npc present) by this short name.
   */
  landmark?: string;
  /** No fast travel departs from here: a scene to be walked out of (a throne room, a confrontation). */
  noTravel?: boolean;
};

export type UseDef = {
  target?: string; // item or npc that must be in the room or inventory
  if?: Cond[];
  fx: Fx[];
};

export type ItemDef = {
  name: string;
  loc: string; // roomId | "inv" | "nowhere"
  takeable?: boolean;
  light?: boolean; // lights dark rooms while flag `<itemId>_lit` is set
  hit?: number; // attack-roll bonus when carried (best weapon wins)
  dmg?: number; // damage when carried (best weapon wins; unarmed = 1)
  armor?: number; // reduces damage taken while carried (best armor wins)
  use?: UseDef[]; // first matching def runs; else "Nothing happens."
  owner?: string; // an npc: taking the item while they stand alive in the room is seen (flag `stole_<item>`, var `thefts`), and the menu warns
  hint?: string; // shown on pickup, and (for a `use`-able item) as a menu preview of what "use" does
  /** The hint while conditions hold (first match wins; an empty hint hides it) — a "show it to the hunter" goes quiet once shown. */
  variants?: { if: Cond[]; hint?: string }[];
};

export type TopicDef = {
  id: string;
  label: string; // menu shows "ask <npc>: <label>" (inline) or just "<label>" inside a conversation
  if?: Cond[];
  once?: boolean; // auto-flag `said_<npc>_<id>` and hide after
  say: string;
  fx?: Fx[];
  end?: boolean; // conversation mode only: this line closes the conversation
  commits?: boolean; // a line that commits you (an oath broken, a betrayal): listed late in the conversation, like one that parts ways
};

/**
 * A companion's one-line reaction. Checked after every turn, across the whole
 * party at once — at most one remark reaches the screen a turn, not one per
 * companion — for the first ready candidate (fx-carrying ones win the slot
 * over plain ones; a rotating start decides among ties), spoken once ever
 * (flag `remarked_<npc>_<id>`). This is how a companion notices where you are
 * and what you just chose.
 */
export type RemarkDef = {
  id: string;
  if?: Cond[];
  say: string;
  fx?: Fx[]; // runs when the remark is spoken: a companion who says what they think of a theft can also think less of you
};

export type CompanionDef = {
  hit?: number; // attack-roll bonus when fighting beside the player
  dmg?: number; // damage on a hit (default 1)
  remarks?: RemarkDef[];
  /**
   * When a companion walks out: checked after every turn while in the party;
   * the first entry whose conditions pass is spoken, the companion leaves the
   * party where they stand, and flag `<npc>_left` is set. Approval floors and
   * unforgivable deeds live here, once, instead of in every settlement.
   */
  leaves?: { if: Cond[]; say: string }[];
};

export type NpcDef = {
  name: string;
  room: string | null;
  desc?: string;
  hostile?: boolean; // display flavor only: shows "(hostile, hp)" in room text. Attackability comes from `hp`.
  aggressive?: boolean; // strikes the player at the end of every turn spent in its room (needs hp and atk) — leaving is the only way to stop it
  pierce?: boolean; // its strikes ignore armor (a wight's chill, a grip that finds the gap): the room says "armor useless"
  hp?: number;
  atk?: number; // damage dealt to the player per round while alive
  df?: number; // player must roll d20 + weapon hit >= df
  onDeath?: Fx[];
  topics?: TopicDef[];
  /**
   * Conversation mode: the room menu shows one "talk to <name>" entry instead
   * of every topic; picking it opens a menu of this npc's visible topics plus
   * "end conversation". Keeps room menus small for talkative npcs.
   */
  dialogue?: boolean;
  companion?: CompanionDef; // can travel in the player's party (see the "party" effect)
};

export type WalkStep = string | { repeat: string; until: Cond; max: number };

/**
 * Most actions a single menu may offer. The validator enforces it along the
 * walkthrough; the engine caps the perk-pick menu to it. Numbered replies stay
 * one or two tokens, and a blind player never has to scroll.
 */
export const MENU_CAP = 12;

// ---------- characters ----------
/** The four attributes. Plain names, plain meanings. */
export const ATTRS = ["might", "grace", "wits", "will"] as const;
export type AttrName = (typeof ATTRS)[number];

export type ClassDef = {
  name: string;
  desc: string; // one short line; shown in the class menu
  attrs?: Partial<Record<AttrName, number>>; // modifiers
  hp?: number; // bonus max hp at start
  items?: string[]; // starting items (moved to inventory)
  perks?: string[]; // starting perks
};

export type PerkDef = {
  name: string;
  desc: string; // one short line; shown in the perk menu
  require?: {
    level?: number; // minimum level
    class?: string[]; // allowed classes
    attr?: [AttrName, number]; // minimum attribute
  };
  bonus?: {
    check?: Partial<Record<string, number>>; // +N to checks by name
    hit?: number;
    dmg?: number;
    armor?: number;
    maxhp?: number;
  };
};

/**
 * A named, timed status effect — put on the player with `["cond", id, turns]`
 * or on an npc with `["npccond", npc, id, turns]`. Small and closed: every
 * field but `name` is optional, and the validator rejects any other key.
 * Player conditions fold into attackBonus/combatMods/armorOf/checkMod; an
 * npc condition's `hit` folds into its strike and `armor` raises its df.
 */
export type ConditionDef = {
  name: string; // shown wherever the condition is listed (HUD, room line, status)
  hit?: number; // attack-roll modifier
  dmg?: number; // damage modifier
  armor?: number; // armor modifier (raises an npc's df; adds to the player's armor)
  checks?: Partial<Record<string, number>>; // +N to named checks (player only — npcs don't roll checks)
  hpPerTurn?: number; // hp applied at the end of each spent turn while it holds; negative hurts, positive heals (player only)
  hint?: string; // short clause the menu/HUD/status may show, e.g. "your guard is down"
};

/**
 * One scheduled effect in `world.clock` — the realm's own turn. Checked in
 * file order once per spent turn; the first entry whose `if` passes (and,
 * for a `once` entry, has not already fired) runs its `fx`, and the rest
 * wait for a later turn. At most one entry fires per turn — see World.clock.
 */
export type ClockEntry = {
  id: string; // unique; a `once` entry sets flag `clocked_<id>` the turn it fires
  if?: Cond[]; // all must pass; default always
  once?: boolean; // fires at most once ever (auto-flag `clocked_<id>`); omitted, it may fire again on any later turn its `if` still holds
  fx: Fx[]; // ordinary effects, run through the same applyFx as everything else — no new effect vocabulary
};

/**
 * An action available generally, not tied to any one room — a class's active
 * ability. Shaped like `CustomAction` minus the room: merged by id, like
 * `perks`/`conditions`. `context: "combat"` offers it only while a live
 * hostile stands in the player's room (the same test `attack` uses); `"any"`
 * (the default) offers it wherever its `if` holds. Abilities are listed after
 * a room's own actions, so a room's content always reads first.
 */
export type AbilityDef = {
  label: string; // shown verbatim in the menu
  if?: Cond[];
  context?: "combat" | "any"; // default "any"
  once?: boolean; // auto-flag `did_<id>` and hide after
  free?: boolean; // costs no turn and says so in the menu
  fx: Fx[];
};

// ---------- overworld generation ----------
export type GenSpot = {
  cell: [number, number];
  name?: string; // override the generated room name
  desc?: string;
  brief?: string; // shown on revisits; a named spot should usually set this too
  landmark?: string; // make this cell a fast-travel destination
  items?: string[]; // item ids placed here (their loc is rewritten)
  npcs?: string[]; // npc ids placed here (their room is rewritten)
  onEnterOnce?: Fx[];
  onEnter?: Fx[];
  actions?: CustomAction[];
  variants?: RoomVariant[];
};

/** A coherent name/desc/brief triple for one wilderness cell, drawn without replacement. */
export type GenScene = { name?: string; desc: string; brief?: string };

export type GenDef = {
  id: string; // room ids become `${id}_${x}_${y}`
  name: string; // region display name, used in room names
  seed: number; // all generated text/structure flows from this
  w: number;
  h: number;
  region?: string; // every cell joins this region (see world.regions)
  /**
   * Text is data, drawn by seeded PRNG. `scenes` are used first, each once, so
   * a cell's name, description, and brief agree; `descs`/`briefs`/`names` fill
   * whatever cells remain (names without replacement too, then "Name x,y").
   */
  pools: { descs: string[]; briefs?: string[]; names?: string[]; scenes?: GenScene[] };
  links: { cell: [number, number]; dir: string; to: string; back?: string; landmark?: string; sideTrip?: boolean }[];
  spots?: GenSpot[];
  /** Cells that are not made at all — cliffs, water, the shape of the land. Neighbors get no exit toward them. */
  walls?: [number, number][];
  /** Effects every generated cell carries — the place for a region's random encounters (`chance`). */
  cellFx?: { onEnter?: Fx[]; onEnterOnce?: Fx[] };
};

// ---------- templates and stamps ----------
/**
 * A reusable place — a bandit cave, a shrine, a mine — written once with
 * `$name` placeholders for every id it owns (rooms, items, npcs, flags, vars)
 * and `{{VAR}}` placeholders for text that changes per copy. Each stamp of it
 * expands into real rooms with the placeholders replaced (`$hall` in stamp
 * `cave1` becomes `cave1_hall`), wired into a host room, and validated exactly
 * like authored content.
 */
export type TemplateDef = {
  entrance: string; // the template room (`$hall`) the host room's exit leads into
  rooms: Record<string, RoomDef>;
  items?: Record<string, ItemDef>;
  npcs?: Record<string, NpcDef>;
  vars?: string[]; // the {{VAR}} names every stamp must supply
};

export type StampDef = {
  template: string;
  id: string; // instance prefix: `$x` -> `${id}_x`
  at: string; // host room id (authored, or a generated cell like `wood_2_1`)
  dir: string; // exit direction on the host that leads in
  back?: string; // exit direction on the entrance that leads back out
  if?: Cond[]; // gate on the host's exit
  lockedMsg?: string;
  hint?: string;
  landmark?: string; // destination preview on the host's exit
  entranceLandmark?: string; // make the copy's entrance room a fast-travel landmark by this name
  sideTrip?: boolean;
  vars?: Record<string, string>;
};

/**
 * A journal entry. Active once `start` passes (default: from the beginning)
 * and until `done` or `failed` does; the first matching stage is the line the
 * player reads. A change in that line prints a "Quest" event the turn it
 * happens, so a player who never calls `status` still sees the journal move.
 */
export type QuestDef = {
  name: string;
  /** A quest of the road itself: `status` lists it first, apart from the side threads. */
  main?: boolean;
  start?: Cond[];
  done?: Cond[];
  failed?: Cond[];
  /**
   * `at` is the room this stage points the player at. Written once, it replaces
   * a hand-authored direction: the free status check walks the real exits to it
   * and prints the legs (see `pathTo` / `renderStatus`).
   *
   * The realm carried 315 hand-written bearing strings — "Slatefold is 4 south
   * and 1 east, then down" — and two playtest waves reported them not matching
   * the map, because a wilderness grid has walls and a hop count is not a
   * route. A room id cannot be wrong about the way there.
   */
  stages: { if: Cond[]; text: string; at?: string }[];
};

/** Most epilogue lines appended to an ending; the rest stay untold. */
export const EPILOGUE_CAP = 6;
/** Most characters of epilogue an ending carries — the ending screen has to fit the token budget with its own text. */
export const EPILOGUE_CHARS = 600;

export type World = {
  id: string;
  title: string;
  intro: string;
  /** Short recap of active goals for the free `status` check (any time, no turn cost). Falls back to `intro` if absent. */
  objectives?: string | { if: Cond[]; text: string }[]; // staged: first entry whose conditions hold (most advanced first)
  start: string;
  hp: number;
  maxScore: number;
  skills?: Record<string, number>; // name -> modifier for ["check", ...]
  classes?: Record<string, ClassDef>; // if present, the game starts with a class menu
  perks?: Record<string, PerkDef>;
  /** Named timed status effects (see ConditionDef) — put on the player or an npc by id, merged like perks. */
  conditions?: Record<string, ConditionDef>;
  /**
   * Actions available generally, not tied to a room (see AbilityDef) — a
   * class's active abilities, keyed by id like perks. Root-only, unlike
   * `perks`/`conditions`: a part file declaring `abilities` is a load error,
   * so every class's kit lives in one place.
   */
  abilities?: Record<string, AbilityDef>;
  /**
   * Full values for the vars an ability spends (`res_warden`, `res_scout`, …).
   * Root-only, like `walkthrough`. A room action that heals the party (the
   * "rest" a hearth or a bunk grants — see step()'s `custom` case) refreshes
   * every entry here to its full value; `newState` starts a fresh game full.
   * Refreshing means "set to full", not "add".
   */
  resources?: Record<string, number>;
  /** Part files merged into this one at load (paths or `dir/*.json` globs, relative to this file). Root-only fields stay in the root. */
  include?: string[];
  gen?: GenDef[]; // regions expanded into rooms at load, before validation
  templates?: Record<string, TemplateDef>; // reusable places, expanded per stamp
  stamps?: StampDef[]; // where each copy of a template stands
  rooms: Record<string, RoomDef>;
  items: Record<string, ItemDef>;
  npcs: Record<string, NpcDef>;
  /** Named regions that group fast-travel destinations (rooms point at them via `region`). */
  regions?: Record<string, { name: string }>;
  /** The journal, shown by the free `status` check; stage changes also print as events. */
  quests?: Record<string, QuestDef>;
  /**
   * Lines appended to any ending whose conditions pass: how the world remembers
   * your choices. At most EPILOGUE_CAP print — the heaviest `weight` first
   * (default 0), ties in file order — and the survivors read in file order.
   */
  epilogue?: { if: Cond[]; text: string; weight?: number }[];
  /**
   * The realm's own turn: scheduled effects evaluated once per **spent**
   * turn, after the player's action, the world's aggressive pass, and
   * conditions have ticked. Checked in file order; the first entry whose
   * `if` passes (and is not already spent) fires and the rest wait for a
   * later turn — at most one entry fires per turn, which is what keeps a
   * turn's clock line to at most one sentence, never a digest. Root-only,
   * like `walkthrough` — a part file carrying it is a load error.
   */
  clock?: ClockEntry[];
  /** Extra counters shown compactly in the per-turn status line (e.g. gold). */
  hud?: { var: string; label: string }[];
  /** Reputation vars by display name (e.g. rep_church -> "the Gray Church"): a change to one prints "(the Gray Church -1)" the turn it happens. */
  factions?: Record<string, string>;
  /** Optional persistent counter shown in the status line every turn (e.g. quest items gathered). */
  progress?: { var: string; label: string; max: number };
  /** Optional extra counters for the free `status` check (any time, no turn cost) — e.g. multiple parallel paths to an ending. Not shown on the per-turn line. */
  statusTracks?: {
    var: string;
    label: string;
    max: number;
    /** Optional flag -> location label breakdown; unset flags list as still-unexplored in the `status` recap. */
    remaining?: { flag: string; label: string }[];
    /** Shown only while every condition holds (a hold's tracker waits until the hold is reached). */
    if?: Cond[];
  }[];
  /** Optional faction/path indicators for the free `status` check — which branch of a choice currently applies (e.g. sealed vs open). States are checked top-to-bottom; the first one whose conditions all pass wins, else `fallback`. */
  statusPaths?: {
    label: string;
    states: { if: Cond[]; text: string }[];
    fallback?: string;
    /** A var whose value is shown after the text, e.g. "the Watch: neither friend nor foe (+1)". */
    var?: string;
    /** Shown only while every condition holds. */
    if?: Cond[];
  }[];
  /** Authored proof: must reach a win ending with score === maxScore (validator replays it). */
  walkthrough: WalkStep[];
  /**
   * Ending proofs: each must replay (seed 1) to a game ended with exactly that
   * ending id. The key is the ending id, optionally followed by "#" and a label
   * naming this particular witness — `"regent_deposed#warden"` is a second
   * proof of the same ending by a different road, and an ending may carry as
   * many as anyone can write.
   */
  proofs?: Record<string, WalkStep[]>;
};

// ---------- runtime ----------
export type Action =
  | { kind: "go"; dir: string }
  | { kind: "take"; item: string }
  | { kind: "use"; item: string; target?: string }
  | { kind: "talk"; npc: string; topic: string }
  | { kind: "attack"; npc: string }
  | { kind: "custom"; room: string; id: string }
  | { kind: "ability"; id: string } // a class ability from world.abilities — not tied to any room
  | { kind: "classpick"; id: string } // choose who you are (first menu when a world has classes)
  | { kind: "perkpick"; id: string } // choose a perk after a level-up
  | { kind: "talkto"; npc: string }
  | { kind: "leave"; npc: string } // give a hostile that holds its ground a wide berth: free, sets left_<npc> // open a conversation with a `dialogue` npc
  | { kind: "endtalk" } // close the open conversation
  | { kind: "travel" } // open the fast-travel menu (from a landmark room)
  | { kind: "travelregion"; region: string } // narrow the travel menu to one region
  | { kind: "travelto"; room: string } // go to a discovered landmark
  | { kind: "traveldone" } // close the travel menu (or step back out of a region)
  | { kind: "company" } // open the list of companions to speak with (two or more travelling with you)
  | { kind: "companydone" } // close that list
  | { kind: "talkmore" } // turn to the next page of a long conversation (free)
  | { kind: "roommore" } // turn to the next page of a room with more to do than the menu holds (free)
  | { kind: "travelmore" }; // turn to the next page of a long travel list (free)

export type Ending = { kind: "win" | "lose"; id: string; text: string };

/** Plain JSON, deep-cloneable, canonically hashable. */
export type State = {
  seed: number;
  rngA: number; // PRNG cursor
  turn: number;
  room: string;
  hp: number;
  maxHp: number; // grows with class and levels
  score: number;
  classId: string | null; // null until picked (or forever, in a classless world)
  attrs: Record<string, number>;
  perks: string[];
  xp: number;
  level: number;
  perkPicks: number; // pending perk choices from level-ups
  inv: string[];
  flags: Record<string, true>;
  vars: Record<string, number>;
  itemLoc: Record<string, string>;
  npcHp: Record<string, number>;
  npcRoom: Record<string, string | null>;
  conds: Record<string, number>; // condition id -> spent turns remaining, on the player
  npcConds: Record<string, Record<string, number>>; // npc id -> (condition id -> turns remaining)
  /**
   * Escalating retry: check source id (see engine.ts's checkSourceId) -> prior
   * FAILED attempts recorded against it, never reset by a success. Each entry
   * present is >0; a source never yet failed carries no key at all. Read by
   * applyFx's `check` case and oddsHint to raise that same check's DC by one
   * per failure already logged — see docs/authoring.md §4.
   */
  checkAttempts: Record<string, number>;
  /**
   * The turn each flag was first set, for `["since", flag, op, n]` (§3) — "N
   * turns after this happened", which nothing in the DSL could express: `turn`
   * reads the absolute counter and `setvar` takes a literal, so content had no
   * way to record "now". Internal `_`-prefixed markers are not recorded.
   */
  flagTurn: Record<string, number>;
  visited: string[];
  party: string[]; // companions travelling with the player, in join order
  talking: string | null; // npc id while a conversation is open (conversation mode)
  travelMenu: string | null; // null: closed; "": destinations (or regions) listed; a region id: that region's destinations
  companyMenu: boolean; // the list of companions to speak with is open (browsing, no turn spent)
  talkPage: number; // which page of a long conversation's topics is showing (0 unless it runs past the menu cap)
  roomPage: number; // which page of a crowded room's own options is showing (0 unless it runs past the menu cap; reset on entering a room)
  travelPage: number; // which page of a long travel list (regions, or one region's places) is showing
  ended: Ending | null;
};

export type StepOut = { state: State; events: string[] };

export type Trace = {
  world: string;
  seed: number;
  actions: Action[];
  receipt?: string;
};
