/**
 * tinyforge engine — one pure reducer.
 *
 * step(world, state, action) -> { state, events }. No I/O, no clock, no ambient
 * randomness: all rolls come from a PRNG cursor stored IN the state, so the same
 * seed and action list is byte-identical every run, and a trace replays exactly.
 */
import { createHash } from "node:crypto";
import { MENU_CAP } from "./types.ts";
import type {
  Action,
  AbilityDef,
  Cond,
  CustomAction,
  Fx,
  PerkDef,
  QuestDef,
  RemarkDef,
  State,
  StepOut,
  TopicDef,
  NpcDef,
  UseDef,
  World,
} from "./types.ts";

// ---------- rng (mulberry32 over a cursor kept in state) ----------
function mix(seed: number): number {
  let a = (seed ^ 0x9e3779b9) | 0;
  a = Math.imul(a ^ (a >>> 16), 0x45d9f3b) | 0;
  a = Math.imul(a ^ (a >>> 16), 0x45d9f3b) | 0;
  return (a ^ (a >>> 16)) | 0;
}

function nextRng(a: number): { a: number; r: number } {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { a, r: ((t ^ (t >>> 14)) >>> 0) / 4294967296 };
}

/** d20, advancing the state's PRNG cursor. */
function d20(s: State): number {
  const { a, r } = nextRng(s.rngA);
  s.rngA = a;
  return 1 + Math.floor(r * 20);
}

/** d100, advancing the state's PRNG cursor — for the "chance" effect. */
function d100(s: State): number {
  const { a, r } = nextRng(s.rngA);
  s.rngA = a;
  return 1 + Math.floor(r * 100);
}

// ---------- canonical hash ----------
/**
 * `JSON.stringify(k)` for a key, remembered. The keys canon walks are field
 * names, flag names and item and npc ids — a few hundred strings, asked for
 * again on every hash of every turn, each time allocating the same quoted
 * copy.
 */
const quotedKeys = new Map<string, string>();
function quotedKey(k: string): string {
  let q = quotedKeys.get(k);
  if (q === undefined) {
    q = JSON.stringify(k);
    quotedKeys.set(k, q);
  }
  return q;
}

/**
 * Canonical JSON: keys sorted, so the same state hashes the same however it was
 * built. A receipt is only worth something if it is reproducible, so this
 * function's output is a format — the two fast paths below and the loops in
 * place of `map`/`join` were written to leave it byte for byte unchanged
 * (`Number.isFinite` mirrors what JSON.stringify does with NaN and infinities),
 * because a faster hash that hashes differently is a broken hash.
 */
function canon(v: unknown): string {
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) {
    let out = "[";
    for (let i = 0; i < v.length; i++) out += (i ? "," : "") + canon(v[i]);
    return out + "]";
  }
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  let out = "{";
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i]!;
    out += (i ? "," : "") + quotedKey(k) + ":" + canon(o[k]);
  }
  return out + "}";
}

/**
 * Two states carrying the same values, whatever order their keys went in.
 *
 * This is what the crawler's determinism check wants — it takes one step twice
 * from one state and asks whether the results agree — and it walks the objects
 * themselves rather than a list of fields, so a field added to State cannot
 * quietly fall outside the comparison. It is also exact where two truncated
 * hashes were only very probably exact, and it stops at the first difference
 * instead of serializing two whole states to find one.
 */
export function sameState(a: State, b: State): boolean {
  return sameValue(a, b);
}
function sameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  const aArr = Array.isArray(a);
  if (aArr !== Array.isArray(b)) return false;
  if (aArr) {
    const x = a as unknown[], y = b as unknown[];
    if (x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) if (!sameValue(x[i], y[i])) return false;
    return true;
  }
  const x = a as Record<string, unknown>, y = b as Record<string, unknown>;
  const keys = Object.keys(x);
  if (keys.length !== Object.keys(y).length) return false;
  for (const k of keys) {
    if (!(k in y)) return false;
    if (!sameValue(x[k], y[k])) return false;
  }
  return true;
}

/** Actions that turn a menu page rather than the world: free, and no time for anyone to speak. */
const MENU_KINDS = new Set(["travel", "travelregion", "travelmore", "traveldone", "company", "companydone", "talkmore", "roommore"]);

/** Flags a quarrel sets that are outcomes, not the quarrel itself. */
const QUARREL_TAILS = new Set(["done", "peace", "sour", "lys", "osk", "tamsin", "vell"]);

/** A fail within two of the DC says so — in one of a few voices, chosen by the roll, so the line doesn't wear out. */
export const NEAR_MISS_CUES = ["So close — that one nearly landed.", "A hair short. It nearly went.", "Nearly; the margin was a breath."] as const;

/**
 * The condition id `leave` puts on an aggressive npc it just broke away from,
 * and the number of turns it holds — a quiet spell so the very next step
 * (walking out) is not struck too. Reusing the conditions layer (rather than
 * a bespoke `disengaged_<npc>` flag) gets its countdown, cleanup, and room-line
 * rendering for free: aggressivePass only has to check for it, not tick it.
 */
export const DISENGAGE_COND = "disengaged";
const DISENGAGE_TURNS = 2;

export function hashState(s: State): string {
  return createHash("sha256").update(canon(s)).digest("hex").slice(0, 8);
}

export function receipt(world: World, s: State): string {
  const end = s.ended ? s.ended.id : "open";
  return `${world.id}.${s.seed}.${s.turn}.${s.score}.${end}.${hashState(s)}`;
}

// ---------- helpers ----------
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const article = (name: string) => (/^[aeiou]/i.test(name) ? "an" : "a");
/**
 * "the wight" — unless the name already carries its own article ("the Wyrm")
 * or is a proper name ("Lys", "Regent Ysolde": authored with a capital).
 * Common nouns are authored lowercase by convention (docs/authoring.md §7).
 */
const theName = (name: string) => (/^(the|a|an)\s/i.test(name) || /^[A-Z]/.test(name) ? name : `the ${name}`);
/** Sentence-initial form of theName. */
const TheName = (name: string) => { const t = theName(name); return t.charAt(0).toUpperCase() + t.slice(1); };

export function hasLight(world: World, s: State): boolean {
  return s.inv.some((id) => world.items[id]?.light && s.flags[`${id}_lit`]);
}

export function roomIsDark(world: World, s: State): boolean {
  return !!world.rooms[s.room]?.dark && !hasLight(world, s);
}

function npcDead(world: World, s: State, id: string): boolean {
  const def = world.npcs[id];
  if (!def) return false;
  return (s.npcHp[id] ?? def.hp ?? 1) <= 0;
}

/**
 * A speaker's line, as the player reads it. The quotes are the engine's, added
 * so a line reads as speech — but 236 of the realm's 1,957 topic lines (12%)
 * already contain a quote of their own, because the author wrote the
 * attribution themselves: narration, then speech ("She's quiet, then: \"Then
 * that's that.\""), or speech interrupted by it ("\"Mine,\" Vell says"). Wrapping
 * those again renders `vell: ""Mine," Vell says...`, doubled at the open and
 * unbalanced at the close. So: quote a bare line, and let a line that has
 * punctuated itself stand as written.
 */
export function speaks(name: string, say: string): string {
  // A template hole leaves `say` undefined at runtime despite the type. Render
  // that the way the old template literal did, so the crawler's HOLE check
  // still catches "undefined" printed at the player — test/crawl covers it.
  return typeof say === "string" && say.includes('"') ? `${name}: ${say}` : `${name}: "${say}"`;
}

/**
 * Set a flag and remember the turn it happened on, for `["since", ...]` (§3).
 * Every place this file sets a flag goes through here — a `set` effect, a
 * `once` action's `did_`, a topic's `said_`, a theft's `stole_`, a companion
 * walking out. The `_`-prefixed internal markers (`_seenTravel` and friends,
 * which only stop a one-time explainer repeating) are recorded too rather than
 * special-cased: one rule is worth more than the handful of entries it saves,
 * and "when did the player first see the travel hint" is not a question worth
 * making unanswerable. First write wins — a flag re-set keeps its original
 * turn, because "since" means since it happened, not since it last happened.
 */
function setFlag(s: State, key: string): void {
  if (!s.flags[key]) {
    s.flags[key] = true;
    (s.flagTurn ??= {})[key] = s.turn;
  }
}

export function condOk(world: World, s: State, c: Cond): boolean {
  switch (c[0]) {
    case "has":
      return s.inv.includes(c[1]);
    case "!has":
      return !s.inv.includes(c[1]);
    case "flag":
      return !!s.flags[c[1]];
    case "!flag":
      return !s.flags[c[1]];
    case "npcDead":
      return npcDead(world, s, c[1]);
    case "!npcDead":
      return !npcDead(world, s, c[1]);
    case "var": {
      const v = s.vars[c[1]] ?? 0;
      return c[2] === "<" ? v < c[3] : c[2] === ">" ? v > c[3] : c[2] === ">=" ? v >= c[3] : c[2] === "<=" ? v <= c[3] : v === c[3];
    }
    case "class":
      return s.classId === c[1];
    case "!class":
      return s.classId !== c[1];
    case "perk":
      return s.perks.includes(c[1]);
    case "!perk":
      return !s.perks.includes(c[1]);
    case "npcHere":
      return s.npcRoom[c[1]] === s.room && !npcDead(world, s, c[1]);
    case "!npcHere":
      return !(s.npcRoom[c[1]] === s.room && !npcDead(world, s, c[1]));
    case "inParty":
      return s.party.includes(c[1]);
    case "!inParty":
      return !s.party.includes(c[1]);
    case "cond":
      return !!s.conds[c[1]];
    case "!cond":
      return !s.conds[c[1]];
    case "npccond":
      return !!s.npcConds[c[1]]?.[c[2]];
    case "!npccond":
      return !s.npcConds[c[1]]?.[c[2]];
    case "turn": {
      const v = s.turn;
      return c[1] === "<" ? v < c[2] : c[1] === ">" ? v > c[2] : c[1] === ">=" ? v >= c[2] : c[1] === "<=" ? v <= c[2] : v === c[2];
    }
    case "since": {
      // "N turns after this happened". Nothing in the DSL could say it: `turn`
      // reads the absolute counter and `setvar` takes a literal, so content had
      // no way to record "now" — which is why the Ironbound march's fourteen
      // burns were pinned to absolute turns and a player who set it moving at
      // turn 470 lost eleven holds in forty turns instead of one every forty.
      // Unset reads FALSE rather than 0, so an unfired flag is never "0 turns
      // ago" and `["since", f, ">=", 0]` cannot pass before f happens.
      const t0 = s.flagTurn?.[c[1]];
      if (t0 === undefined) return false;
      const v = s.turn - t0;
      return c[2] === "<" ? v < c[3] : c[2] === ">" ? v > c[3] : c[2] === ">=" ? v >= c[3] : c[2] === "<=" ? v <= c[3] : v === c[3];
    }
    // These five read the room or the player rather than naming an id, and they
    // shipped without the negated twin every other op in this switch has. That
    // is a hole, not a simplification: there was no way to write "offer this
    // only when nothing here ignores armor", which is exactly what the Warden's
    // `brace for it` (armor +2) needs — it is currently offered against all
    // eight `pierce` hostiles, in rooms whose own text says "armor useless".
    case "horrorHere":
      return hostilesHere(world, s).some((id) => world.npcs[id]?.pierce);
    case "!horrorHere":
      return !hostilesHere(world, s).some((id) => world.npcs[id]?.pierce);
    case "holdsGround":
      return hostilesHere(world, s).some((id) => !aggressiveNow(world, s, id));
    case "!holdsGround":
      return !hostilesHere(world, s).some((id) => !aggressiveNow(world, s, id));
    case "companionDown":
      return s.party.some((id) => s.flags[`down_${id}`]);
    case "!companionDown":
      return !s.party.some((id) => s.flags[`down_${id}`]);
    case "checkHere":
      return checkHereNow(world, s, c[1], c[2]);
    case "!checkHere":
      return !checkHereNow(world, s, c[1], c[2]);
    case "lowHp":
      return fightGoingBadly(s);
    case "!lowHp":
      return !fightGoingBadly(s);
    // Where you are, not what you carry. A hold's arrival used to be authored as
    // a chain of `if inParty` says inside one `onEnterOnce`, and with a full
    // party that put four companions' answers on one screen — 1,448 characters
    // at Mootcombe's Cairn-Track, one speaker twice. The engine already speaks
    // at most one companion remark a turn, in rotation; what a remark could not
    // say was "while we are here", so the lines could not move there.
    case "region":
      return world.rooms[s.room]?.region === c[1];
    case "!region":
      return world.rooms[s.room]?.region !== c[1];
    case "any":
      return c[1].some((x) => condOk(world, s, x));
  }
}

const condsOk = (world: World, s: State, cs?: Cond[]) =>
  !cs || cs.every((c) => condOk(world, s, c));

// ---------- characters ----------
/** Cumulative xp needed to reach a level: 10 for 2, 30 for 3, 60 for 4, 100 for 5... */
export const xpForLevel = (level: number): number => 5 * level * (level - 1);

/** Sum a numeric perk bonus ("hit" | "dmg" | "armor" | "maxhp") over owned perks. */
function perkBonus(world: World, s: State, key: "hit" | "dmg" | "armor" | "maxhp"): number {
  let n = 0;
  for (const id of s.perks) n += world.perks?.[id]?.bonus?.[key] ?? 0;
  return n;
}

/** Sum a numeric field ("hit" | "dmg" | "armor") over the player's active conditions. */
function condBonus(world: World, s: State, key: "hit" | "dmg" | "armor"): number {
  let n = 0;
  for (const id of Object.keys(s.conds)) n += world.conditions?.[id]?.[key] ?? 0;
  return n;
}

/** Sum a numeric field over one npc's active conditions — its `hit` folds into a strike, `armor` raises its df. */
function npcCondBonus(world: World, s: State, npcId: string, key: "hit" | "dmg" | "armor"): number {
  const conds = s.npcConds[npcId];
  if (!conds) return 0;
  let n = 0;
  for (const id of Object.keys(conds)) n += world.conditions?.[id]?.[key] ?? 0;
  return n;
}

/** An npc's df as it stands now: authored base, raised by any `armor` condition it carries. */
function npcDf(world: World, s: State, npcId: string): number {
  return (world.npcs[npcId]?.df ?? 10) + npcCondBonus(world, s, npcId, "armor");
}

/** Modifier for a named check: world skill + attribute + perk check bonuses + the player's active condition bonuses. */
export function checkMod(world: World, s: State, name: string): number {
  let n = (world.skills?.[name] ?? 0) + (s.attrs[name] ?? 0);
  for (const id of s.perks) n += world.perks?.[id]?.bonus?.check?.[name] ?? 0;
  for (const id of Object.keys(s.conds)) n += world.conditions?.[id]?.checks?.[name] ?? 0;
  return n;
}

/**
 * Named parts behind a check's modifier (base skill+attribute, then each
 * contributing perk, then each contributing condition), for a breakdown shown
 * when more than one thing stacks into it — a player who sees only the final
 * total has no way to tell how much a given perk (e.g. Fleetfoot) or
 * condition (e.g. Steady) is actually adding. Used both by the post-roll
 * check event below and by status's "Checks:" summary.
 */
export function checkModParts(world: World, s: State, name: string): { label: string; n: number }[] {
  const parts: { label: string; n: number }[] = [];
  const base = (world.skills?.[name] ?? 0) + (s.attrs[name] ?? 0);
  if (base) parts.push({ label: "base", n: base });
  for (const id of s.perks) {
    const n = world.perks?.[id]?.bonus?.check?.[name] ?? 0;
    if (n) parts.push({ label: world.perks![id]!.name, n });
  }
  for (const id of Object.keys(s.conds)) {
    const n = world.conditions?.[id]?.checks?.[name] ?? 0;
    if (n) parts.push({ label: world.conditions![id]!.name, n });
  }
  return parts;
}

/** The one carried armor item that counts (the best; they do not stack). */
function bestArmor(world: World, s: State): { armor: number; item: string | null } {
  let best: { armor: number; item: string | null } = { armor: 0, item: null };
  for (const id of s.inv) {
    const a = world.items[id]?.armor ?? 0;
    if (a > best.armor) best = { armor: a, item: id };
  }
  return best;
}

/** Damage reduction: best carried armor item + perk armor + active condition armor. */
export function armorOf(world: World, s: State): number {
  return bestArmor(world, s).armor + perkBonus(world, s, "armor") + condBonus(world, s, "armor");
}

/** Attack-roll bonus: best weapon's hit + might + perk hit bonuses + active condition hit bonuses. The one place this sum is defined. */
function attackBonus(world: World, s: State, w = bestWeapon(world, s)): number {
  return w.hit + (s.attrs["might"] ?? 0) + perkBonus(world, s, "hit") + condBonus(world, s, "hit");
}

/** Attack-roll and damage totals an `attack` action would actually use, for the free `status` check. */
export function combatMods(
  world: World,
  s: State,
): { hit: number; dmg: number; armor: number; weapon: string | null; armorItem: string | null } {
  const w = bestWeapon(world, s);
  return {
    hit: attackBonus(world, s, w),
    dmg: w.dmg + perkBonus(world, s, "dmg") + condBonus(world, s, "dmg"),
    armor: armorOf(world, s),
    weapon: w.item, // the weapon and armor that count: the best carried, not the sum
    armorItem: bestArmor(world, s).item,
  };
}

