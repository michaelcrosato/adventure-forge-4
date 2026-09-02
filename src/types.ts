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
  | ["var", string, "<" | ">" | "=" | ">=", number]
  | ["class", string] // player picked this class
  | ["!class", string]
  | ["perk", string] // player owns this perk
  | ["!perk", string];

// ---------- effects ----------
export type Fx =
  | ["say", string]
  | ["set", string] // set flag
  | ["clear", string]
  | ["score", number] // add (clamped 0..maxScore)
  | ["hp", number] // delta (clamped 0..maxHp); 0 => lose ending
  | ["move", string, string] // item -> "inv" | "nowhere" | roomId
  | ["goto", string] // move player (fires room entry)
  | ["npcgo", string, string | null] // move npc (null removes)
  | ["setvar", string, number]
  | ["addvar", string, number]
  | ["check", string, number, Fx[], Fx[]] // skill, dc, okFx, failFx (d20 + skill/attr/perk mods)
  | ["xp", number] // grant xp; levels apply themselves
  | ["perk", string] // grant a perk directly (a trainer teaches you)
  | ["end", "win" | "lose", string, string]; // kind, endingId, text

// ---------- content ----------
export type ExitDef = {
  to: string;
  if?: Cond[]; // all must pass, else lockedMsg
  lockedMsg?: string;
  hint?: string; // short "what's missing" clue shown in the menu while locked, before a turn is wasted
  sideTrip?: boolean; // optional content off the main path; exits line marks it unexplored until the destination is visited
};

export type CustomAction = {
  id: string;
  label: string; // shown verbatim in the menu
  if?: Cond[];
  once?: boolean; // auto-flag `did_<id>` and hide after
  fx: Fx[];
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
  hint?: string; // shown on pickup: what the item is for
};

export type TopicDef = {
  id: string;
  label: string; // menu shows "ask <npc>: <label>"
  if?: Cond[];
  once?: boolean; // auto-flag `said_<npc>_<id>` and hide after
  say: string;
  fx?: Fx[];
};

export type NpcDef = {
  name: string;
  room: string | null;
  desc?: string;
  hostile?: boolean;
  hp?: number;
  atk?: number; // damage dealt to the player per round while alive
  df?: number; // player must roll d20 + weapon hit >= df
  onDeath?: Fx[];
  topics?: TopicDef[];
};

export type WalkStep = string | { repeat: string; until: Cond; max: number };

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
  items?: string[]; // item ids placed here (their loc is rewritten)
  npcs?: string[]; // npc ids placed here (their room is rewritten)
  onEnterOnce?: Fx[];
  actions?: CustomAction[];
};

export type GenDef = {
  id: string; // room ids become `${id}_${x}_${y}`
  name: string; // region display name, used in room names
  seed: number; // all generated text/structure flows from this
  w: number;
  h: number;
  pools: { descs: string[]; briefs?: string[] }; // text is data, drawn by seeded PRNG
  links: { cell: [number, number]; dir: string; to: string; back?: string }[];
  spots?: GenSpot[];
};

export type World = {
  id: string;
  title: string;
  intro: string;
  start: string;
  hp: number;
  maxScore: number;
  skills?: Record<string, number>; // name -> modifier for ["check", ...]
  classes?: Record<string, ClassDef>; // if present, the game starts with a class menu
  perks?: Record<string, PerkDef>;
  gen?: GenDef[]; // regions expanded into rooms at load, before validation
  rooms: Record<string, RoomDef>;
  items: Record<string, ItemDef>;
  npcs: Record<string, NpcDef>;
  /** Optional persistent counter shown in the status line every turn (e.g. quest items gathered). */
  progress?: { var: string; label: string; max: number };
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
  | { kind: "perkpick"; id: string }; // choose a perk after a level-up

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
  ended: Ending | null;
};

export type StepOut = { state: State; events: string[] };

export type Trace = {
  world: string;
  seed: number;
  actions: Action[];
  receipt?: string;
};
