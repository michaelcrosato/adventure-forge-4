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
  | ["var", string, "<" | ">" | "=" | ">=", number];

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
  | ["check", string, number, Fx[], Fx[]] // skill, dc, okFx, failFx (d20 + skill mod)
  | ["end", "win" | "lose", string, string]; // kind, endingId, text

// ---------- content ----------
export type ExitDef = {
  to: string;
  if?: Cond[]; // all must pass, else lockedMsg
  lockedMsg?: string;
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
  use?: UseDef[]; // first matching def runs; else "Nothing happens."
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

export type World = {
  id: string;
  title: string;
  intro: string;
  start: string;
  hp: number;
  maxScore: number;
  skills?: Record<string, number>; // name -> modifier for ["check", ...]
  rooms: Record<string, RoomDef>;
  items: Record<string, ItemDef>;
  npcs: Record<string, NpcDef>;
  /** Authored proof: must reach a win ending with score === maxScore (validator replays it). */
  walkthrough: WalkStep[];
};

// ---------- runtime ----------
export type Action =
  | { kind: "go"; dir: string }
  | { kind: "take"; item: string }
  | { kind: "use"; item: string; target?: string }
  | { kind: "talk"; npc: string; topic: string }
  | { kind: "attack"; npc: string }
  | { kind: "custom"; room: string; id: string };

export type Ending = { kind: "win" | "lose"; id: string; text: string };

/** Plain JSON, deep-cloneable, canonically hashable. */
export type State = {
  seed: number;
  rngA: number; // PRNG cursor
  turn: number;
  room: string;
  hp: number;
  score: number;
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