export function perkEligible(world: World, s: State, id: string, def: PerkDef): boolean {
  if (s.perks.includes(id)) return false;
  const r = def.require;
  if (!r) return true;
  if (r.level !== undefined && s.level < r.level) return false;
  if (r.class && (!s.classId || !r.class.includes(s.classId))) return false;
  if (r.attr && (s.attrs[r.attr[0]] ?? 0) < r.attr[1]) return false;
  return true;
}

function eligiblePerks(world: World, s: State): string[] {
  return Object.keys(world.perks ?? {}).filter((id) => perkEligible(world, s, id, world.perks![id]!));
}

/**
 * Grant a perk: record it and apply its maxhp bonus (with the matching heal).
 * `picked` marks a perk chosen at a level-up (as opposed to one granted by
 * class or script) — for those, a check-boosting perk gets one extra line
 * spelling out that the bonus already counts in the roll odds shown before
 * every check from here on, since a player who just picked it has no other
 * way to know that without spending a turn to test it.
 */
function grantPerk(world: World, s: State, id: string, events: string[], picked = false): void {
  if (s.perks.includes(id)) return;
  const def = world.perks?.[id];
  if (!def) return;
  s.perks.push(id);
  const extraHp = def.bonus?.maxhp ?? 0;
  if (extraHp) {
    s.maxHp += extraHp;
    s.hp = Math.min(s.hp + extraHp, s.maxHp);
  }
  const hint = picked && def.bonus?.check ? " Already counted in check odds shown." : "";
  events.push(`Perk gained: ${def.name} (${def.desc}).${hint}`);
}

/** Add xp and apply any level-ups: +2 max hp, heal 2, one perk pick each. */
function grantXp(world: World, s: State, n: number, events: string[]): void {
  s.xp += n;
  if (n > 0) events.push(`(+${n}xp)`);
  while (s.xp >= xpForLevel(s.level + 1)) {
    s.level += 1;
    s.maxHp += 2;
    s.hp = Math.min(s.hp + 2, s.maxHp);
    events.push(`Level ${s.level}!`);
    // only queue a pick if something is actually pickable; eligibility never shrinks
    if (eligiblePerks(world, s).length) s.perkPicks += 1;
  }
}

export const inClassPhase = (world: World, s: State): boolean =>
  s.classId === null && !!world.classes && Object.keys(world.classes).length > 0;

// ---------- rooms that change ----------
/** The room as it currently looks: base fields, overridden by the first matching variant. */
export function roomView(world: World, s: State, roomId = s.room): { name: string; desc: string; brief?: string } {
  const room = world.rooms[roomId];
  if (!room) return { name: roomId, desc: "" };
  const v = room.variants?.find((x) => condsOk(world, s, x.if));
  const brief = v?.brief ?? room.brief;
  return { name: v?.name ?? room.name, desc: v?.desc ?? room.desc, ...(brief !== undefined ? { brief } : {}) };
}

// ---------- journal ----------
export type QuestLine = { id: string; name: string; status: "active" | "done" | "failed"; text: string; at?: string };

/** Every quest that has started, with the line the player should read for it right now. */
export function journal(world: World, s: State): QuestLine[] {
  const out: QuestLine[] = [];
  for (const [id, q] of indexOf(world).quests) {
    if (!condsOk(world, s, q.start)) continue;
    // a quest once done stays done: its asker's wish was met, whatever came after
    if (q.done && condsOk(world, s, q.done)) { out.push({ id, name: q.name, status: "done", text: "" }); continue; }
    if (q.failed && condsOk(world, s, q.failed)) { out.push({ id, name: q.name, status: "failed", text: "" }); continue; }
    const stage = q.stages.find((st) => condsOk(world, s, st.if));
    out.push({ id, name: q.name, status: "active", text: stage?.text ?? "", ...(stage?.at ? { at: stage.at } : {}) });
  }
  return out;
}

/** One event per quest whose journal line changed this turn — the player sees the journal move without asking. */
function journalEvents(world: World, before: State, after: State, events: string[]): void {
  if (!world.quests) return;
  const prev = new Map(journal(world, before).map((q) => [q.id, q]));
  const now = journal(world, after);
  // Entering a hold can move several quests at once — begin them, or turn each
  // of them to a new stage — and one line names them all while the journal
  // (status) carries their text, so the screen stays readable.
  //
  // Beginnings collapsed from the start; stage changes did not, and the
  // difference was invisible until a quest's start moved earlier. Then arriving
  // at Marrowgate's south gate turned two quests to their next stage in the
  // same breath and printed both in full, 250 characters of a 1,159-character
  // screen. To a player they are the same wall of text either way, so both
  // collapse now, and a mix of the two collapses together.
  const moved = now.filter((q) => {
    const p = prev.get(q.id);
    if (q.status === "done" || q.status === "failed") return false;
    if (!q.text) return false;
    return !p || p.text !== q.text || p.status !== q.status;
  });
  const collapse = moved.length >= 2;
  if (collapse) events.push(`Journal: ${moved.map((q) => q.name).join("; ")} — see status.`);
  for (const q of now) {
    const p = prev.get(q.id);
    if (p && p.status === q.status && p.text === q.text) continue;
    if (collapse && q.status !== "done" && q.status !== "failed") continue;
    // a quest that first appears already closed (its start and its end came
    // together, or its end came first) was never the player's to finish: no announcement
    if (!p && (q.status === "done" || q.status === "failed")) continue;
    if (q.status === "done") events.push(`Quest done: ${q.name}.`);
    else if (q.status === "failed") events.push(`Quest closed: ${q.name} — its asker's wish can no longer be met.`);
    else if (q.text) events.push(`Quest — ${q.name}: ${q.text}`);
  }
}

// ---------- where you stand in a wilderness ----------
const COUNT_WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);

/**
 * The way back to the nearest place you know, walked rather than measured.
 *
 * Three playtest reports asked for a breadcrumb: the realm's bearings are
 * given as hop counts ("From Stilt-Shadow: the drowned nave, two stands
 * west"), and following one meant counting in your head. The first version of
 * this line answered with the *coordinate offset* to the nearest landmark —
 * "two south and one east of the north lane" — and a player in the next wave
 * reported that those directions "don't always match actual movement outcomes
 * 1:1".
 *
 * They were right, and by a lot. The grids have walls, so a coordinate offset
 * is not a route: measured across the realm, **466 of 2,056 cell-to-landmark
 * offsets (23%) cannot be walked in a straight line at all**. A line that
 * reads as a route and is not one is worse than no line.
 *
 * So it is a real path now, breadth-first through the actual exits, to the
 * nearest landmark the player has already stood in — shortest by walking
 * rather than by arithmetic, phrased the way the realm's own bearings are
 * phrased, and every step of it is an exit that exists.
 */
/**
 * The way to one named room, walked rather than measured: legs like "two
 * north, then three west", or "" when the player is already standing there,
 * or null when no chain of exits reaches it from here.
 *
 * Where `wildBearing` answers "where am I" — the way back to the nearest place
 * you already know, inside one generated grid — this answers "where is the
 * thing I am looking for", which is the question three blind players in one
 * wave asked for and two of them lost 30-60 turns to. It walks the whole realm
 * rather than one grid, and it walks to somewhere the player has *not* been,
 * because that is the case that matters.
 *
 * Locked exits count as exits. A route that runs through a barred door is the
 * route; the door is the quest. Pretending the place is unreachable would be
 * the same lie the coordinate offsets told.
 */
/**
 * The legs of a walked path, from a breadth-first `from` map: consecutive steps
 * the same way count as one, so "north, north, west, west, west" reads "two
 * north, then three west". Shared by `pathTo` and `bearingsHere`.
 */
function legsOf(from: Map<string, [string, string]>, start: string, target: string): string {
  const dirs: string[] = [];
  for (let cur = target; cur !== start; ) {
    const step = from.get(cur)!;
    dirs.push(step[1]);
    cur = step[0];
  }
  dirs.reverse();
  const legs: string[] = [];
  for (let i = 0; i < dirs.length; ) {
    let n = 1;
    while (dirs[i + n] === dirs[i]) n++;
    legs.push(`${countWord(n)} ${dirs[i]}`);
    i += n;
  }
  return legs.join(", then ");
}

/** Most places one "get your bearings" names: past a few it stops being an answer and becomes a list. */
const BEARINGS_CAP = 3;

/**
 * The way to the named places of this region, nearest first, walked.
 *
 * The realm carried 315 of these as hand-written strings — "As the fell runs,
 * Slatefold is 4 south and 1 east, then down. The bound-stone: 6 south." — one
 * per wilderness cell, each a separate chance to be wrong about a grid that has
 * walls. Two waves reported them not matching the map, and the second put it
 * plainly: "the real path required going east", where the text said west.
 *
 * So content still decides *where* a player can take their bearings (the `free`
 * action stays authored, and the flavour opening with it); the engine says what
 * the answer is. Unvisited places count — the whole point of asking is to find
 * somewhere you have not been — which is what separates this from
 * `wildBearing`'s way back to somewhere you know.
 */
/**
 * Cached per world and room, because the answer depends on nothing else: the
 * region, the exits, the landmarks and the region's opening words are all
 * static, and locks are conditions rather than missing exits (a barred door is
 * still the way — see `pathTo`). Without it every press paid a whole-realm
 * breadth-first walk, and it is a free action a lost player presses again and
 * again. Measured on the forked crawl it bought about half a second of 28 —
 * the walk is cheaper than it looks — so this is here for the player pressing
 * it in one room, not for the bar.
 */
const bearingsCache = new WeakMap<World, Map<string, string>>();

export function bearingsHere(world: World, s: State): string {
  let cache = bearingsCache.get(world);
  if (!cache) bearingsCache.set(world, (cache = new Map()));
  const hit = cache.get(s.room);
  if (hit !== undefined) return hit;
  const answer = computeBearings(world, s.room);
  cache.set(s.room, answer);
  return answer;
}

function computeBearings(world: World, room: string): string {
  const s = { room } as State;
  const region = world.rooms[s.room]?.region;
  if (!region) return "Nothing hereabouts has a name to steer by.";
  const from = new Map<string, [string, string]>();
  const order: string[] = [];
  const queue = [s.room];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!;
    for (const [dir, ex] of Object.entries(world.rooms[at]?.exits ?? {})) {
      if (from.has(ex.to) || ex.to === s.room) continue;
      from.set(ex.to, [at, dir]);
      order.push(ex.to); // breadth-first, so this is nearest-first already
      queue.push(ex.to);
    }
  }
  const named = order.filter((id) => world.rooms[id]?.region === region && world.rooms[id]?.landmark).slice(0, BEARINGS_CAP);
  if (!named.length) return "Nothing hereabouts has a name to steer by.";
  const parts = named.map((id) => `${world.rooms[id]!.landmark}, ${legsOf(from, s.room, id)}`);
  // the region's own voice for it — "As the fell runs", "As the rides run" —
  // which is the half of these lines that was worth keeping
  return `${world.regions?.[region]?.bearing ?? "As the ground runs"}: ${parts.join("; ")}.`;
}

export function pathTo(world: World, s: State, target: string): string | null {
  if (target === s.room) return "";
  if (!world.rooms[target]) return null;
  const from = new Map<string, [string, string]>();
  const queue = [s.room];
  for (let head = 0; head < queue.length; head++) {
    const at = queue[head]!;
    for (const [dir, ex] of Object.entries(world.rooms[at]?.exits ?? {})) {
      if (from.has(ex.to) || ex.to === s.room) continue;
      from.set(ex.to, [at, dir]);
      if (ex.to === target) return legsOf(from, s.room, target);
      queue.push(ex.to);
    }
  }
  return null;
}

export function wildBearing(world: World, s: State): string | null {
  for (const g of world.gen ?? []) {
    const cell = new RegExp(`^${g.id}_(\\d+)_(\\d+)$`);
    if (!cell.test(s.room)) continue;
    // where a bearing is given from and about: a landmark spot inside the grid,
    // or a link's landmark on its edge — and only ones already stood in
    const anchors = new Map<string, string>();
    for (const spot of g.spots ?? []) {
      if (!spot.landmark) continue;
      const id = `${g.id}_${spot.cell[0]}_${spot.cell[1]}`;
      if (s.visited.includes(id)) anchors.set(id, spot.landmark);
    }
    for (const link of g.links) {
      if (!link.landmark || !s.visited.includes(link.to)) continue;
      const id = `${g.id}_${link.cell[0]}_${link.cell[1]}`;
      if (!anchors.has(id)) anchors.set(id, link.landmark);
    }
    if (!anchors.size || anchors.has(s.room)) return null; // nothing known, or standing on it
    // breadth-first over real exits, inside this region's cells
    const from = new Map<string, [string, string]>();
    const queue = [s.room];
    let found: string | null = null;
    for (let head = 0; head < queue.length && !found; head++) {
      const at = queue[head]!;
      for (const [dir, ex] of Object.entries(world.rooms[at]?.exits ?? {})) {
        const to = ex.to;
        if (!cell.test(to) || from.has(to) || to === s.room) continue;
        from.set(to, [at, dir]);
        if (anchors.has(to)) { found = to; break; }
        queue.push(to);
      }
    }
    if (!found) return null;
    // the path back, as legs: consecutive steps the same way count as one
    const dirs: string[] = [];
    for (let at = found; at !== s.room; ) {
      const step = from.get(at)!;
      dirs.push(step[1]);
      at = step[0];
    }
    dirs.reverse();
    const legs: string[] = [];
    for (let i = 0; i < dirs.length; ) {
      let n = 1;
      while (dirs[i + n] === dirs[i]) n++;
      legs.push(`${countWord(n)} ${dirs[i]}`);
      i += n;
    }
    const name = anchors.get(found)!.replace(/^The /, "the ");
    return `${name}: ${legs.join(", then ")}`;
  }
  return null;
}

// ---------- fast travel ----------
/** Landmark rooms the player has stood in, other than the one they stand in now. */
export function knownLandmarks(world: World, s: State): string[] {
  return s.visited.filter((id) => id !== s.room && !!world.rooms[id]?.landmark);
}

/**
 * Travel is offered from any room with somewhere known to go and no hostile at
 * hand — a player lost in a wilderness grid can always walk back the way they
 * came to a place they know; only the destinations are landmarks, and nobody
 * strolls away from a confrontation.
 */
/** Hostile as things stand: a `hostile` or `aggressive` def that content has not calmed (`["calm", id]`). */
export const hostileNow = (world: World, s: State, id: string): boolean =>
  !!(world.npcs[id]?.hostile || world.npcs[id]?.aggressive) && !s.flags[`calm_${id}`];
export const aggressiveNow = (world: World, s: State, id: string): boolean =>
  !!world.npcs[id]?.aggressive && !s.flags[`calm_${id}`];

/**
 * hp at half or less: the state a fight has to reach before breaking away
 * from an aggressive npc is worth its price. Healthy, breaking off would only
 * trade a strike for nothing the fight itself wasn't about to cost anyway —
 * the option is for a fight actually going badly, not every skirmish.
 */
const fightGoingBadly = (s: State): boolean => s.hp * 2 <= s.maxHp;

/**
 * A Scout's "slip away": breaking off from an aggressive npc costs no parting
 * strike, spending a point of `res_scout` instead — the same disengage the
 * gate above offers everyone, just quieter. Not a `world.abilities` entry:
 * it modifies the price of an already npc-targeted action (`leave` already
 * knows which npc) rather than needing a target of its own, so it lives here
 * instead of duplicating the disengage mechanics behind a second Action kind.
 */
const canSlipAway = (world: World, s: State): boolean => s.classId === "scout" && (s.vars["res_scout"] ?? 0) >= 1;

/**
 * Lists that cannot change once a world is loaded, built on first ask and kept
 * against the world object itself.
 *
 * The room menu asks the same questions every turn — who here could fight, what
 * here could be picked up, what here strikes through armor — and each was
 * answered by walking every npc or every item in the realm. The answer can only
 * ever come from a fixed subset, so the subset is what gets walked: in the
 * Reach, 67 npcs instead of 265 and 161 items instead of 321. Order is the
 * insertion order of `world.npcs`/`world.items`, exactly what the
 * `Object.keys(...).filter(...)` these replace produced, so every menu still
 * lists in the order it did.
 *
 * Nothing about which of them is *here* is cached. That is state, it moves, and
 * a wrong answer would be a bug the tests could not see.
 */
type WorldIndex = {
  /** Npcs a `hostile`/`aggressive` def could ever make an enemy of — content may still have calmed them. */
  maybeHostile: string[];
  /** Npcs whose blow ignores armor. */
  piercers: string[];
  /** Items that can be picked up at all. */
  takeable: string[];
  /** `world.quests` as entries, so the journal does not rebuild the pair array twice a turn. */
  quests: [string, QuestDef][];
};
const worldIndexes = new WeakMap<World, WorldIndex>();

/**
 * Answers `legalActions` asks over and over while building one menu.
 *
 * "Is anything hostile standing here?" is asked once by `attack`, once per
 * combat ability, and again by every `horrorHere`/`holdsGround` condition on
 * every action and topic in the room — dozens of times, for one answer.
 * `legalActions` does not touch the state, so an answer computed inside one
 * call holds for the whole call.
 *
 * Outside `legalActions` the memo is null and every question is answered from
 * the state as it stands, because `step` mutates as it goes — an npc dies, a
 * flag calms one, the player walks out — and a remembered answer would be a
 * lie. `legalActions` saves and restores whatever it found here, so a nested
 * call cannot leave a stale answer behind either.
 */
