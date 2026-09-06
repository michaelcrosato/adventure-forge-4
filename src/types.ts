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
  | ["setvar", string, number]
  | ["addvar", string, number]
  | ["check", string, number, Fx[], Fx[]] // skill, dc, okFx, failFx (d20 + skill/attr/perk mods)
  | ["xp", number] // grant xp; levels apply themselves
  | ["perk", string] // grant a perk directly (a trainer teaches you)
  | ["chance", number, Fx[], Fx[]] // pct 0..100 from the state's PRNG: okFx if the roll lands, else failFx
  | ["party", string, "join" | "leave"] // npc joins the player's company (follows room to room, fights beside them) or leaves it
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
};

/**
 * A companion's one-line reaction. Checked after every turn for each party
 * member; the first remark whose conditions pass is spoken, once ever
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
  stages: { if: Cond[]; text: string }[];
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
  /** Ending proofs: each must replay (seed 1) to a game ended with exactly that ending id. */
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
  | { kind: "classpick"; id: string } // choose who you are (first menu when a world has classes)
  | { kind: "perkpick"; id: string } // choose a perk after a level-up
  | { kind: "talkto"; npc: string } // open a conversation with a `dialogue` npc
  | { kind: "endtalk" } // close the open conversation
  | { kind: "travel" } // open the fast-travel menu (from a landmark room)
  | { kind: "travelregion"; region: string } // narrow the travel menu to one region
  | { kind: "travelto"; room: string } // go to a discovered landmark
  | { kind: "traveldone" } // close the travel menu (or step back out of a region)
  | { kind: "company" } // open the list of companions to speak with (two or more travelling with you)
  | { kind: "companydone" } // close that list
  | { kind: "talkmore" }; // turn to the next page of a long conversation (free)

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
  visited: string[];
  party: string[]; // companions travelling with the player, in join order
  talking: string | null; // npc id while a conversation is open (conversation mode)
  travelMenu: string | null; // null: closed; "": destinations (or regions) listed; a region id: that region's destinations
  companyMenu: boolean; // the list of companions to speak with is open (browsing, no turn spent)
  talkPage: number; // which page of a long conversation's topics is showing (0 unless it runs past the menu cap)
  ended: Ending | null;
};

export type StepOut = { state: State; events: string[] };

export type Trace = {
  world: string;
  seed: number;
  actions: Action[];
  receipt?: string;
};