let menuMemo: { hostiles?: string[]; here?: string[]; takeables?: string[] } | null = null;
function indexOf(world: World): WorldIndex {
  let idx = worldIndexes.get(world);
  if (!idx) {
    const npcs = Object.keys(world.npcs);
    idx = {
      maybeHostile: npcs.filter((id) => world.npcs[id]!.hostile || world.npcs[id]!.aggressive),
      piercers: npcs.filter((id) => world.npcs[id]!.pierce),
      takeable: Object.keys(world.items).filter((id) => world.items[id]!.takeable),
      quests: Object.entries(world.quests ?? {}),
    };
    worldIndexes.set(world, idx);
  }
  return idx;
}

/** Npcs attackable and hostile, standing alive in the player's room right now — the same test `attack` uses to decide it should be offered. */
function hostilesHere(world: World, s: State): string[] {
  if (menuMemo?.hostiles) return menuMemo.hostiles;
  const out = indexOf(world).maybeHostile.filter(
    (id) =>
      world.npcs[id]?.hp !== undefined &&
      !s.party.includes(id) &&
      hostileNow(world, s, id) &&
      s.npcRoom[id] === s.room &&
      (s.npcHp[id] ?? world.npcs[id]!.hp ?? 1) > 0,
  );
  if (menuMemo) menuMemo.hostiles = out;
  return out;
}

export function travelAvailable(world: World, s: State): boolean {
  if (world.rooms[s.room]?.noTravel) return false;
  if (!knownLandmarks(world, s).length) return false;
  for (const id of indexOf(world).maybeHostile) {
    if (hostileNow(world, s, id) && s.npcRoom[id] === s.room && !npcDead(world, s, id) && !s.party.includes(id) && !s.flags[`left_${id}`]) return false;
  }
  return true;
}

export const inTravelMode = (world: World, s: State): boolean => s.travelMenu !== null && travelAvailable(world, s);

/**
 * Companions standing here who could be spoken with: alive, `dialogue`, with
 * something to say. Two or more fold into one "speak with the company" entry
 * that opens a list of them — browsing, like the travel menu — so a full party
 * never crowds a room's menu past the cap. One alone keeps its own entry, so
 * walkthroughs and proofs that travel with a single companion replay unchanged.
 */
export function companyHere(world: World, s: State): string[] {
  return s.party.filter((id) => {
    const def = world.npcs[id];
    return !!def?.dialogue && s.npcRoom[id] === s.room && !npcDead(world, s, id) && visibleTopics(world, s, id).length > 0;
  });
}
export const inCompanyMode = (world: World, s: State): boolean => s.companyMenu && companyHere(world, s).length >= 2;

/** Regions with at least one known landmark, in world order — the grouping used when the flat list would overflow the menu. */
function travelRegions(world: World, s: State): string[] {
  const seen = new Set<string>();
  for (const id of knownLandmarks(world, s)) seen.add(world.rooms[id]?.region ?? "");
  return Object.keys(world.regions ?? {}).filter((r) => seen.has(r)).concat(seen.has("") ? [""] : []);
}

/** The travel menu: flat destinations when they fit, else regions first, then one region's destinations. */
/**
 * Rooms of one region the player has stood in and is not standing in now, in
 * the order they were seen.
 *
 * I tried gating this on "the region is at least six rooms mapped", so the
 * extra entries would only appear where the complaint actually bites. It made
 * no difference to the cost — the proven road maps that much of the regions it
 * travels inside — and tuning the threshold until the budget stopped noticing
 * would be narrowing a gate to hide a price, which is the thing docs/roadmap.md
 * §6 warns about in as many words. So it is ungated, and the price is paid
 * where prices are recorded.
 */
function localTravel(world: World, s: State, region: string): string[] {
  return s.visited.filter((id) => id !== s.room && (world.rooms[id]?.region ?? "") === region);
}

/**
 * The name a region is offered under. `world.regions` names them; a region with
 * no entry falls back to its code, which is at least unambiguous.
 */
const regionName = (world: World, region: string): string => world.regions?.[region]?.name ?? region;

function travelActions(world: World, s: State): Action[] {
  const known = knownLandmarks(world, s);
  let list: Action[];
  if (s.travelMenu === "") {
    list =
      known.length <= MENU_CAP - 1
        ? known.map((id): Action => ({ kind: "travelto", room: id }))
        : travelRegions(world, s).map((r): Action => ({ kind: "travelregion", region: r }));
    // and the way back into the region you are standing in, when you have
    // walked more of it than its landmarks — the short list above cannot name
    // thirty mapped cells, and it should not have to
    const here = world.rooms[s.room]?.region ?? "";
    if (here && !list.some((a) => a.kind === "travelregion" && a.region === here)) {
      if (localTravel(world, s, here).some((id) => !world.rooms[id]?.landmark)) list.push({ kind: "travelregion", region: here });
    }
  } else {
    // Every room of this region the player has stood in, not only its
    // landmarks. Two playtest reports, two waves apart: "backtracking through
    // multi-room dungeons/wilderness required long manual step-by-step
    // retracing even after the area was fully mapped". Walking a wilderness
    // the first time is the game; walking it the fourth time is not. Crossing
    // the realm still goes landmark to landmark — you know the way to the mill
    // road — but inside a region you have mapped, you can go back to anywhere
    // you have been.
    list = localTravel(world, s, s.travelMenu ?? "").map((id): Action => ({ kind: "travelto", room: id }));
  }
  // a list that has grown past the cap turns pages, like a long conversation:
  // "more places" (free, wrapping) and the way out stay on every page
  const paging = list.length + 1 > MENU_CAP;
  const pageSize = MENU_CAP - 2;
  const pages = paging ? Math.ceil(list.length / pageSize) : 1;
  const page = paging ? s.travelPage % pages : 0;
  const out = paging ? list.slice(page * pageSize, (page + 1) * pageSize) : list;
  if (paging) out.push({ kind: "travelmore" });
  out.push({ kind: "traveldone" });
  return out;
}

/** How many travel entries wait on the other pages of the current list. */
function travelMore(world: World, s: State): number {
  const known = knownLandmarks(world, s);
  const total = s.travelMenu === ""
    ? travelActions(world, s).filter((a) => a.kind === "travelto" || a.kind === "travelregion").length
    : localTravel(world, s, s.travelMenu ?? "").length;
  const shown = travelActions(world, s).filter((a) => a.kind === "travelto" || a.kind === "travelregion").length;
  return total - shown;
}

// true while a level-up perk pick is blocking the menu — the room's own
// desc/exits don't render during this screen (see format.ts render()), so
// callers deciding whether a room's full description has been "seen" must
// treat this the same as inClassPhase, or a level-up on room entry burns the
// room's one full-desc reveal on a perk menu the player never connects to
// the room they just walked into.
export const inPerkPickPhase = (world: World, s: State): boolean =>
  s.perkPicks > 0 && eligiblePerks(world, s).length > 0;

// ---------- escalating retry ----------
/**
 * The id an escalating check's attempt counter is keyed on: the natural id of
 * whatever action offers it — a room action, a class ability, an npc topic
 * (npc-qualified, since a topic id like "greet" repeats across npcs the same
 * way `said_<npc>_<topicId>` needs it to), or an item's use (item- and
 * target-qualified, since one item can carry more than one use entry).
 * Namespaced by kind (`act:`, `ab:`, `tp:`, `use:`) so two different sources
 * never share a counter even where their bare ids happen to coincide — ids
 * are `[a-z0-9_]` only (docs §2), so `:` can never appear in an authored id
 * and never collides with one.
 *
 * Every other action kind (go, take, attack, classpick, ...) keys to
 * undefined: applyFx only escalates a check when it is handed a sourceId, so
 * an un-keyed check always rolls its authored DC, forever — never a wrong
 * one, never a borrowed one. Room `onEnter`/`onEnterOnce` and an npc's
 * `onDeath` are not offered as a menu Action at all, so they are not covered
 * here; their own call sites key them directly (`enter:`, `enterOnce:`,
 * `death:`), and every other applyFx call site (a companion's remark, a
 * `world.clock` entry) passes no sourceId at all — a check reached from one
 * of those never escalates, on purpose: see docs/authoring.md §4.
 */
function checkSourceId(a: Action): string | undefined {
  switch (a.kind) {
    case "custom":
      return `act:${a.id}`;
    case "ability":
      return `ab:${a.id}`;
    case "talk":
      return `tp:${a.npc}:${a.topic}`;
    case "use":
      return `use:${a.item}:${a.target ?? ""}`;
    default:
      return undefined;
  }
}

/**
 * A check's DC as it actually stands right now: the authored number, raised
 * by one for every failed attempt already logged against this sourceId. The
 * one place this arithmetic is defined — applyFx's `check` case, oddsHint's
 * preview, and checkHereNow all call this, so the number a player is shown
 * before spending a turn and the number the roll is actually compared against
 * can never disagree (see oddsHint's comment on that history). A check with
 * no sourceId never escalates: it reads its authored DC unchanged.
 *
 * Capped so the die can always land it. The design is "you can always keep
 * trying, it just gets worse" — without the cap that stops being true: ten
 * failures on a DC 11 check with no modifier previewed "roll 21+ on the die",
 * which no d20 rolls, while the option stayed on the menu and each further
 * press still charged the standing its own miss branch costs. That is worse
 * than the flat DC it replaced: a preview that had been merely decorative
 * became actively false, and a guaranteed failure kept taking payment. The
 * escalation therefore stops at a natural 20 — still the worst odds in the
 * game at 5%, still possible, and the number shown is still the number rolled
 * against, which is the property the whole preview rests on.
 */
function escalatedDc(s: State, sourceId: string | undefined, baseDc: number, mod = 0): number {
  if (!sourceId) return baseDc;
  // Escalation is for what you force, not for what you say.
  //
  // A lock does get harder as you work at it, and a player who grinds one
  // should feel that. A conversation does not: a topic's check is usually
  // retryable only by walking away and coming back, so escalating it taxes
  // exactly the thing you want a stuck player to do — leave, earn some
  // standing or a rank or a companion's regard, and try again better placed.
  //
  // Two waves called it a trap, and the second named the compound: the
  // companion-dispute checks already cost regard with BOTH companions on a
  // miss, by design, and "failed twice in a row despite ~60% listed odds"
  // with the DC creeping is a spiral with no way out of it. The double cost is
  // the design; the escalation was the addition that broke it.
  if (sourceId.startsWith("tp:")) return baseDc;
  const raised = baseDc + (s.checkAttempts[sourceId] ?? 0);
  // the highest DC this player's die can still meet, on a natural 20
  const reachable = mod + 20;
  // The rule is narrow on purpose: escalation must never carry a check ACROSS
  // the line from reachable to unreachable. A DC the author already put past
  // that line is their deliberate "not without help" and is left alone — this
  // function's job is not to soften an authored number, only to keep its own
  // rise from turning "worse odds" into "no odds".
  return baseDc > reachable ? raised : Math.min(raised, reachable);
}

/**
 * checkSourceId's inverse, best-effort, for the free `status` check (see
 * failedChecks below): a source id back to the label a player would recognize
 * ("ring the saint's bell", "Prior Halm: the saint's bell") and the check's
 * own authored DC (escalatedDc raises it from there). Returns undefined for a
 * source the content no longer carries (edited out from under a saved run)
 * rather than guessing, and for a source whose leading effect is no longer a
 * `check` at all — the label would be honest but the DC would not be.
 */
function checkSource(world: World, sourceId: string): { label: string; baseDc: number; skill: string } | undefined {
  const i = sourceId.indexOf(":");
  const kind = sourceId.slice(0, i);
  const rest = sourceId.slice(i + 1);
  // the DC and the skill both: the escalation cap needs the modifier, and the
  // modifier needs to know which attribute the check reads
  const leading = (fx: Fx[] | undefined): { dc: number; skill: string } | undefined => {
    const c = fx?.[0];
    return c && c[0] === "check" ? { dc: c[2], skill: c[1] } : undefined;
  };
  switch (kind) {
    case "act":
      for (const room of Object.values(world.rooms))
        for (const a of room.actions ?? []) {
          if (a.id !== rest) continue;
          const c = leading(a.fx);
          return c === undefined ? undefined : { label: a.label, baseDc: c.dc, skill: c.skill };
        }
      return undefined;
    case "ab": {
      const a = world.abilities?.[rest];
      const c = leading(a?.fx);
      return a && c ? { label: a.label, baseDc: c.dc, skill: c.skill } : undefined;
    }
    case "tp": {
      const j = rest.indexOf(":");
      const npc = world.npcs[rest.slice(0, j)];
      const topic = npc?.topics?.find((t) => t.id === rest.slice(j + 1));
      const c = leading(topic?.fx);
      return npc && topic && c ? { label: `${npc.name}: ${topic.label}`, baseDc: c.dc, skill: c.skill } : undefined;
    }
    case "use": {
      const j = rest.indexOf(":");
      const itemId = j === -1 ? rest : rest.slice(0, j);
      const target = j === -1 ? undefined : rest.slice(j + 1) || undefined;
      const item = world.items[itemId];
      const use = item?.use?.find((d) => d.target === target && leading(d.fx) !== undefined);
      const c = leading(use?.fx);
      return item && c ? { label: `use ${item.name}`, baseDc: c.dc, skill: c.skill } : undefined;
    }
    default:
      return undefined;
  }
}

/** Most escalating checks worth naming on the free `status` check before the list gives way to a plain count. */
export const FAILED_CHECKS_MAX = 6;

/**
 * Every check the player has failed at least once, worst-tried first — a
 * memory aid for the free `status` check (no turn spent) so a player who has
 * failed something three times can find that out somewhere, the way `status`
 * already lists visited rooms and active conditions. `dc` is the CURRENT,
 * escalated number — the same one the menu preview would quote right now —
 * not the original authored one, so status never states a different figure
 * than the next attempt actually faces.
 */
export function failedChecks(world: World, s: State): { label: string; dc: number; attempts: number }[] {
  const out: { label: string; dc: number; attempts: number }[] = [];
  for (const [id, attempts] of Object.entries(s.checkAttempts ?? {})) {
    if (!attempts) continue;
    const found = checkSource(world, id);
    if (found) out.push({ label: found.label, dc: escalatedDc(s, id, found.baseDc, checkMod(world, s, found.skill)), attempts });
  }
  return out.sort((a, b) => b.attempts - a.attempts);
}

// ---------- effects ----------
function applyFx(world: World, s: State, fxs: Fx[], events: string[], sourceId?: string): void {
  for (const fx of fxs) {
    if (s.ended) return;
    switch (fx[0]) {
      case "say":
        events.push(fx[1]);
        break;
      case "set":
        setFlag(s, fx[1]);
        break;
      case "clear":
        delete s.flags[fx[1]];
        // and forget when it happened, so a flag cleared and set again is
        // measured from the second time — which is what "since" should mean
        // for something the world has undone
        delete s.flagTurn?.[fx[1]];
        break;
      case "score": {
        // No ceiling. `world.maxScore` is what one whole route pays — the
        // walkthrough must reach exactly it, which is how the score economy is
        // proven sound — but it was also a clamp, and the realm authors 7,608
        // points across 1,395 sites. Five per cent of what it offers was
        // payable. Three blind players hit 366 and played on for two hundred
        // more turns earning nothing, having seen eight of eighteen regions:
        // a tally that stops moving tells a player to stop looking, in a realm
        // whose whole point is that there is more of it.
        const before = s.score;
        s.score = Math.max(0, s.score + fx[1]);
        if (s.score > before) events.push(`(+${s.score - before})`);
        break;
      }
      case "hp": {
        const beforeHp = s.hp;
        s.hp = clamp(s.hp + fx[1], 0, s.maxHp);
        const delta = s.hp - beforeHp;
        if (delta !== 0) events.push(`(hp${delta > 0 ? "+" : ""}${delta})`);
        if (s.hp <= 0) {
          s.ended = { kind: "lose", id: "dead", text: "You have died." };
          events.push("You have died.");
        }
        break;
      }
      case "move": {
        const [, item, where] = fx;
        const loc = where === "here" ? s.room : where;
        if (loc === "inv") {
          if (!s.inv.includes(item)) {
            const wieldedBefore = bestWeapon(world, s).item, wornBefore = bestArmor(world, s).item;
            s.inv.push(item);
            s.itemLoc[item] = "inv";
            events.push(`${world.items[item]?.name ?? item}: obtained.`);
            // a reward or a found thing that becomes the best weapon or armor carried says so, as a pickup does
            if (bestWeapon(world, s).item === item && wieldedBefore !== item) events.push(`(You will fight with it now.)`);
            if (bestArmor(world, s).item === item && wornBefore !== item) events.push(`(You will wear it now.)`);
          }
          s.itemLoc[item] = "inv";
        } else {
          s.inv = s.inv.filter((i) => i !== item);
          s.itemLoc[item] = loc;
        }
        break;
      }
      case "goto":
        enterRoom(world, s, fx[1], events);
        break;
      case "npcgo":
        s.npcRoom[fx[1]] = fx[2] === "here" ? s.room : fx[2];
        break;
      case "if":
        applyFx(world, s, condsOk(world, s, fx[1]) ? fx[2] : fx[3], events, sourceId);
        break;
      case "calm":
        calmNpc(world, s, fx[1], events);
        break;
      case "calmhostile":
        // usually exactly one hostile stands here (the realm's own convention — see docs §9), so this
        // reads as "calm the room's hostile" while staying correct for the rare room with more than one
        for (const id of hostilesHere(world, s)) calmNpc(world, s, id, events);
        break;
      case "slay":
        // a scripted end, not a fight: the room reads "(at rest)", not "(dead)"
        s.npcHp[fx[1]] = 0;
        setFlag(s, `laid_${fx[1]}`);
        break;
      case "setvar":
        s.vars[fx[1]] = fx[2];
        break;
      case "addvar": {
        s.vars[fx[1]] = (s.vars[fx[1]] ?? 0) + fx[2];
        const d = fx[2];
        if (d) {
          // coin moves are tagged like score and xp, so a stash found or a price paid is never silent
          if (fx[1] === "gold") events.push(`(${d > 0 ? "+" : ""}${d} gold)`);
          // choices that matter must be legible: a companion at hand says so,
          // and a named faction's standing prints its move
          if (fx[1].startsWith("appr_")) {
            const id = fx[1].slice(5);
            const npc = world.npcs[id];
            if (npc && (s.party.includes(id) || s.npcRoom[id] === s.room) && !npcDead(world, s, id)) {
              events.push(`${npc.name} ${Math.abs(d) > 1 ? "strongly " : ""}${d > 0 ? "approves" : "disapproves"} (${d > 0 ? "+" : ""}${d}).`);
              if (!s.flags["_seenApproval"]) {
                setFlag(s, "_seenApproval");
                events.push("(Companions judge what you do: their regard opens and closes doors; at -2 they are near leaving, and the next thing they mind is the last.)");
              }
            } else if (npc && !npcDead(world, s, id) && (s.visited.includes(npc.room ?? "") || s.flags[`${id}_left`])) {
              // regard moved for someone not here to see it: a player found Osk at -1 with no idea why.
              // Only once they have been met (their home visited, or they walked out) — a name the
              // player has never heard is not news, it is a spoiler that "Lys" exists somewhere
              events.push(`(${npc.name} ${d > 0 ? "+" : ""}${d}, when word reaches them)`);
            }
          } else if (world.factions?.[fx[1]]) {
            events.push(`(${world.factions[fx[1]]} ${d > 0 ? "+" : ""}${d})`);
          }
        }
        break;
      }
      case "check": {
        const [, skill, baseDc, okFx, failFx] = fx;
        // Escalating retry: a check tied to a sourceId (a room action, an
        // ability, an npc topic, an item's use — see checkSourceId) gets 1
        // harder for every failed attempt already logged against it, so the
        // second try at the same obstacle is never the freebie the first was.
        // Un-keyed checks (no sourceId) never escalate and just use baseDc.
        const dc = escalatedDc(s, sourceId, baseDc, checkMod(world, s, String(fx[1])));
        const mod = checkMod(world, s, skill);
        const roll = d20(s);
        const total = roll + mod;
        const ok = total >= dc;
        // Fires once, before the very first check a run ever makes, so the
        // "d20:9+2=11 vs DC 9" notation below isn't the player's first sight
        // of it — a separate leading line (not a prefix on that line) so it
        // can't perturb odds.test.ts's line-anchored regex on the roll event.
        if (!s.flags["_seenCheck"]) {
          setFlag(s, "_seenCheck");
          events.push("(First check: d20 is a 20-sided die roll; DC is the total — roll plus skill — that must reach it.)");
        }
        // States the total vs DC directly (the exact comparison `ok` runs) so
        // there is no derived "needed N+" number to mistranslate back into a
        // total — see oddsHint's comment for the report this replaced. The
        // idiom "(ties win)" got read as being about the raw die roll (e.g.
        // "roll 7 vs DC 10 lost, so ties can't really win"), not the total —
        // spelling the rule out as "(DC+ succeeds)", reusing the DC number
        // already in the line, states the same >= rule without a second,
        // mistranslatable frame. `dc` here is already escalated, so this line
        // and oddsHint's preview of the same attempt never quote two numbers.
        // Only spelled out when more than one thing stacks into `mod` (base
        // plus at least one perk) — a plain attribute-only modifier needs no
        // breakdown, and most checks stay exactly as short as before.
        const parts = checkModParts(world, s, skill);
        const breakdown =
          parts.length > 1 ? ` (${parts.map((p) => `${p.n > 0 ? "+" : ""}${p.n} ${p.label}`).join(", ")})` : "";
        events.push(
          `${skill.toUpperCase()} d20:${roll}+${mod}${breakdown}=${total} vs DC ${dc} (${dc}+ succeeds) — ${ok ? "success" : "fail"}.`,
        );
        // A separate line, not appended to the one above, so it can't perturb
        // odds.test.ts's line-anchored regex on the roll event. Fires only on
        // a fail within 2 of the DC — close enough that a player weighing
        // "try again?" benefits from knowing the attempt nearly landed,
        // distinct from a wide miss that says nothing more.
        if (!ok && dc - total <= 2) events.push(NEAR_MISS_CUES[(roll + s.turn) % NEAR_MISS_CUES.length]!);
        // Only a FAILURE raises the next attempt's DC — a success never
        // resets it either, so a check retried again later (a non-once
        // action a player returns to) keeps counting from its full history,
        // not just its most recent streak.
        if (!ok && sourceId) s.checkAttempts[sourceId] = (s.checkAttempts[sourceId] ?? 0) + 1;
        applyFx(world, s, ok ? okFx : failFx, events, sourceId);
        break;
      }
      case "xp":
        grantXp(world, s, fx[1], events);
        break;
      case "perk":
        grantPerk(world, s, fx[1], events);
        break;
      case "chance": {
        // Silent by itself: the branches carry whatever the player should see.
        // The roll comes from the state's cursor, so a trace replays it exactly.
        const [, pct, okFx, failFx] = fx;
        const roll = d100(s);
        applyFx(world, s, roll <= pct ? okFx : failFx, events, sourceId);
        break;
      }
      case "party": {
        const [, npc, how] = fx;
        const name = world.npcs[npc]?.name ?? npc;
        if (how === "join") {
          if (!s.party.includes(npc)) {
            s.party.push(npc);
            events.push(`${name} joins you.`);
          }
          s.npcRoom[npc] = s.room;
        } else if (s.party.includes(npc)) {
          s.party = s.party.filter((id) => id !== npc);
          events.push(`${name} leaves your company.`);
        }
        break;
      }
      // Applying and clearing a condition are silent by themselves — the HUD
      // tag and status's Conditions line carry it from here on, so an
      // authored `say` right beside the effect is the narration, not a
      // second automatic line saying the same thing.
      case "cond": {
        const [, id, turns] = fx;
        s.conds[id] = Math.max(s.conds[id] ?? 0, turns); // re-applying refreshes to the longer remaining duration
        break;
      }
      case "npccond": {
        const [, npc, id, turns] = fx;
        setNpcCond(s, npc, id, turns);
        break;
      }
      case "condhostile": {
        const [, id, turns] = fx;
        for (const npc of hostilesHere(world, s)) setNpcCond(s, npc, id, turns);
        break;
      }
      case "uncond":
        delete s.conds[fx[1]];
        break;
      case "unnpccond":
        if (s.npcConds[fx[1]]) delete s.npcConds[fx[1]]![fx[2]];
        break;
      case "harm":
        harmNpc(world, s, fx[1], fx[2], events);
        break;
      case "harmhostile":
        for (const id of hostilesHere(world, s)) {
          if (s.ended) break;
          harmNpc(world, s, id, fx[1], events);
        }
        break;
      case "revive":
        reviveDowned(world, s, events);
        break;
      case "bearings":
        events.push(bearingsHere(world, s));
        break;
      /**
       * What the player still has open, by name, at a door that does not open
       * back. The Pass Gate already said "past this gate the holds fall behind
       * you… stays unfinished unless you walk back for it" and all three
       * players of wave six walked through it anyway; one of them named why —
       * "this is stated once in passing dialogue but easy to miss, and
       * irreversible". A sentence is easy to read past. Three of your own
       * quests by name is not.
       */
      case "questsopen": {
        const open = journal(world, s).filter((q) => q.status === "active").length;
        // The count, not the names. Which of them lie *behind* the door is not
        // something the engine can know yet — a quest stage's `at` is new and
        // most stages have none — and naming a thread that is actually ahead of
        // the player would be its own lie. The number is what makes the warning
        // land, and status has the list.
        events.push(
          open
            ? `(${open} threads of yours are still open. Read them in your status before you cross: whichever lie behind you stay open for good.)`
            : "(Nothing of yours is still open. Cross when you like.)",
        );
        break;
      }
      case "sayunvisited": {
        const region = world.rooms[s.room]?.region;
        const names = region
          ? Object.entries(world.rooms)
              .filter(([id, r]) => r.region === region && r.landmark && !s.visited.includes(id))
              .map(([, r]) => r.landmark!)
          : [];
        events.push(names.length ? `Not yet seen near here: ${names.join(", ")}.` : "You have found every place marked hereabouts.");
        break;
      }
      case "end":
        s.ended = { kind: fx[1], id: fx[2], text: fx[3] };
        break;
    }
  }
}

function enterRoom(world: World, s: State, roomId: string, events: string[]): void {
  s.room = roomId;
  s.roomPage = 0; // a new room opens on its first page
  // the party keeps pace: every living companion arrives with the player
  for (const id of s.party) if (!npcDead(world, s, id)) s.npcRoom[id] = roomId;
  const room = world.rooms[roomId];
  if (!room) return;
  const first = !s.visited.includes(roomId);
  if (first) s.visited.push(roomId);
  // keyed by room id (distinct keys: onEnterOnce fires at most once ever, so
  // its own check — if it ever authors one — can never actually escalate;
  // onEnter is the repeatable one a player could retry by walking out and in)
  if (first && room.onEnterOnce) applyFx(world, s, room.onEnterOnce, events, `enterOnce:${roomId}`);
  if (room.onEnter) applyFx(world, s, room.onEnter, events, `enter:${roomId}`);
}

/**
 * The company's turn to speak. Farewells are never capped: a companion who
 * has had enough always says so and walks, in party order, however many that
 * is this turn — a desertion held back a turn would read as a companion who
 * changed their mind. Remarks are: one for the whole party a turn, not one
 * each, so a five- (soon more) companion screen never floods with banter. A
 * remark that moves regard (or anything else) still cuts ahead of a plain
 * one; among same-tier candidates, a rotating start — advanced once a turn,
 * never touching the dice, so combat and checks replay unchanged — decides
 * who speaks, so the same voice doesn't win the slot every time. Runs after
 * the turn's own effects, so a remark can react to the very choice just made.
 */
function partyRemarks(world: World, s: State, events: string[]): void {
  for (const id of [...s.party]) {
    if (s.ended) return;
    const def = world.npcs[id];
    if (!def || npcDead(world, s, id)) continue;
    // a companion who has had enough walks out before anyone gets a remark in
    const gone = def.companion?.leaves?.find((l) => condsOk(world, s, l.if));
    if (!gone) continue;
    events.push(speaks(def.name, gone.say));
    s.party = s.party.filter((x) => x !== id);
    setFlag(s, `${id}_left`);
    events.push(`${def.name} leaves your company.`);
  }
  if (s.ended || s.party.length === 0) return;

  // one remark a turn, for the whole company: gather each companion's own
  // top pick (their own fx-first priority, same as always), starting the
  // scan from a rotating index so no single companion has first claim every
  // turn, then let any fx-carrying pick win over every plain one
  const order = s.party;
  const start = (s.vars["_remarkRot"] = ((s.vars["_remarkRot"] ?? 0) + 1) % order.length);
  const candidates: { id: string; def: NpcDef; r: RemarkDef }[] = [];
  for (let i = 0; i < order.length; i++) {
    const id = order[(start + i) % order.length]!;
    const def = world.npcs[id];
    if (!def || npcDead(world, s, id)) continue;
    const ready = (def.companion?.remarks ?? []).filter((r) => !s.flags[`remarked_${id}_${r.id}`] && condsOk(world, s, r.if));
    const top = [...ready.filter((r) => r.fx?.length), ...ready.filter((r) => !r.fx?.length)][0];
    if (top) candidates.push({ id, def, r: top });
  }
  const win = candidates.find((c) => c.r.fx?.length) ?? candidates[0];
  if (!win) return;
  setFlag(s, `remarked_${win.id}_${win.r.id}`);
  events.push(speaks(win.def.name, win.r.say));
  // no sourceId: a remark is spoken once ever (the flag just above), so a
  // check inside its fx could never be retried anyway — escalation would
  // have nothing to key correctly to, and this stays consistent with every
  // other applyFx call this file leaves unkeyed on purpose (see checkSourceId)
  if (win.r.fx) applyFx(world, s, win.r.fx, events);
  // a remark that opens a quarrel between two companions says where the
  // answer is: the sides and the settling live in their conversations
  for (const fx of win.r.fx ?? []) {
    const m = fx[0] === "set" ? /^quarrel_([a-z]+)_([a-z]+)(?:_([a-z]+))?$/.exec(fx[1]) : null;
    if (!m || QUARREL_TAILS.has(m[3] ?? "")) continue;
    const a = world.npcs[m[1]!]?.name, b = world.npcs[m[2]!]?.name;
    if (a && b) events.push(`(Speak with ${a} or ${b} to take a side, or to tell them to settle it.)`);
  }
}

/** An npc hits the player once: armor soaks what it can, at least 1 gets through. */
/** Party members who can still take a blow: alive, here, and not already down. */
function standingCompanions(world: World, s: State): string[] {
  return s.party.filter(
    (id) => world.npcs[id]?.companion && !npcDead(world, s, id) && s.npcRoom[id] === s.room && !s.flags[`down_${id}`],
  );
}

/**
 * A blow lands on a companion instead of the player. Companions have no armor;
 * one who would drop to nothing falls back out of the fight (flag `down_<id>`,
 * hp held at 1) and gets up again, shaken, once no aggressive thing is left in
 * the room. Nobody dies of it: a companion's death is content's to write.
 */
function companionStruck(world: World, s: State, def: NpcDef, id: string, events: string[], verb: string): void {
  const c = world.npcs[id]!;
  const max = c.hp ?? 1;
  const hp = (s.npcHp[id] ?? max) - (def.atk ?? 1);
  if (hp <= 0) {
    s.npcHp[id] = 1;
    setFlag(s, `down_${id}`);
    setFlag(s, `fell_${id}`); // stays set: a remark or an epilogue line can recall the day they went down
    events.push(`${TheName(def.name)} ${verb} at ${c.name} — ${c.name} goes down, and crawls clear of the fight.`);
    return;
  }
  s.npcHp[id] = hp;
  events.push(
    hp <= 2
      ? `${TheName(def.name)} ${verb} at ${c.name} (-${def.atk}hp) — ${c.name} staggers, ${hp}/${max} left.`
      : `${TheName(def.name)} ${verb} at ${c.name} (-${def.atk}hp, ${hp}/${max} left).`,
  );
}

/** Downed companions get up once the room holds nothing aggressive and alive, at half their strength. */
function recoverDowned(world: World, s: State, events: string[], attacked: string | null): void {
  // the fight is still on while something aggressive stands here, or while the player is trading blows
  const hostile = Object.keys(world.npcs).some(
    (id) => aggressiveNow(world, s, id) && !s.party.includes(id) && s.npcRoom[id] === s.room && !npcDead(world, s, id),
  );
  if (hostile || attacked) return;
  reviveDowned(world, s, events);
}

/**
 * Every party member currently down (flag `down_<id>`) gets back up, at half
 * their max hp (never lower than they already sit at) — the shared math
 * behind both `recoverDowned` (automatic, once nothing aggressive remains)
 * and the `revive` effect (an ability that gets a companion up mid-fight).
 */
function reviveDowned(world: World, s: State, events: string[]): void {
  for (const id of s.party) {
    if (!s.flags[`down_${id}`]) continue;
    const c = world.npcs[id]!;
    delete s.flags[`down_${id}`];
    s.npcHp[id] = Math.max(s.npcHp[id] ?? 1, Math.ceil((c.hp ?? 1) / 2));
    events.push(`${c.name} is back on their feet, shaken.`);
  }
}

/**
 * A "rest": the first positive `hp` entry in an fx list heals the company
 * (every living companion standing here) by the same measure, and refreshes
 * every ability-resource pool to full — reused by any fx-running action, a
 * room's or an ability's, so no inn needs separate authoring for the two.
 * "Refresh" means set to full, not add.
 */
function applyRest(world: World, s: State, fxs: Fx[], events: string[]): void {
  const rest = fxs.find((f) => f[0] === "hp" && f[1] > 0);
  if (!rest || s.ended) return;
  for (const id of s.party) {
    const def = world.npcs[id];
    if (!def?.companion || npcDead(world, s, id) || s.npcRoom[id] !== s.room) continue;
    const max = def.hp ?? 1;
    const before = s.npcHp[id] ?? max;
    const after = Math.min(max, before + (rest[1] as number));
    if (after > before) {
      s.npcHp[id] = after;
      events.push(`(${def.name} hp+${after - before}, ${after}/${max})`);
    }
  }
  for (const [v, full] of Object.entries(world.resources ?? {})) s.vars[v] = full;
}

/**
 * The exits of this room that are still shut, named the way the "leave it be"
 * line names them — because standing something down is not a key either.
 *
 * "" when nothing here is locked. Wave seven, seed 8801: "Pacifying a hostile
 * creature with 'name it' sets it to 'stood down' but the blocked passage still
 * requires a second explicit interaction to actually open — the stand-down
 * message implies the path is clear when it isn't." The wide-berth line learned
 * this two waves earlier; `calm` never did, and now that a Scholar is actually
 * offered `name it` on a third of that road's fights, players meet it.
 */
function lockedWaysHere(world: World, s: State): string {
  const locked = Object.entries(world.rooms[s.room]?.exits ?? {}).filter(([, e]) => e.if && !condsOk(world, s, e.if));
  if (!locked.length) return "";
  return locked.map(([dir, e]) => `the way ${dir} stays locked${e.hint ? ` (${e.hint})` : ""}`).join(", and ");
}

/** A hostile stands down for good — the `calm` effect. No longer blocks travel, reads "stood down", listed last as an attack target. */
function calmNpc(world: World, s: State, npcId: string, events: string[]): void {
  if (s.flags[`calm_${npcId}`]) return;
  setFlag(s, `calm_${npcId}`);
  const who = world.npcs[npcId];
  if (!who || s.npcRoom[npcId] !== s.room || npcDead(world, s, npcId)) return;
  const ways = lockedWaysHere(world, s);
  events.push(ways ? `${TheName(who.name)} stands down; ${ways}.` : `${TheName(who.name)} stands down.`);
}

/** Put a timed condition on an npc — the `npccond` effect. Re-applying refreshes to the longer remaining duration. */
function setNpcCond(s: State, npcId: string, condId: string, turns: number): void {
  const conds = (s.npcConds[npcId] ??= {});
  conds[condId] = Math.max(conds[condId] ?? 0, turns);
}

/**
 * n damage to an npc outside a roll — the `harm` effect. Runs onDeath exactly
 * once when hp drops to 0 or below, just like a killing attack; safe when the
 * npc is absent or already dead (no double death, no further loss on a
 * corpse). A negative n heals instead.
 */
function harmNpc(world: World, s: State, npcId: string, n: number, events: string[]): void {
  const def = world.npcs[npcId];
  if (!def || npcDead(world, s, npcId)) return;
  const before = s.npcHp[npcId] ?? def.hp ?? 1;
  const after = before - n;
  s.npcHp[npcId] = after;
  if (n > 0) {
    const leftText = after > 0 ? `, ${after}/${def.hp ?? 1}hp left` : "";
    events.push(`${TheName(def.name)} takes ${n} damage${leftText}.`);
  } else if (n < 0) {
    events.push(`${TheName(def.name)} recovers ${-n} hp.`);
  }
  if (after <= 0) {
    events.push(`${TheName(def.name)} is destroyed.`);
    // keyed by npc id; an npc dies at most once, so a check inside onDeath
    // (none exist today) could never actually retry, but is keyed anyway
    // for consistency with attack's own onDeath call in step()
    if (def.onDeath) applyFx(world, s, def.onDeath, events, `death:${npcId}`);
  }
}

function npcStrike(world: World, s: State, npcId: string, events: string[], verb: string): void {
  const def = world.npcs[npcId];
  if (!def?.atk) return;
  // blows rotate between the player and the companions standing with them, in
  // order, with no die involved: the same fight replays the same way
  const standing = standingCompanions(world, s);
  const nth = s.vars["_strikes"] ?? 0;
  s.vars["_strikes"] = nth + 1;
  const pick = nth % (1 + standing.length);
  if (pick > 0) {
    companionStruck(world, s, def, standing[pick - 1]!, events, verb);
    return;
  }
  // a condition it carries (e.g. "braced") can sharpen or dull the blow itself
  const atk = def.atk + npcCondBonus(world, s, npcId, "hit");
  const armor = def.pierce ? 0 : armorOf(world, s);
  const taken = Math.max(1, atk - armor);
  const absorbed = atk - taken;
  events.push(
    absorbed > 0
      ? `${TheName(def.name)} ${verb} — your armor takes ${absorbed} of it.`
      : def.pierce && armorOf(world, s) > 0
        ? `${TheName(def.name)} ${verb} — your armor means nothing to it.`
        : `${TheName(def.name)} ${verb}.`,
  );
  applyFx(world, s, [["hp", -taken]], events);
}

/**
 * Aggressive npcs get their turn: everything alive, aggressive, and in the
 * player's room strikes once the player's action has resolved — except the
 * one the player just attacked, which already struck back. Companions never
 * count, and a dead player ends it.
 */
function aggressivePass(world: World, s: State, events: string[], except: string | null): void {
  for (const id of Object.keys(world.npcs)) {
    if (s.ended) return;
    const def = world.npcs[id]!;
    if (!aggressiveNow(world, s, id) || id === except || s.party.includes(id)) continue;
    if (s.npcRoom[id] !== s.room || npcDead(world, s, id)) continue;
    // a player who just broke away from this one (the "leave" case's parting
    // strike) bought a few quiet turns — DISENGAGE_COND, not a fresh flag, so
    // it counts down and clears itself the same way every other condition does
    if (s.npcConds[id]?.[DISENGAGE_COND]) continue;
    npcStrike(world, s, id, events, "attacks");
  }
}

/**
 * Every condition — the player's, every npc's — ticks down by one at the end
 * of a spent turn (step() calls this only when spentTurn: a free look, a menu
 * page, or a wide berth given ticks nothing). The player's hpPerTurn applies
 * first, through the same "hp" effect a fight or a trap would use, so it can
 * end the game exactly like any other loss of hp; once that happens nothing
 * else here runs. A condition that reaches zero turns is dropped and prints
 * one short event — render() wraps it in its usual brackets, so a quiet turn
 * reads exactly as "[winded passes.]".
 */
function tickConditions(world: World, s: State, events: string[]): void {
  if (s.ended) return; // already over this turn (a fight, a trap): nothing more to tick
  let hpDelta = 0;
  for (const id of Object.keys(s.conds)) hpDelta += world.conditions?.[id]?.hpPerTurn ?? 0;
  if (hpDelta) applyFx(world, s, [["hp", hpDelta]], events);
  if (s.ended) return; // hpPerTurn just killed the player: no more ticking this turn
  for (const id of Object.keys(s.conds)) {
    const left = (s.conds[id] ?? 0) - 1;
    if (left <= 0) {
      delete s.conds[id];
      events.push(`${world.conditions?.[id]?.name ?? id} passes.`);
    } else {
      s.conds[id] = left;
    }
  }
  for (const npcId of Object.keys(s.npcConds)) {
    const conds = s.npcConds[npcId];
    if (!conds) continue;
    const dead = npcDead(world, s, npcId);
    for (const id of Object.keys(conds)) {
      const left = (conds[id] ?? 0) - 1;
      if (left <= 0) {
        delete conds[id];
        const npc = world.npcs[npcId];
        if (npc && !dead) events.push(`${world.conditions?.[id]?.name ?? id} fades from ${theName(npc.name)}.`);
      } else {
        conds[id] = left;
      }
    }
    if (!Object.keys(conds).length) delete s.npcConds[npcId];
  }
}

/**
 * The realm's own turn: `world.clock` runs once per spent turn, after the
 * player's action, the aggressive pass, and conditions have ticked (step()
 * calls this only when spentTurn, exactly like tickConditions). Entries are
 * checked in file order; the first whose `if` passes — and, if it carries
 * `once`, has not already fired — runs its `fx` and the rest wait for a
 * later turn. At most one entry fires per turn: that single rule is what
 * keeps a turn's clock line to at most one sentence, never a digest. A
 * `once` entry sets `clocked_<id>`, exactly like a room action's `did_<id>`.
 * `fx` are ordinary effects run through the same applyFx as everything else
 * — no new effect vocabulary, so a clock entry can `say`, `set`, `addvar`,
 * `npcgo`, `goto`, branch on `if`, draw from `chance` (the state's PRNG
 * cursor, replay-safe like every other roll), or `end` the game outright.
 */
function tickClock(world: World, s: State, events: string[]): void {
  if (s.ended) return; // the turn already ended (a fight, hpPerTurn, a trap): the realm does not also get a turn
  for (const entry of world.clock ?? []) {
    if (entry.once && s.flags[`clocked_${entry.id}`]) continue;
    if (!condsOk(world, s, entry.if)) continue;
    if (entry.once) setFlag(s, `clocked_${entry.id}`);
    // no sourceId: the realm's own turn, not a menu choice a player retries —
    // a check here (none exist today) would escalate against the world's
    // clock, which is not what "you tried this and it got harder" means
    applyFx(world, s, entry.fx, events);
    break; // at most one clock entry fires per turn, whatever else was eligible
  }
}

// ---------- initial state ----------
export function newState(world: World, seed: number): StepOut {
  const s: State = {
    seed,
    rngA: mix(seed),
    turn: 0,
    room: world.start,
    hp: world.hp,
    maxHp: world.hp,
    score: 0,
    classId: null,
    attrs: {},
    perks: [],
    xp: 0,
    level: 1,
    perkPicks: 0,
    inv: [],
    flags: {},
    vars: {},
    itemLoc: Object.fromEntries(Object.entries(world.items).map(([id, d]) => [id, d.loc])),
    npcHp: Object.fromEntries(Object.entries(world.npcs).map(([id, d]) => [id, d.hp ?? 1])),
    npcRoom: Object.fromEntries(Object.entries(world.npcs).map(([id, d]) => [id, d.room])),
    conds: {},
    npcConds: {},
    checkAttempts: {},
    flagTurn: {},
    visited: [],
    party: [],
    talking: null,
    travelMenu: null,
    companyMenu: false,
    talkPage: 0,
    roomPage: 0,
    travelPage: 0,
    ended: null,
  };
  for (const id of Object.keys(world.items)) if (s.itemLoc[id] === "inv") s.inv.push(id);
  for (const [v, full] of Object.entries(world.resources ?? {})) s.vars[v] = full; // ability pools start full
  const events: string[] = [];
  // with classes, the start room waits until the player picks who they are
  if (!inClassPhase(world, s)) enterRoom(world, s, world.start, events);
  return { state: s, events };
}

// ---------- legal actions ----------
function npcsHere(world: World, s: State): string[] {
  // `for...in` over the same object rather than Object.keys().filter(): the
  // order is identical and the throwaway array of every npc in the realm is not
  // built once per menu.
  if (menuMemo?.here) return menuMemo.here;
  const out: string[] = [];
  for (const id in world.npcs) if (s.npcRoom[id] === s.room && !npcDead(world, s, id)) out.push(id);
  if (menuMemo) menuMemo.here = out;
  return out;
}

/** Items lying here that a player could pick up — the only question the menu asks of an item's whereabouts. */
function takeablesHere(world: World, s: State): string[] {
  if (menuMemo?.takeables) return menuMemo.takeables;
  const out = indexOf(world).takeable.filter((id) => s.itemLoc[id] === s.room);
  if (menuMemo) menuMemo.takeables = out;
  return out;
}

function customVisible(world: World, s: State, a: CustomAction): boolean {
  if (a.once && s.flags[`did_${a.id}`]) return false;
  return condsOk(world, s, a.if);
}

function topicVisible(world: World, s: State, npc: string, t: TopicDef): boolean {
  if (t.once && s.flags[`said_${npc}_${t.id}`]) return false;
  return condsOk(world, s, t.if);
}

function visibleTopics(world: World, s: State, npc: string): TopicDef[] {
  return (world.npcs[npc]?.topics ?? []).filter((t) => topicVisible(world, s, npc, t));
}

/**
 * True when a currently-visible room action or npc topic previews a `check`
 * of this skill at dc >= min — the "checkHere" cond, for an ability that buys
 * a check and should stay off the menu where there is nothing (hard enough)
 * to spend it on. Scans room actions and topics directly, the same visibility
 * rules legalActions uses, rather than calling legalActions itself, so an
 * ability's own `if` can use this without recursing into the menu that offers
 * abilities in the first place.
 */
function checkHereNow(world: World, s: State, skill: string, min: number): boolean {
  // dc >= min is asked of the check as it actually stands right now — a prior
  // failed attempt already escalated it, and a check hard enough only because
  // of that is still, honestly, hard enough
  // the same check the menu previews (see leadingCheck): the one this option
  // will actually roll, whether it leads the effect list or heads the branch of
  // a leading `if` that holds now
  const firstIsHardCheck = (fx: Fx[] | undefined, sourceId: string | undefined) => {
    const chk = leadingCheck(world, s, fx);
    return !!chk && chk[1] === skill && escalatedDc(s, sourceId, chk[2], checkMod(world, s, String(chk[1]))) >= min;
  };
  for (const a of world.rooms[s.room]?.actions ?? [])
    if (customVisible(world, s, a) && firstIsHardCheck(a.fx, `act:${a.id}`)) return true;
  for (const npc of npcsHere(world, s))
    for (const t of visibleTopics(world, s, npc)) if (firstIsHardCheck(t.fx, `tp:${npc}:${t.id}`)) return true;
  return false;
}

/** An ability from world.abilities is offered when its `if` holds and, for a combat one, only while a live hostile stands here — mirrors customVisible. */
function abilityVisible(world: World, s: State, id: string, a: AbilityDef): boolean {
  if (a.once && s.flags[`did_${id}`]) return false;
  if (a.context === "combat" && !hostilesHere(world, s).length) return false;
  return condsOk(world, s, a.if);
}

/**
 * True while a conversation is open with an npc who is still here, alive, and
 * has something left to say. The menu is then that npc's topics plus "end
 * conversation" — the room's own menu waits (see format.ts render()).
 */
export const inTalkMode = (world: World, s: State): boolean =>
  s.talking !== null &&
  s.npcRoom[s.talking] === s.room &&
  !npcDead(world, s, s.talking) &&
  visibleTopics(world, s, s.talking).length > 0;

/** The owner of an item, if they stand alive in the player's room to see it go. */
function ownerWatching(world: World, s: State, owner: string): NpcDef | null {
  const def = world.npcs[owner];
  if (!def || s.npcRoom[owner] !== s.room || npcDead(world, s, owner) || s.party.includes(owner)) return null;
  return def;
}

/** True when an effect list counts a hollow rested or burned somewhere inside it. */
function fxSettlesHollow(fxs: Fx[] | undefined): boolean {
  return hollowRoute(fxs) !== null;
}

/**
 * Which way an effect list settles a hold's grief — "rests it", "a bargain"
 * or "burns it" — read from the `<code>_hollow_rested|bargained|burned` flag
 * it sets, else from the tally it feeds; null when it settles nothing. Said in
 * the menu, so a player keeping to one road can tell the three apart.
 */
function hollowRoute(fxs: Fx[] | undefined): string | null {
  let tally: string | null = null;
  for (const fx of fxs ?? []) {
    if (fx[0] === "set") {
      const m = /_hollow_(rested|bargained|burned)$/.exec(fx[1]);
      if (m) return m[1] === "rested" ? "rests it" : m[1] === "bargained" ? "a bargain: quieter, not rested" : "burns it";
    }
    if (fx[0] === "addvar" && fx[1] === "hollows_burned") tally = "burns it";
    if (fx[0] === "addvar" && fx[1] === "hollows_rested" && !tally) tally = "rests it";
    const inner =
      fx[0] === "if" ? hollowRoute(fx[2]) ?? hollowRoute(fx[3])
      : fx[0] === "check" ? hollowRoute(fx[3]) ?? hollowRoute(fx[4])
      : fx[0] === "chance" ? hollowRoute(fx[2]) ?? hollowRoute(fx[3])
      : null;
    if (inner) return inner;
  }
  return tally;
}

/** The standing vars (`rep_*`, `appr_*`) an effect list can lower, in order of appearance. */
/**
 * The check this option will actually roll first, or undefined.
 *
 * Usually the option's leading effect, and for 575 of the realm's 581 checks
 * that is the whole story. Six sit at the head of a leading `if` instead —
 * "run the sacks past the tithe (will)" rolls a DC 10 will check unless you
 * have already read the gap's own rhythm, in which case it does not roll at
 * all — and those previewed nothing, so the option said "(will)" in its label
 * and named no DC, and said "(will)" just the same to a player who could no
 * longer fail.
 *
 * Followed the way `regardMoves` and `partyLeaves` follow one: down the branch
 * whose conditions hold *now*, so the preview is what will happen and not what
 * might. Never into a `check`'s or a `chance`'s own branches — those are past
 * the first roll, and a preview that is sometimes wrong is worse than none.
 */
type CheckFx = ["check", string, number, Fx[], Fx[]];
function leadingCheck(world: World, s: State, fxs: Fx[] | undefined): CheckFx | undefined {
  const head = fxs?.[0];
  if (!head) return undefined;
  if (head[0] === "check") return head as CheckFx;
  if (head[0] === "if") return leadingCheck(world, s, (condsOk(world, s, head[1]) ? head[2] : head[3]) ?? []);
  return undefined;
}

function standingAtRisk(world: World, s: State, fxs: Fx[] | undefined): string[] {
  const out: string[] = [];
  for (const fx of fxs ?? []) {
    if (fx[0] === "addvar" && fx[2] < 0 && (fx[1].startsWith("rep_") || fx[1].startsWith("appr_"))) out.push(fx[1]);
    // Only the branch that would run, the way `regardMoves`, `partyLeaves` and
    // `leadingCheck` follow one. A failure taxed once is good design — press
    // Preceptor Aldous on the Hundred and miss, and the chapterhouse marks it
    // once, never again — but the preview said "a miss costs standing with the
    // Ironbound" on the second try too, while the escalating DC climbed. A
    // wave-seven player read those two together as "a cost is still being
    // tracked", and they were right to: the line promised one.
    if (fx[0] === "if") out.push(...standingAtRisk(world, s, (condsOk(world, s, fx[1]) ? fx[2] : fx[3]) ?? []));
    if (fx[0] === "check") out.push(...standingAtRisk(world, s, fx[3]), ...standingAtRisk(world, s, fx[4]));
    if (fx[0] === "chance") out.push(...standingAtRisk(world, s, fx[2]), ...standingAtRisk(world, s, fx[3]));
  }
  return [...new Set(out)];
}

/** Regard an effect list moves outright as things stand: top-level `addvar appr_*`, and inside an `if` whose branch would run now. */
/**
 * Companions this action sends away, as things stand.
 *
 * A player at the Oath-Ground read "(Tamsin +1, Brother Osk -1, Vell -2)",
 * swore the oath, and lost Vell outright: "did not warn that Vell would
 * actually leave the party as a mechanical consequence, not just lose regard.
 * Had to spend an extra turn re-recruiting them." Regard is a number that goes
 * back up; a companion walking out is not, and the preview said the same kind
 * of thing about both.
 *
 * Scanned the way `regardMoves` scans — following the branch of an `if` whose
 * conditions hold now, so the line says what will happen rather than what might
 * — which is what reaches this one: the departure sits behind `if inParty vell`.
 * A departure behind a die (`check`, `chance`) is deliberately not previewed:
 * this line is a fact about the choice, not a guess about the roll.
 */
function partyLeaves(world: World, s: State, fxs: Fx[] | undefined): string[] {
  const out: string[] = [];
  for (const fx of fxs ?? []) {
    if (fx[0] === "party" && fx[2] === "leave" && s.party.includes(fx[1])) out.push(fx[1]);
    if (fx[0] === "if") out.push(...partyLeaves(world, s, (condsOk(world, s, fx[1]) ? fx[2] : fx[3]) ?? []));
  }
  return out;
}

/**
 * The clause that warns a companion walks out over this, phrased the way
 * `costsStandingHint` phrases a standing cost — because the roll matters: at
 * the Oath-Ground, one road loses Vell outright and the other loses them only
 * if you *pass* the check, and "swear it and they may go" is a different choice
 * from "swear it and they will".
 *
 * `talkingTo` is the npc whose conversation this option belongs to, if any. The
 * realm's five "wait here (leaves the party for now)" lines are a dismissal —
 * you sending them away, already said in the label — and not news.
 */
function partyLeavesHint(world: World, s: State, fx: Fx[] | undefined, chk: Fx | undefined, talkingTo?: string): string | null {
  const name = (id: string) => world.npcs[id]?.name ?? id;
  const list = (ids: string[]) => {
    const names = [...new Set(ids)].filter((id) => id !== talkingTo).map(name);
    return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0] ?? "";
  };
  const verb = (ids: string[]) => (new Set(ids.filter((id) => id !== talkingTo)).size > 1 ? "walk out" : "walks out");
  // the unconditional road: everything but the check's own two branches
  const flat = partyLeaves(world, s, fx);
  if (chk && chk[0] === "check") {
    const hit = partyLeaves(world, s, chk[3]), miss = partyLeaves(world, s, chk[4]);
    const both = hit.filter((id) => miss.includes(id));
    const hitOnly = hit.filter((id) => !both.includes(id)), missOnly = miss.filter((id) => !both.includes(id));
    const parts: string[] = [];
    for (const [ids, when] of [[[...flat, ...both], ""], [hitOnly, ", even if you succeed"], [missOnly, " if you fail"]] as [string[], string][]) {
      const who = list(ids);
      if (who) parts.push(`${who} ${verb(ids)}${when}`);
    }
    return parts.length ? parts.join("; ") : null;
  }
  const who = list(flat);
  return who ? `${who} ${verb(flat)}` : null;
}

function regardMoves(world: World, s: State, fxs: Fx[]): ["addvar", string, number][] {
  const out: ["addvar", string, number][] = [];
  for (const fx of fxs) {
    if (fx[0] === "addvar" && fx[1].startsWith("appr_") && fx[2] !== 0) out.push(fx);
    if (fx[0] === "if") out.push(...regardMoves(world, s, (condsOk(world, s, fx[1]) ? fx[2] : fx[3]) ?? []));
  }
  return out;
}

/** Factions an effect list lowers outright as things stand: top-level `addvar rep_* < 0`, and inside an `if` whose branch would run now. */
function outrightCosts(world: World, s: State, fxs: Fx[]): string[] {
  const out: string[] = [];
  for (const fx of fxs) {
    if (fx[0] === "addvar" && fx[2] < 0 && fx[1].startsWith("rep_") && world.factions?.[fx[1]]) out.push(world.factions[fx[1]]!);
    if (fx[0] === "if") out.push(...outrightCosts(world, s, (condsOk(world, s, fx[1]) ? fx[2] : fx[3]) ?? []));
  }
  return [...new Set(out)];
}

/** A companion the player has met: in the party, their home visited, or walked out on the player. A name never heard is a spoiler, not news. */
function companionMet(world: World, s: State, id: string): boolean {
  const npc = world.npcs[id];
  return !!npc && !npcDead(world, s, id) && (s.party.includes(id) || s.visited.includes(npc.room ?? "") || !!s.flags[`${id}_left`]);
}

/** "a kill: Lys -1; a kill costs standing with the Watch" — what an npc's death would cost in regard (companions met) and standing. */
function killCostHint(world: World, s: State, fxs: Fx[] | undefined): string | null {
  const regard: string[] = [];
  const standing: string[] = [];
  const visit = (list: Fx[] | undefined) => {
    for (const fx of list ?? []) {
      if (fx[0] === "addvar" && fx[2] < 0) {
        if (fx[1].startsWith("appr_")) {
          const id = fx[1].slice(5);
          if (companionMet(world, s, id)) regard.push(`${world.npcs[id]!.name} ${fx[2]}`);
        } else if (fx[1].startsWith("rep_") && world.factions?.[fx[1]]) standing.push(world.factions[fx[1]]!);
      }
      if (fx[0] === "if") {
        visit(fx[2]);
        visit(fx[3]);
      }
    }
  };
  visit(fxs);
  const parts: string[] = [];
  if (regard.length) parts.push(`a kill: ${[...new Set(regard)].join(", ")}`);
  if (standing.length) parts.push(`a kill costs standing with ${[...new Set(standing)].join(" and ")}`);
  return parts.length ? parts.join("; ") : null;
}

/** "a miss costs standing with the Gray Church" — names what a check's miss would cost, and what its hit would, when the world names it. */
function costsStandingHint(world: World, s: State, missFx: Fx[] | undefined, hitFx?: Fx[] | undefined): string | null {
  const name = (v: string) => (v.startsWith("rep_") ? world.factions?.[v] : world.npcs[v.slice(5)]?.name);
  const withList = (vars: string[]): string => {
    const names = vars.map(name).filter((n): n is string => !!n);
    if (!names.length) return "";
    return ` with ${names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names[0]!}`;
  };
  const miss = standingAtRisk(world, s, missFx), hit = standingAtRisk(world, s, hitFx);
  const both = miss.filter((v) => hit.includes(v));
  const missOnly = miss.filter((v) => !both.includes(v)), hitOnly = hit.filter((v) => !both.includes(v));
  const parts: string[] = [];
  if (both.length) parts.push(`costs standing${withList(both)}, hit or miss`);
  if (missOnly.length) parts.push(`a miss costs standing${withList(missOnly)}`);
  if (hitOnly.length) parts.push(`a hit costs standing${withList(hitOnly)}`);
  return parts.length ? parts.join("; ") : null;
}

/**
 * How much of an ability pool an ability's own `fx` actually spends: its own
 * `["addvar", pool, -n]` where `pool` names a `world.resources` entry.
 * Nothing in the DSL declares "this is the cost" any more explicitly than
 * that — the same two places (this, and the matching `if` gate) `status`
 * already reads a pool's owner off (see format.ts's renderStatus) — so this
 * reads it off the same spot rather than inventing a field only oddsHint
 * would use. Playtest finding: an ability's menu line said what it did but
 * never what spending it cost, so a Warden learned a pool was empty from an
 * option's absence, not from being told.
 */
function abilityCost(world: World, fx: Fx[] | undefined): { pool: string; n: number } | undefined {
  for (const f of fx ?? []) {
    if (f[0] === "addvar" && f[2] < 0 && world.resources && f[1] in world.resources) return { pool: f[1], n: -f[2] };
  }
  return undefined;
}

/** True when an effect list can end the game somewhere inside it. */
function fxEnds(fxs: Fx[] | undefined): boolean {
  for (const fx of fxs ?? []) {
    if (fx[0] === "end") return true;
    if (fx[0] === "if" && (fxEnds(fx[2]) || fxEnds(fx[3]))) return true;
    if (fx[0] === "check" && (fxEnds(fx[3]) || fxEnds(fx[4]))) return true;
    if (fx[0] === "chance" && (fxEnds(fx[2]) || fxEnds(fx[3]))) return true;
  }
  return false;
}

/** A topic whose effects send someone out of the party. */
const partsWays = (t: TopicDef): boolean => (t.fx ?? []).some((f) => f[0] === "party" && f[2] === "leave");

/** Has any topic of this npc's been said? (the "said_<npc>_<topic>" flags) */
function spokenWith(s: State, npc: string): boolean {
  const prefix = `said_${npc}_`;
  for (const f of Object.keys(s.flags)) if (f.startsWith(prefix)) return true;
  return false;
}

/**
 * The menu as the player sees it: at most MENU_CAP entries, a crowded room's
 * later options behind "more here".
 *
 * Numbering is by position in this list, so paging has to happen here rather
 * than in the renderer — but what a room *offers* is not a matter of which page
 * is showing, so `allActions` is the list `step` and `actionByLabel` judge
 * against. Turning a page changes what you can see, never what you could do.
 */
export function legalActions(world: World, s: State): Action[] {
  const { all, ways } = withMenuMemo(() => roomMenu(world, s));
  return pageRoom(s, all, ways);
}

/**
 * The number each entry of `legalActions` shows, which is its place in the
 * room's whole option list rather than its place on the page.
 *
 * Two blind players took actions they did not mean to because of this. "'use
 * dried herbs' silently consumed the item on a page where I meant to pick a
 * different numbered option"; "'use a sealed letter' occupied the same
 * numbered slot a movement option had held on a previous page". Numbering each
 * page from 1 meant a number stood for two different things in one room, and
 * a player who had just pressed 7 pressed 7 again.
 *
 * Numbering off the whole list fixes it outright: the ways out keep 1, 2, 3 on
 * every page because they are first in the whole list too, and the room's own
 * options carry the same number wherever they are showing — page two starts at
 * 10 or 13 or wherever page one stopped. A number means one thing per room.
 *
 * (The conversation and travel menus page by their own older rules and still
 * number from 1. Neither has been reported, and both replace the list rather
 * than keeping a sticky head, so a number there at least means one thing per
 * page. Worth the same treatment when one of them is.)
 */
export function menuNumbers(world: World, s: State): number[] {
  const all = allActions(world, s).map(canon);
  return legalActions(world, s).map((a) => all.indexOf(canon(a)) + 1);
}

/**
 * The action a menu number names — the inverse of `menuNumbers`.
 *
 * A number is a place in the room's whole option list, so it means the same
 * thing on every page: the one a player read a screen ago still works after
 * they turn the page. Two wave-six players hit "No action N" doing exactly
 * that, because the front end was resolving numbers against the page in front
 * of them instead of against the list they are numbered from. `step` has always
 * judged against `allActions`, every page of it, so this only says out loud
 * what the engine already allowed.
 *
 * A conversation and a travel list page by their own older rules and number
 * from 1 per page, so `allActions` holds only the page showing there and a
 * number off it correctly resolves to nothing.
 */
export function actionByNumber(world: World, s: State, n: number): Action | undefined {
  if (!Number.isInteger(n) || n < 1) return undefined;
  return allActions(world, s)[n - 1];
}

/**
 * Everything legal here, whichever page is showing — every option the room
 * offers plus, when it has more than one page, the way to the next. This is
 * what `step` and `actionByLabel` judge an action against: turning a page
 * changes what you can see, never what you could do, so a walkthrough written
 * before a room grew crowded keeps working.
 */
export function allActions(world: World, s: State): Action[] {
  const { all, ways } = withMenuMemo(() => roomMenu(world, s));
  return roomPages(all, ways) ? [...all, { kind: "roommore" }] : all;
}

/**
 * A room's own load: everything it offers except the class abilities, which are
 * not the room's and not the author's to budget for. This is the number
 * MENU_CAP is a cap on, and what the validator and the crawler hold to it.
 *
 * The cap is a reading bar — twelve options is about as much as a turn can be
 * and still be a choice rather than a search — and the author can only answer
 * for the part of it they wrote. A Warden with a full pool carries three or
 * four abilities into every room in the realm; holding rooms to twelve
 * *including* those would tax every room for a class the author cannot see.
 *
 * So: the room's own content is capped, and whatever the abilities bring on top
 * turns a page. Before paging, that tail was simply dropped at the cap, which
 * is how three rooms sat one over it without the crawler ever noticing — the
 * engine was hiding the thirteenth option from the count as well as the player.
 */
export function menuLoad(world: World, s: State): number {
  return withMenuMemo(() => roomMenu(world, s)).all.filter((a) => a.kind !== "ability").length;
}

/** Runs one menu build with the per-call memo above open for the duration and closed again after. */
function withMenuMemo<T>(build: () => T): T {
  const outer = menuMemo;
  menuMemo = {};
  try {
    return build();
  } finally {
    menuMemo = outer;
  }
}

function roomMenu(world: World, s: State): { all: Action[]; ways: number } {
  // The menus below are not a room's own: each already holds itself within the
  // cap (a conversation and a travel list turn their own pages), so none of
  // them has a sticky head and pageRoom's length guard leaves them alone.
  const whole = (all: Action[]) => ({ all, ways: 0 });
  if (s.ended) return whole([]);
  // class first: nothing else is legal until the player picks who they are
  if (inClassPhase(world, s))
    return whole(Object.keys(world.classes!).map((id) => ({ kind: "classpick", id })));
  // a pending level-up perk choice blocks the menu until spent
  if (s.perkPicks > 0) {
    const picks = eligiblePerks(world, s).sort();
    if (picks.length) return whole(picks.slice(0, MENU_CAP).map((id) => ({ kind: "perkpick", id })));
  }
  // an open conversation: only its topics, and the way out of it
  if (inTalkMode(world, s)) {
    const npc = s.talking!;
    // a line that sends a companion away goes last, never in the slot the
    // player has been pressing to carry the conversation on
    // ... and so does a line that commits you to something (`commits: true`), so
    // a menu that shrinks as questions are answered never slides a betrayal into
    // the number the player has been pressing
    const late = (t: TopicDef) => Number(partsWays(t) || !!t.commits);
    const topics = visibleTopics(world, s, npc).sort((a, b) => late(a) - late(b));
    // a farewell line (a topic with `end`) is the way out; the plain "end
    // conversation" only appears when the npc offers none
    const ends = topics.filter((t) => t.end);
    const rest = topics.filter((t) => !t.end);
    const outro: Action[] = ends.length ? ends.map((t): Action => ({ kind: "talk", npc, topic: t.id })) : [{ kind: "endtalk" }];
    // a conversation that has grown past the cap turns pages: the farewell stays
    // on every page, and "more to ask" (free) turns to the next
    const paging = rest.length + outro.length > MENU_CAP;
    const pageSize = Math.max(1, MENU_CAP - outro.length - 1);
    const pages = paging ? Math.ceil(rest.length / pageSize) : 1;
    const page = paging ? s.talkPage % pages : 0;
    const shown = paging ? rest.slice(page * pageSize, (page + 1) * pageSize) : rest;
    const out: Action[] = shown.map((t): Action => ({ kind: "talk", npc, topic: t.id }));
    if (paging) out.push({ kind: "talkmore" });
    return whole([...out, ...outro]);
  }
  // the travel menu: destinations (or regions), and the way out of it
  if (inTravelMode(world, s)) return whole(travelActions(world, s));
  // the company list: the companions to speak with, and the way out of it
  if (inCompanyMode(world, s)) return whole([...companyHere(world, s).map((npc): Action => ({ kind: "talkto", npc })), { kind: "companydone" }]);
  const out: Action[] = [];
  const room = world.rooms[s.room];
  if (!room) return whole(out);
  // two or more companions to speak with fold into one entry, listed where the first of them would have been
  const company = companyHere(world, s);
  const folded = new Set(company.length >= 2 ? company : []);
  let companyListed = false;
  const late: Action[] = []; // attacks on the peaceable, listed after everything else
  for (const dir of Object.keys(room.exits ?? {})) out.push({ kind: "go", dir });
  if (roomIsDark(world, s)) return whole(out); // in the dark you can only feel for exits
  if (travelAvailable(world, s)) out.push({ kind: "travel" });
  // everything above is the way out, and stays on every page of a crowded room:
  // whatever else is going on, a player can always leave.
  const ways = out.length;
  for (const a of room.actions ?? [])
    if (customVisible(world, s, a)) out.push({ kind: "custom", room: s.room, id: a.id });
  for (const id of takeablesHere(world, s)) out.push({ kind: "take", item: id });
  for (const npc of npcsHere(world, s)) {
    const def = world.npcs[npc]!;
    if (folded.has(npc)) {
      if (!companyListed) out.push({ kind: "company" });
      companyListed = true;
      continue;
    }
    const topics = visibleTopics(world, s, npc);
    if (def.dialogue) {
      if (topics.length) out.push({ kind: "talkto", npc });
    } else {
      for (const t of topics) out.push({ kind: "talk", npc, topic: t.id });
    }
    // companions are not targets; a stranger who has drawn no blade is one, but
    // the option waits at the foot of the menu, after everything else here —
    // and someone you could talk to is not one until you have talked
    if (def.hp !== undefined && !s.party.includes(npc)) {
      if (hostileNow(world, s, npc)) out.push({ kind: "attack", npc });
      else if (!def.dialogue || spokenWith(s, npc)) late.push({ kind: "attack", npc });
    }
    // a hostile that holds its ground can be left alone in so many words: free,
    // so the peaceable road past it is a choice on the menu, not a guess. An
    // aggressive one can be broken away from too, once the fight is going
    // badly (fightGoingBadly), at the price of one last strike (oddsHint says
    // so) — a dead end and a losing fight both keep a way out.
    if (def.hp !== undefined && hostileNow(world, s, npc) && !s.flags[`left_${npc}`] && (!aggressiveNow(world, s, npc) || fightGoingBadly(s)))
      out.push({ kind: "leave", npc });
  }
  for (const id of s.inv) {
    for (const u of world.items[id]?.use ?? []) {
      if (!condsOk(world, s, u.if)) continue;
      const t = u.target;
      const targetPresent =
        !t || s.inv.includes(t) || s.itemLoc[t] === s.room || s.npcRoom[t] === s.room;
      if (targetPresent) {
        out.push({ kind: "use", item: id, ...(t ? { target: t } : {}) });
        break; // one use entry per item
      }
    }
  }
  out.push(...late);
  // abilities are not tied to this room, so they read last: a room's own content — its actions,
  // its people, its things — always comes first. Checked last for the same reason it is capped
  // here: a room already crowded (a big story choice, a full party's "speak with the company")
  // gets first claim on the cap; an ability that would push the menu past it quietly does not show,
  // rather than the room ever offering more than MENU_CAP entries.
  for (const [id, a] of Object.entries(world.abilities ?? {}))
    if (abilityVisible(world, s, id, a)) out.push({ kind: "ability", id });
  return { all: out, ways };
}

/**
 * A room with more to do than the menu holds turns pages, the way a long
 * conversation and a long travel list already do.
 *
 * Before this, a crowded room dropped whatever came last — abilities, silently.
 * A menu that hides an option a player has earned is worse than a long menu: it
 * makes the room lie about what is possible in it, and the player cannot even
 * tell there is something to look for. So nothing is dropped now; it moves to
 * the next page, and "more here" (free, no turn) turns to it.
 *
 * The exits and the travel entry stay on every page. Whatever else a room has
 * become, walking out of it is never on another page.
 *
 * A room whose exits alone crowd the menu cannot be helped by paging — there
 * would be no room left for a page of anything else — so it is returned whole
 * and the crawler's over-cap count says so honestly rather than the menu
 * quietly swallowing the difference.
 */
const roomPages = (out: Action[], ways: number): boolean => out.length > MENU_CAP && ways + 2 <= MENU_CAP;
function pageRoom(s: State, out: Action[], ways: number): Action[] {
  if (!roomPages(out, ways)) return out;
  const rest = out.slice(ways);
  const pageSize = MENU_CAP - ways - 1; // one slot for the way to the next page
  const pages = Math.ceil(rest.length / pageSize);
  const page = s.roomPage % pages;
  return [...out.slice(0, ways), ...rest.slice(page * pageSize, (page + 1) * pageSize), { kind: "roommore" }];
}

/**
 * Which page of a crowded room is showing, and how many there are — null when
 * the room fits on one and there are no pages to speak of.
 *
 * The screen has to say this. A playtester picked a number at the Barrow Crypt
 * after turning the page and walked out of the room instead: the ways out stay
 * on every page (so nobody is ever trapped behind a "more"), which means the
 * numbers under them move when the page does, and a number remembered from the
 * page before is a mis-pick waiting to happen. Saying "p2/3" in the header
 * makes a remembered number visibly stale.
 */
export function roomPageOf(world: World, s: State): { page: number; pages: number } | null {
  const { all, ways } = withMenuMemo(() => roomMenu(world, s));
  if (!roomPages(all, ways)) return null;
  const pages = Math.ceil((all.length - ways) / (MENU_CAP - ways - 1));
  return { page: (s.roomPage % pages) + 1, pages };
}

export function actionLabel(world: World, a: Action, s?: State): string {
  switch (a.kind) {
    case "go":
      return `go ${a.dir}`;
    case "take":
      return `take ${world.items[a.item]?.name ?? a.item}`;
    case "use": {
      const item = world.items[a.item]?.name ?? a.item;
      const target = a.target
        ? (world.items[a.target]?.name ?? world.npcs[a.target]?.name ?? a.target)
        : null;
      return target ? `use ${item} on ${target}` : `use ${item}`;
    }
    case "talk": {
      const npc = world.npcs[a.npc];
      const t = npc?.topics?.find((x) => x.id === a.topic);
      // inside a conversation the npc is already named, so the label stands alone
      if (s?.talking === a.npc && npc?.dialogue) return t?.label ?? a.topic;
      return `ask ${npc?.name ?? a.npc}: ${t?.label ?? a.topic}`;
    }
    case "talkto":
      return `talk to ${world.npcs[a.npc]?.name ?? a.npc}`;
    case "leave":
      return `leave ${world.npcs[a.npc]?.name ?? a.npc} be`;
    case "endtalk":
      return "end conversation";
    case "travel":
      return "travel to a known place";
    case "travelregion":
      return a.region ? `toward ${world.regions?.[a.region]?.name ?? a.region}` : "toward places elsewhere";
    case "travelto": {
      // a landmark carries its own travel name; a plain room you have walked
      // and can now walk back to is named by the room
      const r = world.rooms[a.room];
      // "to The Processional Gate" reads wrong after the preposition: a name
      // carrying its own article lowercases it here, as theName does elsewhere
      return `to ${(r?.landmark ?? r?.name ?? a.room).replace(/^The /, "the ")}`;
    }
    case "traveldone":
      return s?.travelMenu ? "back" : "stay here";
    case "company":
      return "speak with the company";
    case "companydone":
      return "back";
    case "talkmore":
      return "more to ask";
    case "roommore":
      // not "more here": a playtester read that as a submenu (which is what
      // `travel` and `talk` are) and expected it to replace the list
      return "more in this room";
    case "travelmore":
      return "more places";
    case "attack": {
      const npcName = world.npcs[a.npc]?.name ?? a.npc;
      const weapon = s ? bestWeapon(world, s).item : null;
      const weaponName = weapon ? world.items[weapon]?.name : "bare hands";
      return `attack ${npcName} with ${weaponName}`;
    }
    case "custom":
      return world.rooms[a.room]?.actions?.find((x) => x.id === a.id)?.label ?? a.id;
    case "ability":
      return world.abilities?.[a.id]?.label ?? a.id;
    case "classpick": {
      const c = world.classes?.[a.id];
      return c ? `be ${article(c.name)} ${c.name} — ${c.desc}` : a.id;
    }
    case "perkpick": {
      const p = world.perks?.[a.id];
      return p ? `perk: ${p.name} (${p.desc})` : a.id;
    }
  }
}

// ---------- step ----------
function bestWeapon(world: World, s: State): { hit: number; dmg: number; item: string | null } {
  let best: { hit: number; dmg: number; item: string | null } = { hit: 0, dmg: 1, item: null };
  for (const id of s.inv) {
    const it = world.items[id];
    if (!it?.dmg) continue;
    if (it.dmg > best.dmg || (it.dmg === best.dmg && (it.hit ?? 0) > best.hit))
      best = { hit: it.hit ?? 0, dmg: it.dmg, item: id };
  }
  return best;
}

/** The use def a "use" action runs: first entry whose conditions pass and whose target (if any) is at hand. Shared by step() and oddsHint(). */
function useDefFor(world: World, s: State, item: string): UseDef | undefined {
  return (world.items[item]?.use ?? []).find((d) => {
    if (!condsOk(world, s, d.if)) return false;
    const t = d.target;
    return !t || s.inv.includes(t) || s.itemLoc[t] === s.room || s.npcRoom[t] === s.room;
  });
}

/** The fx list an action would run, if it has one and a leading check is worth previewing. */
function fxFor(world: World, s: State, a: Action): Fx[] | undefined {
  switch (a.kind) {
    case "custom":
      return world.rooms[a.room]?.actions?.find((x) => x.id === a.id)?.fx;
    case "ability":
      return world.abilities?.[a.id]?.fx;
    case "talk":
      return world.npcs[a.npc]?.topics?.find((x) => x.id === a.topic)?.fx;
    case "use":
      return useDefFor(world, s, a.item)?.fx;
    default:
      return undefined;
  }
}

/**
 * A short "(roll N+ on the die)" preview for a risky action, so a player can
 * weigh it before spending a turn (and possibly hp) on it. Says "on the die"
 * explicitly — not "needs a total of N+" — because real players read an
 * ambiguous "needs N+" as the roll-plus-modifier total and then called a
 * correct fail a bug when their raw roll fell short but their total didn't.
 * Always names the stat it checks ("wits") so a player can judge whether
 * they should attempt it before rolling, even with no modifier; a nonzero
 * modifier is shown too ("+3 wits") so a later "vs DC 12" in the post-roll
 * event doesn't read as a different, higher number than the "roll 8+" just
 * previewed — same check, two frames (die-only here, total-vs-DC there),
 * bridged by the modifier appearing in both.
 * A "use" action with no check instead previews the item's own `hint` (if
 * any), e.g. "use iron crown (worth reading)" — an inventory item's use
 * option can appear in every room, far from wherever it was picked up, so
 * without this its effect stays unknown until a player spends a turn on it.
 * Display-only: it never touches actionLabel, so walkthroughs and proofs —
 * which match on the canonical label — are unaffected by odds text or by
 * attribute/perk changes.
 */
/** An item's hint as it stands now: the first variant whose conditions hold, else the base hint; "" means none. */
export function itemHint(world: World, s: State, id: string): string | undefined {
  const def = world.items[id];
  if (!def) return undefined;
  const v = def.variants?.find((x) => condsOk(world, s, x.if));
  const hint = v ? v.hint : def.hint;
  return hint ? hint : undefined;
}

/**
 * "as a Scholar" for a room action or topic the player's class opened: a
 * top-level `["class", c]` condition on the def, so a player can see which of
 * their choices are theirs alone. Silent when the label already names the class.
 */
function classTag(world: World, s: State, a: Action): string {
  if (!s.classId) return "";
  const def =
    a.kind === "custom"
      ? world.rooms[a.room]?.actions?.find((x) => x.id === a.id)
      : a.kind === "talk"
        ? world.npcs[a.npc]?.topics?.find((x) => x.id === a.topic)
        : undefined;
  if (!def?.if?.some((c) => c[0] === "class" && c[1] === s.classId)) return "";
  const name = world.classes?.[s.classId]?.name;
  if (!name || def.label.toLowerCase().includes(name.toLowerCase())) return "";
  return `as ${article(name)} ${name}`;
}

export function oddsHint(world: World, s: State, a: Action, opts: { itemHints?: boolean } = {}): string {
  const who = classTag(world, s, a);
  // a free action still says what it costs in standing or regard: "free" is the turn, not the price
  const isFree =
    (a.kind === "custom" && !!world.rooms[a.room]?.actions?.find((x) => x.id === a.id)?.free) ||
    (a.kind === "ability" && !!world.abilities?.[a.id]?.free);
  // breaking from an aggressive npc still costs no turn, but it is not free: it costs a strike, and the menu says so before it lands
  if (a.kind === "leave") {
    if (!aggressiveNow(world, s, a.npc)) return " (free)";
    return canSlipAway(world, s) ? " (free: slip away)" : " (a strike)";
  }
  if (a.kind === "take") {
    const owner = world.items[a.item]?.owner;
    const w = owner ? ownerWatching(world, s, owner) : null;
    if (!w) return "";
    // A theft is counted against every companion standing there (`thefts_with_<id>`
    // in the take case), and it is their own remarks that charge regard for it — so
    // the price lands a turn later than the choice. A blind player took the
    // headframe lantern, lost regard, and filed that as unwarned: "no warning that
    // it's treated as real theft rather than minor scavenging". The warning was
    // there; the part that costs was not. Name who will remember it, here, where
    // every other price in this game is stated before the turn is spent.
    const seen = s.party.map((id) => world.npcs[id]?.name).filter((n): n is string => !!n);
    const also = seen.length > 1 ? `${seen.slice(0, -1).join(", ")} and ${seen[seen.length - 1]}` : seen[0];
    return also
      ? ` (${w.name} is watching: taking it is theft, and ${also} will remember it)`
      : ` (${w.name} is watching: taking it is theft)`;
  }
  if (a.kind === "company") return ` (${companyHere(world, s).map((id) => world.npcs[id]?.name ?? id).join(", ")})`;
  if (a.kind === "travelmore") return ` (${travelMore(world, s)} more)`;
  if (a.kind === "roommore") {
    // how much of the room is on the other pages
    const shown = legalActions(world, s).length - 1; // this entry is not one of the things waiting
    return ` (${Math.max(1, allActions(world, s).length - shown)} more)`;
  }
  if (a.kind === "talkmore" && s.talking) {
    // how many topics wait on the other pages
    const rest = visibleTopics(world, s, s.talking).filter((t) => !t.end).length;
    const here = legalActions(world, s).filter((x) => x.kind === "talk").length - visibleTopics(world, s, s.talking).filter((t) => t.end).length;
    return ` (${rest - here} more)`;
  }
  if (a.kind === "travelregion" && a.region) {
    // a region entry opens a second menu; say how many known places wait behind it
    const n = knownLandmarks(world, s).filter((id) => (world.rooms[id]?.region ?? "") === a.region).length;
    return ` (${n} known ${n === 1 ? "place" : "places"})`;
  }
  if (a.kind === "attack") {
    const def = world.npcs[a.npc];
    if (!def) return "";
    const need = Math.max(1, npcDf(world, s, a.npc) - attackBonus(world, s));
    // a kill that costs regard or standing is said before the blow, like a check's miss — a player
    // who lost Lys's regard over two wolves the menu called fair game had no way to know
    const kill = killCostHint(world, s, def.onDeath);
    return kill ? ` (roll ${need}+ on the die; ${kill})` : ` (roll ${need}+ on the die)`;
  }
  if (a.kind === "go") {
    // legalActions lists every exit regardless of its gate, so a locked one
    // reads as a real choice; flag it before a turn is wasted walking into it
    const exit = world.rooms[s.room]?.exits?.[a.dir];
    if (exit?.if && !condsOk(world, s, exit.if))
      return exit.hint ? ` (locked: ${exit.hint})` : " (locked)";
    // an unlabelled exit into a landmark room borrows the landmark's name, so a
    // gateway's "go in" says where it goes like every authored exit around it
    const toward = exit?.landmark ?? (exit ? world.rooms[exit.to]?.landmark : undefined);
    // a side trip nobody has walked yet: this used to be a bare "*" on the "exits:"
    // line, which nothing on the screen explained (two playtest reports asked). It
    // says so in words now, on the option it belongs to
    const aside = !!exit?.sideTrip && !s.visited.includes(exit.to);
    if (toward) return aside ? ` (toward ${toward}, not yet walked)` : ` (toward ${toward})`;
    return aside ? " (a way not yet walked)" : "";
  }
  const fx = fxFor(world, s, a);
  const chk = leadingCheck(world, s, fx);
  const parts: string[] = [];
  if (chk && chk[0] === "check") {
    // the DC quoted here is the one applyFx's `check` case will actually roll
    // against (escalatedDc, keyed the same way via checkSourceId) — a prior
    // failed attempt on this exact action/topic/ability/use already raised
    // it, and the preview has to say so before the turn is spent, or it is
    // the very promise-the-roll-then-breaks bug this file has paid for once
    // (see oddsHint's own comment above and applyFx's `check` case)
    const dc = escalatedDc(s, checkSourceId(a), chk[2], checkMod(world, s, chk[1]));
    // all three numbers, so neither frame can be misread: the DC the total must
    // reach, the modifier, and the die roll that gets there
    const mod = checkMod(world, s, chk[1]);
    const need = Math.max(1, dc - mod);
    // The realm tags a check option with its skill — "slip past him along the
    // bough (grace)" — and this clause named it again a foot later, on 513
    // option lines across the proven roads: about 1.4 characters a screen on
    // every road at once, which at the time was more slack than four of them
    // had left. Said once when the label has just said it; said in full when it
    // has not, and in full whenever the label's tag names a different skill
    // (which is the label telling the player something).
    const tagged = new RegExp(`\\(${chk[1]}\\)$`).test(actionLabel(world, a, s));
    const skill = tagged ? "" : ` ${chk[1]}`;
    parts.push(
      mod
        ? `DC ${dc}, ${mod > 0 ? "+" : ""}${mod}${skill}: roll ${need}+ on the die`
        : `DC ${dc},${skill ? `${skill}:` : ""} roll ${need}+ on the die`,
    );
    // A raised DC has to say it was raised, and that it stops. A playtester
    // abandoned the King's Strongroom box because "the DC quietly goes up by 1
    // after every failure with no visible cap, which can spiral a puzzle out of
    // reach" — it cannot, escalatedDc holds it at modifier + 20, but nothing on
    // the screen said so, and a player who thinks a lock is spiralling walks
    // away from it. Only prints on a check already failed, which is exactly
    // when it is worth the characters.
    const tries = s.checkAttempts[checkSourceId(a) ?? ""] ?? 0;
    if (tries > 0 && dc > chk[2]) {
      const ceiling = mod + 20;
      parts.push(chk[2] > ceiling ? `raised ${dc - chk[2]} by failed tries` : `raised ${dc - chk[2]} by failed tries, and stops at ${ceiling}`);
    }
    // a miss that costs standing or regard is said before the die is thrown, like "fail costs 1hp" — and with whom;
    // so is a hit that costs it, so the warning never reads as "only a miss"
    const cost = costsStandingHint(world, s, chk[4], chk[3]);
    if (cost) parts.push(cost);
  }
  // an action that settles a hold's grief is the one-shot the hold is built around; say so before it is taken, and which way
  const route = fx ? hollowRoute(fx) : null;
  if (route) parts.push(`settles this hold's grief: ${route}`);
  // regard an action moves outright (a side taken in a quarrel, an oath sworn to a companion) is said by name and number
  // (only companions already met are named — the reeve's "Tamsin +1" read as the reeve's own name to a player who had not crossed the square yet)
  const moves = regardMoves(world, s, fx ?? [])
    .filter((f) => companionMet(world, s, f[1].slice(5)))
    .map((f) => `${world.npcs[f[1].slice(5)]!.name} ${f[2] > 0 ? "+" : "-"}${Math.abs(f[2])}`);
  if (moves.length) parts.push(moves.join(", "));
  // and a companion who walks out over it, which regard alone never says: a
  // number that goes back up and a friend who does not are not the same warning
  const leaves = partyLeavesHint(world, s, fx, chk, a.kind === "talk" ? a.npc : undefined);
  if (leaves) parts.push(leaves);
  // a standing an action lowers outright is said too, as things stand — the Coldpass gate's writ cost two factions a point with no word beforehand
  if (!(chk && chk[0] === "check")) {
    const costs = outrightCosts(world, s, fx ?? []);
    if (costs.length) parts.push(`costs standing with ${costs.join(" and ")}`);
  }
  // an ability that spends a resource pool says so before it is pressed —
  // "free" (below) is the turn, not the price, so an ability can read both
  // "free" and this in the same line: no turn, but a real point of the pool
  if (a.kind === "ability") {
    const cost = abilityCost(world, fx);
    if (cost) parts.push(`${s.vars[cost.pool] ?? 0} of ${world.resources![cost.pool]} left`);
  }
  if (who) parts.unshift(who);
  if (isFree) parts.unshift("free");
  if (parts.length) return ` (${parts.join("; ")})`;
  if (a.kind === "use" && opts.itemHints !== false) {
    // an item's use can sit in the menu for the rest of the game, so its hint
    // is shown where a place is first shown (and in status), not on every screen
    const hint = itemHint(world, s, a.item);
    return hint ? ` (${hint})` : "";
  }
  return "";
}

/**
 * A fresh State carrying the same values as this one — every step works on a
 * copy so a caller keeps the state it handed in, and so the crawler can take
 * the same step twice from one state and compare the results.
 *
 * `structuredClone` did this and was a fifth of every turn in the Reach: it is
 * a general serializer, and it pays for cycles, Maps, Dates and typed arrays
 * that a State (plain JSON by contract — see the type) will never contain. This
 * copies the shape by hand instead, and costs about a sixth as much.
 *
 * The object literal is exhaustive on purpose: State has no optional fields, so
 * a field added to it and not added here fails the typecheck rather than
 * silently sharing one mutable object between two turns.
 */
function cloneState(s: State): State {
  const npcConds: Record<string, Record<string, number>> = {};
  for (const id in s.npcConds) npcConds[id] = { ...s.npcConds[id]! };
  return {
    seed: s.seed,
    rngA: s.rngA,
    turn: s.turn,
    room: s.room,
    hp: s.hp,
    maxHp: s.maxHp,
    score: s.score,
    classId: s.classId,
    attrs: { ...s.attrs },
    perks: [...s.perks],
    xp: s.xp,
    level: s.level,
    perkPicks: s.perkPicks,
    inv: [...s.inv],
    flags: { ...s.flags },
    vars: { ...s.vars },
    itemLoc: { ...s.itemLoc },
    npcHp: { ...s.npcHp },
    npcRoom: { ...s.npcRoom },
    conds: { ...s.conds },
    npcConds,
    checkAttempts: { ...s.checkAttempts },
    flagTurn: { ...s.flagTurn },
    visited: [...s.visited],
    party: [...s.party],
    talking: s.talking,
    travelMenu: s.travelMenu,
    companyMenu: s.companyMenu,
    talkPage: s.talkPage,
    roomPage: s.roomPage,
    travelPage: s.travelPage,
    ended: s.ended && { ...s.ended },
  };
}

export function step(world: World, prev: State, action: Action): StepOut {
  const legal = allActions(world, prev);
  const key = canon(action);
  if (!legal.some((a) => canon(a) === key)) {
    return { state: prev, events: ["Illegal action — pick a number from the menu."] };
  }
  const s: State = cloneState(prev);
  const events: string[] = [];
  // opening the travel menu, picking a region, or backing out is browsing, not a turn;
  // only the journey itself (travelto) and everything else costs one
  const freeCustom =
    (action.kind === "custom" && !!world.rooms[action.room]?.actions?.find((x) => x.id === action.id)?.free) ||
    (action.kind === "ability" && !!world.abilities?.[action.id]?.free);
  const spentTurn =
    !freeCustom && action.kind !== "leave" && action.kind !== "travel" && action.kind !== "travelregion" && action.kind !== "traveldone" && action.kind !== "company" && action.kind !== "companydone" && action.kind !== "talkmore" && action.kind !== "travelmore" && action.kind !== "roommore";
  if (spentTurn) s.turn += 1;
  let attacked: string | null = null; // the npc that already struck back this turn

  switch (action.kind) {
    case "go": {
      const exit = world.rooms[s.room]?.exits?.[action.dir];
      if (!exit) break;
      if (!condsOk(world, s, exit.if)) {
        events.push(exit.lockedMsg ?? "You can't go that way yet.");
        break;
      }
      enterRoom(world, s, exit.to, events);
      break;
    }
    case "take": {
      const wieldedBefore = bestWeapon(world, s).item, wornBefore = bestArmor(world, s).item;
      s.itemLoc[action.item] = "inv";
      s.inv.push(action.item);
      const def = world.items[action.item];
      const label = def?.name ?? action.item;
      const hint = itemHint(world, s, action.item);
      events.push(hint ? `${label}: taken. (${hint})` : `${label}: taken.`);
      // the best carried weapon and armor are the ones that count, silently — so say when a pickup changes which
      if (bestWeapon(world, s).item === action.item && wieldedBefore !== action.item) events.push(`(You will fight with it now.)`);
      if (bestArmor(world, s).item === action.item && wornBefore !== action.item) events.push(`(You will wear it now.)`);
      // an owned thing taken under its owner's eyes is a theft the world can remember
      const owner = def?.owner ? ownerWatching(world, s, def.owner) : null;
      if (owner) {
        setFlag(s, `stole_${action.item}`);
        s.vars["thefts"] = (s.vars["thefts"] ?? 0) + 1;
        // and a count per companion who was there for it, so nobody judges a theft they never saw
        for (const id of s.party) s.vars[`thefts_with_${id}`] = (s.vars[`thefts_with_${id}`] ?? 0) + 1;
        events.push(`${TheName(owner.name)} sees you take it.`);
      }
      break;
    }
    case "use": {
      const u = useDefFor(world, s, action.item);
      if (u) applyFx(world, s, u.fx, events, checkSourceId(action));
      else events.push("Nothing happens.");
      break;
    }
    case "talk": {
      const t = world.npcs[action.npc]?.topics?.find((x) => x.id === action.topic);
      if (!t) break;
      if (t.once) setFlag(s, `said_${action.npc}_${t.id}`);
      events.push(speaks(world.npcs[action.npc]?.name ?? action.npc, t.say));
      if (t.fx) applyFx(world, s, t.fx, events, checkSourceId(action));
      // a conversation closes on its own when the line says so, or when the
      // npc has nothing left to say / is no longer here (inTalkMode covers
      // the latter two — clearing here just keeps the state tidy)
      if (s.talking === action.npc && (t.end || !inTalkMode(world, s))) {
        s.talking = null;
        s.talkPage = 0;
      }
      break;
    }
    case "talkto":
      s.talking = action.npc;
      s.talkPage = 0;
      s.companyMenu = false; // picked from the company list: the conversation replaces it
      break;
    case "endtalk":
      s.talking = null;
      s.talkPage = 0;
      break;
    case "talkmore":
      s.talkPage += 1;
      break;
    case "roommore":
      s.roomPage += 1;
      break;
    case "company":
      s.companyMenu = true;
      break;
    case "companydone":
      s.companyMenu = false;
      break;
    case "travel":
      s.travelMenu = "";
      s.travelPage = 0;
      break;
    case "travelregion":
      s.travelMenu = action.region;
      s.travelPage = 0;
      break;
    case "travelmore":
      s.travelPage += 1;
      break;
    case "traveldone":
      // from inside a region list, step back to the region list; else close
      s.travelMenu = s.travelMenu && knownLandmarks(world, s).length > MENU_CAP - 1 ? "" : null;
      s.travelPage = 0;
      break;
    case "travelto": {
      s.travelPage = 0;
      s.travelMenu = null;
      // the same fallback the travel menu's own label uses (see actionLabel's
      // `travelto` case): local travel lists every *visited* room in a region,
      // not only its landmarks, so a destination may have no travel name of its
      // own — and printing the room id at a player ("You travel to
      // ir_miners_hall.") is how three regions' worth of them reached a
      // playtest report.
      const dest = world.rooms[action.room];
      events.push(`You travel to ${dest?.landmark ?? dest?.name ?? action.room}.`);
      enterRoom(world, s, action.room, events);
      break;
    }
    case "attack": {
      const def = world.npcs[action.npc]!;
      const w = bestWeapon(world, s);
      const hit = attackBonus(world, s, w);
      const roll = d20(s);
      const df = npcDf(world, s, action.npc);
      const total = roll + hit;
      if (total >= df) {
        const dmg = (roll === 20 ? w.dmg * 2 : w.dmg) + perkBonus(world, s, "dmg") + condBonus(world, s, "dmg");
        s.npcHp[action.npc] = (s.npcHp[action.npc] ?? 1) - dmg;
        const left = s.npcHp[action.npc]!;
        const leftText = left > 0 ? `, ${left}/${def.hp ?? 1}hp left` : "";
        events.push(`You hit ${theName(def.name)} (d20:${roll}+${hit}=${total} vs DF ${df}, -${dmg}hp${leftText}).`);
      } else {
        events.push(`You miss ${theName(def.name)} (d20:${roll}+${hit}=${total} vs DF ${df}).`);
      }
      // companions fight beside the player: one roll each, in join order,
      // until the target drops
      for (const id of s.party) {
        if ((s.npcHp[action.npc] ?? 0) <= 0) break;
        const c = world.npcs[id];
        if (!c?.companion || npcDead(world, s, id) || s.npcRoom[id] !== s.room || s.flags[`down_${id}`]) continue;
        const cHit = c.companion.hit ?? 0;
        const cRoll = d20(s);
        const cTotal = cRoll + cHit;
        if (cTotal >= df) {
          const cDmg = c.companion.dmg ?? 1;
          s.npcHp[action.npc] = (s.npcHp[action.npc] ?? 1) - cDmg;
          const left = s.npcHp[action.npc]!;
          const leftText = left > 0 ? `, ${left}/${def.hp ?? 1}hp left` : "";
          events.push(`${c.name} hits ${theName(def.name)} (d20:${cRoll}+${cHit}=${cTotal} vs DF ${df}, -${cDmg}hp${leftText}).`);
        } else {
          events.push(`${c.name} misses (d20:${cRoll}+${cHit}=${cTotal} vs DF ${df}).`);
        }
      }
      if ((s.npcHp[action.npc] ?? 0) <= 0) {
        events.push(`${TheName(def.name)} is destroyed.`);
        if (def.onDeath) applyFx(world, s, def.onDeath, events, `death:${action.npc}`);
      } else if (def.atk) {
        npcStrike(world, s, action.npc, events, "strikes back");
        attacked = action.npc;
      }
      break;
    }
    case "custom": {
      const a = world.rooms[action.room]?.actions?.find((x) => x.id === action.id);
      if (!a) break;
      if (a.once) setFlag(s, `did_${a.id}`);
      applyFx(world, s, a.fx, events, checkSourceId(action));
      applyRest(world, s, a.fx, events);
      break;
    }
    case "ability": {
      const a = world.abilities?.[action.id];
      if (!a) break;
      if (a.once) setFlag(s, `did_${action.id}`);
      applyFx(world, s, a.fx, events, checkSourceId(action));
      applyRest(world, s, a.fx, events);
      break;
    }
    case "classpick": {
      const def = world.classes?.[action.id];
      if (!def) break;
      s.classId = action.id;
      for (const [k, v] of Object.entries(def.attrs ?? {})) s.attrs[k] = v;
      s.maxHp += def.hp ?? 0;
      s.hp = s.maxHp;
      for (const id of def.items ?? []) {
        if (!s.inv.includes(id)) s.inv.push(id);
        s.itemLoc[id] = "inv";
      }
      for (const id of def.perks ?? []) grantPerk(world, s, id, events);
      events.push(`You are ${article(def.name)} ${def.name}.`);
      enterRoom(world, s, world.start, events);
      break;
    }
    case "leave": {
      const def = world.npcs[action.npc];
      setFlag(s, `left_${action.npc}`);
      const name = def?.name ?? action.npc;
      if (aggressiveNow(world, s, action.npc)) {
        // the price oddsHint already named: one last blow as you break away,
        // then DISENGAGE_COND buys a few quiet turns so walking out isn't struck too.
        // A Scout with the knack (and the res_scout to spend) slips away clean instead.
        if (canSlipAway(world, s)) {
          s.vars["res_scout"] = (s.vars["res_scout"] ?? 0) - 1;
          events.push(`You slip away from ${name} without a sound.`);
        } else {
          npcStrike(world, s, action.npc, events, "strikes as you break away");
        }
        if (!s.ended) {
          const conds = (s.npcConds[action.npc] ??= {});
          conds[DISENGAGE_COND] = Math.max(conds[DISENGAGE_COND] ?? 0, DISENGAGE_TURNS);
        }
        break;
      }
      // a company of men or a named person is "they"; a beast or a shade is "it"
      const plural = /^[A-Z]/.test(name) || (/(men|folk|s)$/.test(name) && !/ss$/.test(name));
      const holds = plural ? "They hold their ground" : "It holds its ground";
      // a wide berth is not a key: an exit still locked here is named, so the line never promises the way past
      const ways = lockedWaysHere(world, s);
      if (ways) events.push(`You give ${name} a wide berth. ${holds}; ${ways}.`);
      else events.push(`You give ${name} a wide berth. ${holds} and ${plural ? "let" : "lets"} you pass.`);
      break;
    }
    case "perkpick": {
      if (s.perkPicks <= 0) break;
      s.perkPicks -= 1;
      grantPerk(world, s, action.id, events, true);
      break;
    }
  }
  // the world gets its turn: aggressive npcs in the room strike, then the
  // company has its say — neither runs during a level-up pick or class pick,
  // which are menu time, not world time
  if (!s.ended && action.kind !== "perkpick" && action.kind !== "classpick") {
    // a free look, a menu turned, a wide berth given: no turn passes, so nothing gets its strike
    if (spentTurn) aggressivePass(world, s, events, attacked);
    recoverDowned(world, s, events, attacked);
    // conditions tick on the same clock as everything else in the world's turn
    if (spentTurn) tickConditions(world, s, events);
    // the realm gets its own turn last: after the player's action, the aggressive
    // pass, and conditions — so a clock entry can react to anything any of them just did
    if (spentTurn) tickClock(world, s, events);
    // the company speaks on a turn of the world, not while a menu is being turned
    if (!MENU_KINDS.has(action.kind)) partyRemarks(world, s, events);
  }
  journalEvents(world, prev, s, events);
  // Once, the first time fast travel is on the menu: a playtester walked the
  // whole map on foot for ninety turns before noticing the entry.
  if (!s.ended && !s.flags["_seenTravel"] && travelAvailable(world, s)) {
    setFlag(s, "_seenTravel");
    events.push("(You know more than one place now: 'travel to a known place' moves you between the landmarks you have seen, not every room, in one turn.)");
  }
  // Once, the first time a room has more options than fit: two wave-six players
  // read the page marker and still took "more in this room" for a submenu that
  // had swapped their options away — "reads at first like the extra options
  // vanished rather than being paginated" — and one of them then hit "No action
  // N" typing a number off the page it was written on. The numbers really do
  // hold across pages, which is the half worth saying out loud.
  if (!s.ended && !s.flags["_seenPaging"] && roomPageOf(world, s)) {
    setFlag(s, "_seenPaging");
    events.push("(More options here than fit one screen: 'more in this room' turns the page, and a number you read on either page still works.)");
  }
  // Once per room that holds an ending: a player three hollows in walked to the
  // seat and ended the tale on the next action with four threads still open.
  const endKey = `_warnedEnd_${s.room}`;
  if (!s.ended && !s.flags[endKey] && (world.rooms[s.room]?.actions ?? []).some((a) => fxEnds(a.fx))) {
    setFlag(s, endKey);
    events.push("(An ending waits in this room. What you have left undone elsewhere stays undone.)");
  }
  // Once, the first time something that strikes through armor stands in the
  // room: the "armor useless" tag was read by armored players as an afterthought
  // to the first blow, not the warning before it that it is.
  if (!s.ended && !s.flags["_seenPierce"]) {
    const piercer = indexOf(world).piercers.find(
      (id) => s.npcRoom[id] === s.room && !s.party.includes(id) && !npcDead(world, s, id),
    );
    if (piercer) {
      setFlag(s, "_seenPierce");
      events.push(
        `(${TheName(world.npcs[piercer]!.name)} strikes through armor: mail and shield count for nothing against it. Anything marked 'armor useless' in a room is such a thing — weigh it before you fight.)`,
      );
    }
  }
  return { state: s, events };
}

/** Find a legal action by its rendered label (used by walkthroughs and the CLI). */
export function actionByLabel(world: World, s: State, label: string): Action | null {
  const want = label.trim().toLowerCase();
  for (const a of allActions(world, s))
    if (actionLabel(world, a, s).toLowerCase() === want) return a;
  return null;
}
