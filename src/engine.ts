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
  Cond,
  CustomAction,
  Fx,
  PerkDef,
  State,
  StepOut,
  TopicDef,
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
function canon(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  const o = v as Record<string, unknown>;
  const keys = Object.keys(o).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canon(o[k])}`).join(",")}}`;
}

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
    case "inParty":
      return s.party.includes(c[1]);
    case "!inParty":
      return !s.party.includes(c[1]);
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

/** Modifier for a named check: world skill + attribute + perk check bonuses. */
export function checkMod(world: World, s: State, name: string): number {
  let n = (world.skills?.[name] ?? 0) + (s.attrs[name] ?? 0);
  for (const id of s.perks) n += world.perks?.[id]?.bonus?.check?.[name] ?? 0;
  return n;
}

/**
 * Named parts behind a check's modifier (base skill+attribute, then each
 * contributing perk), for a breakdown shown when more than one thing stacks
 * into it — a player who sees only the final total has no way to tell how
 * much a given perk (e.g. Fleetfoot) is actually adding. Used both by the
 * post-roll check event below and by status's "Checks:" summary.
 */
export function checkModParts(world: World, s: State, name: string): { label: string; n: number }[] {
  const parts: { label: string; n: number }[] = [];
  const base = (world.skills?.[name] ?? 0) + (s.attrs[name] ?? 0);
  if (base) parts.push({ label: "base", n: base });
  for (const id of s.perks) {
    const n = world.perks?.[id]?.bonus?.check?.[name] ?? 0;
    if (n) parts.push({ label: world.perks![id]!.name, n });
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

/** Damage reduction: best carried armor item + perk armor. */
export function armorOf(world: World, s: State): number {
  return bestArmor(world, s).armor + perkBonus(world, s, "armor");
}

/** Attack-roll bonus: best weapon's hit + might + perk hit bonuses. The one place this sum is defined. */
function attackBonus(world: World, s: State, w = bestWeapon(world, s)): number {
  return w.hit + (s.attrs["might"] ?? 0) + perkBonus(world, s, "hit");
}

/** Attack-roll and damage totals an `attack` action would actually use, for the free `status` check. */
export function combatMods(
  world: World,
  s: State,
): { hit: number; dmg: number; armor: number; weapon: string | null; armorItem: string | null } {
  const w = bestWeapon(world, s);
  return {
    hit: attackBonus(world, s, w),
    dmg: w.dmg + perkBonus(world, s, "dmg"),
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
export type QuestLine = { id: string; name: string; status: "active" | "done" | "failed"; text: string };

/** Every quest that has started, with the line the player should read for it right now. */
export function journal(world: World, s: State): QuestLine[] {
  const out: QuestLine[] = [];
  for (const [id, q] of Object.entries(world.quests ?? {})) {
    if (!condsOk(world, s, q.start)) continue;
    if (q.failed && condsOk(world, s, q.failed)) { out.push({ id, name: q.name, status: "failed", text: "" }); continue; }
    if (q.done && condsOk(world, s, q.done)) { out.push({ id, name: q.name, status: "done", text: "" }); continue; }
    const stage = q.stages.find((st) => condsOk(world, s, st.if));
    out.push({ id, name: q.name, status: "active", text: stage?.text ?? "" });
  }
  return out;
}

/** One event per quest whose journal line changed this turn — the player sees the journal move without asking. */
function journalEvents(world: World, before: State, after: State, events: string[]): void {
  if (!world.quests) return;
  const prev = new Map(journal(world, before).map((q) => [q.id, q]));
  const now = journal(world, after);
  // entering a hold can begin several quests at once; one line names them all
  // and the journal (status) carries their text, so the screen stays readable
  const begun = now.filter((q) => !prev.has(q.id) && q.status !== "done" && q.status !== "failed" && q.text);
  const collapse = begun.length >= 2;
  if (collapse) events.push(`Journal: ${begun.map((q) => q.name).join("; ")} — see status.`);
  for (const q of now) {
    const p = prev.get(q.id);
    if (p && p.status === q.status && p.text === q.text) continue;
    if (collapse && !p && q.status !== "done" && q.status !== "failed") continue;
    // a quest that first appears already closed (its start and its end came
    // together, or its end came first) was never the player's to finish: no announcement
    if (!p && (q.status === "done" || q.status === "failed")) continue;
    if (q.status === "done") events.push(`Quest done: ${q.name}.`);
    else if (q.status === "failed") events.push(`Quest failed: ${q.name}.`);
    else if (q.text) events.push(`Quest — ${q.name}: ${q.text}`);
  }
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
export function travelAvailable(world: World, s: State): boolean {
  if (world.rooms[s.room]?.noTravel) return false;
  if (!knownLandmarks(world, s).length) return false;
  for (const id of Object.keys(world.npcs)) {
    const def = world.npcs[id]!;
    if ((def.aggressive || def.hostile) && s.npcRoom[id] === s.room && !npcDead(world, s, id) && !s.party.includes(id)) return false;
  }
  return true;
}

export const inTravelMode = (world: World, s: State): boolean => s.travelMenu !== null && travelAvailable(world, s);

/** Regions with at least one known landmark, in world order — the grouping used when the flat list would overflow the menu. */
function travelRegions(world: World, s: State): string[] {
  const seen = new Set<string>();
  for (const id of knownLandmarks(world, s)) seen.add(world.rooms[id]?.region ?? "");
  return Object.keys(world.regions ?? {}).filter((r) => seen.has(r)).concat(seen.has("") ? [""] : []);
}

/** The travel menu: flat destinations when they fit, else regions first, then one region's destinations. */
function travelActions(world: World, s: State): Action[] {
  const known = knownLandmarks(world, s);
  const out: Action[] = [];
  if (s.travelMenu === "") {
    if (known.length <= MENU_CAP - 1) for (const id of known) out.push({ kind: "travelto", room: id });
    else for (const r of travelRegions(world, s)) out.push({ kind: "travelregion", region: r });
  } else {
    for (const id of known) if ((world.rooms[id]?.region ?? "") === s.travelMenu) out.push({ kind: "travelto", room: id });
  }
  out.push({ kind: "traveldone" });
  return out;
}

// true while a level-up perk pick is blocking the menu — the room's own
// desc/exits don't render during this screen (see format.ts render()), so
// callers deciding whether a room's full description has been "seen" must
// treat this the same as inClassPhase, or a level-up on room entry burns the
// room's one full-desc reveal on a perk menu the player never connects to
// the room they just walked into.
export const inPerkPickPhase = (world: World, s: State): boolean =>
  s.perkPicks > 0 && eligiblePerks(world, s).length > 0;

// ---------- effects ----------
function applyFx(world: World, s: State, fxs: Fx[], events: string[]): void {
  for (const fx of fxs) {
    if (s.ended) return;
    switch (fx[0]) {
      case "say":
        events.push(fx[1]);
        break;
      case "set":
        s.flags[fx[1]] = true;
        break;
      case "clear":
        delete s.flags[fx[1]];
        break;
      case "score": {
        const before = s.score;
        s.score = clamp(s.score + fx[1], 0, world.maxScore);
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
            s.inv.push(item);
            events.push(`${world.items[item]?.name ?? item}: obtained.`);
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
        applyFx(world, s, condsOk(world, s, fx[1]) ? fx[2] : fx[3], events);
        break;
      case "slay":
        // a scripted end, not a fight: the room reads "(at rest)", not "(dead)"
        s.npcHp[fx[1]] = 0;
        s.flags[`laid_${fx[1]}`] = true;
        break;
      case "setvar":
        s.vars[fx[1]] = fx[2];
        break;
      case "addvar": {
        s.vars[fx[1]] = (s.vars[fx[1]] ?? 0) + fx[2];
        const d = fx[2];
        if (d) {
          // choices that matter must be legible: a companion at hand says so,
          // and a named faction's standing prints its move
          if (fx[1].startsWith("appr_")) {
            const id = fx[1].slice(5);
            const npc = world.npcs[id];
            if (npc && (s.party.includes(id) || s.npcRoom[id] === s.room) && !npcDead(world, s, id)) {
              events.push(`${npc.name} ${Math.abs(d) > 1 ? "strongly " : ""}${d > 0 ? "approves" : "disapproves"}.`);
              if (!s.flags["_seenApproval"]) {
                s.flags["_seenApproval"] = true;
                events.push("(Companions judge what you do: their regard opens some doors and closes others, and one pushed too far walks out.)");
              }
            }
          } else if (world.factions?.[fx[1]]) {
            events.push(`(${world.factions[fx[1]]} ${d > 0 ? "+" : ""}${d})`);
          }
        }
        break;
      }
      case "check": {
        const [, skill, dc, okFx, failFx] = fx;
        const mod = checkMod(world, s, skill);
        const roll = d20(s);
        const total = roll + mod;
        const ok = total >= dc;
        // Fires once, before the very first check a run ever makes, so the
        // "d20:9+2=11 vs DC 9" notation below isn't the player's first sight
        // of it — a separate leading line (not a prefix on that line) so it
        // can't perturb odds.test.ts's line-anchored regex on the roll event.
        if (!s.flags["_seenCheck"]) {
          s.flags["_seenCheck"] = true;
          events.push("(First check: d20 is a 20-sided die roll; DC is the total — roll plus skill — that must reach it.)");
        }
        // States the total vs DC directly (the exact comparison `ok` runs) so
        // there is no derived "needed N+" number to mistranslate back into a
        // total — see oddsHint's comment for the report this replaced. The
        // idiom "(ties win)" got read as being about the raw die roll (e.g.
        // "roll 7 vs DC 10 lost, so ties can't really win"), not the total —
        // spelling the rule out as "(DC+ succeeds)", reusing the DC number
        // already in the line, states the same >= rule without a second,
        // mistranslatable frame.
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
        if (!ok && dc - total <= 2) events.push("So close — that one nearly landed.");
        applyFx(world, s, ok ? okFx : failFx, events);
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
        applyFx(world, s, roll <= pct ? okFx : failFx, events);
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
      case "end":
        s.ended = { kind: fx[1], id: fx[2], text: fx[3] };
        break;
    }
  }
}

function enterRoom(world: World, s: State, roomId: string, events: string[]): void {
  s.room = roomId;
  // the party keeps pace: every living companion arrives with the player
  for (const id of s.party) if (!npcDead(world, s, id)) s.npcRoom[id] = roomId;
  const room = world.rooms[roomId];
  if (!room) return;
  const first = !s.visited.includes(roomId);
  if (first) s.visited.push(roomId);
  if (first && room.onEnterOnce) applyFx(world, s, room.onEnterOnce, events);
  if (room.onEnter) applyFx(world, s, room.onEnter, events);
}

/**
 * One companion remark per party member per turn: the first remark whose
 * conditions pass and that hasn't been spoken yet. Runs after the turn's own
 * effects, so a remark can react to the very choice just made.
 */
function partyRemarks(world: World, s: State, events: string[]): void {
  for (const id of [...s.party]) {
    if (s.ended) return;
    const def = world.npcs[id];
    if (!def || npcDead(world, s, id)) continue;
    // a companion who has had enough walks out before saying anything else
    const gone = def.companion?.leaves?.find((l) => condsOk(world, s, l.if));
    if (gone) {
      events.push(`${def.name}: "${gone.say}"`);
      s.party = s.party.filter((x) => x !== id);
      s.flags[`${id}_left`] = true;
      events.push(`${def.name} leaves your company.`);
      continue;
    }
    for (const r of def.companion?.remarks ?? []) {
      const flag = `remarked_${id}_${r.id}`;
      if (s.flags[flag] || !condsOk(world, s, r.if)) continue;
      s.flags[flag] = true;
      events.push(`${def.name}: "${r.say}"`);
      break;
    }
  }
}

/** An npc hits the player once: armor soaks what it can, at least 1 gets through. */
function npcStrike(world: World, s: State, npcId: string, events: string[], verb: string): void {
  const def = world.npcs[npcId];
  if (!def?.atk) return;
  const armor = armorOf(world, s);
  const taken = Math.max(1, def.atk - armor);
  const absorbed = def.atk - taken;
  events.push(
    absorbed > 0
      ? `${TheName(def.name)} ${verb} — your armor takes ${absorbed} of it.`
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
    if (!def.aggressive || id === except || s.party.includes(id)) continue;
    if (s.npcRoom[id] !== s.room || npcDead(world, s, id)) continue;
    npcStrike(world, s, id, events, "attacks");
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
    visited: [],
    party: [],
    talking: null,
    travelMenu: null,
    ended: null,
  };
  for (const id of Object.keys(world.items)) if (s.itemLoc[id] === "inv") s.inv.push(id);
  const events: string[] = [];
  // with classes, the start room waits until the player picks who they are
  if (!inClassPhase(world, s)) enterRoom(world, s, world.start, events);
  return { state: s, events };
}

// ---------- legal actions ----------
function npcsHere(world: World, s: State): string[] {
  return Object.keys(world.npcs).filter(
    (id) => s.npcRoom[id] === s.room && !npcDead(world, s, id),
  );
}

function itemsHere(world: World, s: State): string[] {
  return Object.keys(world.items).filter((id) => s.itemLoc[id] === s.room);
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
 * True while a conversation is open with an npc who is still here, alive, and
 * has something left to say. The menu is then that npc's topics plus "end
 * conversation" — the room's own menu waits (see format.ts render()).
 */
export const inTalkMode = (world: World, s: State): boolean =>
  s.talking !== null &&
  s.npcRoom[s.talking] === s.room &&
  !npcDead(world, s, s.talking) &&
  visibleTopics(world, s, s.talking).length > 0;

/** A topic whose effects send someone out of the party. */
const partsWays = (t: TopicDef): boolean => (t.fx ?? []).some((f) => f[0] === "party" && f[2] === "leave");

export function legalActions(world: World, s: State): Action[] {
  if (s.ended) return [];
  // class first: nothing else is legal until the player picks who they are
  if (inClassPhase(world, s))
    return Object.keys(world.classes!).map((id) => ({ kind: "classpick", id }));
  // a pending level-up perk choice blocks the menu until spent
  if (s.perkPicks > 0) {
    const picks = eligiblePerks(world, s).sort();
    if (picks.length) return picks.slice(0, MENU_CAP).map((id) => ({ kind: "perkpick", id }));
  }
  // an open conversation: only its topics, and the way out of it
  if (inTalkMode(world, s)) {
    const npc = s.talking!;
    // a line that sends a companion away goes last, never in the slot the
    // player has been pressing to carry the conversation on
    const topics = visibleTopics(world, s, npc).sort((a, b) => Number(partsWays(a)) - Number(partsWays(b)));
    const out: Action[] = topics.map((t) => ({ kind: "talk", npc, topic: t.id }));
    // a farewell line (a topic with `end`) is the way out; the plain "end
    // conversation" only appears when the npc offers none
    if (!topics.some((t) => t.end)) out.push({ kind: "endtalk" });
    return out;
  }
  // the travel menu: destinations (or regions), and the way out of it
  if (inTravelMode(world, s)) return travelActions(world, s);
  const out: Action[] = [];
  const room = world.rooms[s.room];
  if (!room) return out;
  const late: Action[] = []; // attacks on the peaceable, listed after everything else
  for (const dir of Object.keys(room.exits ?? {})) out.push({ kind: "go", dir });
  if (roomIsDark(world, s)) return out; // in the dark you can only feel for exits
  if (travelAvailable(world, s)) out.push({ kind: "travel" });
  for (const a of room.actions ?? [])
    if (customVisible(world, s, a)) out.push({ kind: "custom", room: s.room, id: a.id });
  for (const id of itemsHere(world, s))
    if (world.items[id]?.takeable) out.push({ kind: "take", item: id });
  for (const npc of npcsHere(world, s)) {
    const def = world.npcs[npc]!;
    const topics = visibleTopics(world, s, npc);
    if (def.dialogue) {
      if (topics.length) out.push({ kind: "talkto", npc });
    } else {
      for (const t of topics) out.push({ kind: "talk", npc, topic: t.id });
    }
    // companions are not targets; a stranger who has drawn no blade is one, but
    // the option waits at the foot of the menu, after everything else here
    if (def.hp !== undefined && !s.party.includes(npc))
      (def.hostile || def.aggressive ? out : late).push({ kind: "attack", npc });
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
  return out;
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
    case "endtalk":
      return "end conversation";
    case "travel":
      return "travel to a known place";
    case "travelregion":
      return a.region ? `toward ${world.regions?.[a.region]?.name ?? a.region}` : "toward places elsewhere";
    case "travelto":
      return `to ${world.rooms[a.room]?.landmark ?? a.room}`;
    case "traveldone":
      return s?.travelMenu ? "back" : "stay here";
    case "attack": {
      const npcName = world.npcs[a.npc]?.name ?? a.npc;
      const weapon = s ? bestWeapon(world, s).item : null;
      const weaponName = weapon ? world.items[weapon]?.name : "bare hands";
      return `attack ${npcName} with ${weaponName}`;
    }
    case "custom":
      return world.rooms[a.room]?.actions?.find((x) => x.id === a.id)?.label ?? a.id;
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

export function oddsHint(world: World, s: State, a: Action, opts: { itemHints?: boolean } = {}): string {
  if (a.kind === "custom" && world.rooms[a.room]?.actions?.find((x) => x.id === a.id)?.free) return " (free)";
  if (a.kind === "travelregion" && a.region) {
    // a region entry opens a second menu; say how many known places wait behind it
    const n = knownLandmarks(world, s).filter((id) => (world.rooms[id]?.region ?? "") === a.region).length;
    return ` (${n} known ${n === 1 ? "place" : "places"})`;
  }
  if (a.kind === "attack") {
    const def = world.npcs[a.npc];
    if (!def) return "";
    const need = Math.max(1, (def.df ?? 10) - attackBonus(world, s));
    return ` (roll ${need}+ on the die)`;
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
    return toward ? ` (toward ${toward})` : "";
  }
  const fx = fxFor(world, s, a);
  const chk = fx?.[0];
  if (chk && chk[0] === "check") {
    // all three numbers, so neither frame can be misread: the DC the total must
    // reach, the modifier, and the die roll that gets there
    const mod = checkMod(world, s, chk[1]);
    const need = Math.max(1, chk[2] - mod);
    if (!mod) return ` (DC ${chk[2]}, ${chk[1]}: roll ${need}+ on the die)`;
    return ` (DC ${chk[2]}, ${mod > 0 ? "+" : ""}${mod} ${chk[1]}: roll ${need}+ on the die)`;
  }
  if (a.kind === "use" && opts.itemHints !== false) {
    // an item's use can sit in the menu for the rest of the game, so its hint
    // is shown where a place is first shown (and in status), not on every screen
    const hint = itemHint(world, s, a.item);
    return hint ? ` (${hint})` : "";
  }
  return "";
}

export function step(world: World, prev: State, action: Action): StepOut {
  const legal = legalActions(world, prev);
  const key = canon(action);
  if (!legal.some((a) => canon(a) === key)) {
    return { state: prev, events: ["Illegal action — pick a number from the menu."] };
  }
  const s: State = structuredClone(prev);
  const events: string[] = [];
  // opening the travel menu, picking a region, or backing out is browsing, not a turn;
  // only the journey itself (travelto) and everything else costs one
  const freeCustom =
    action.kind === "custom" && !!world.rooms[action.room]?.actions?.find((x) => x.id === action.id)?.free;
  if (!freeCustom && action.kind !== "travel" && action.kind !== "travelregion" && action.kind !== "traveldone") s.turn += 1;
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
      s.itemLoc[action.item] = "inv";
      s.inv.push(action.item);
      const def = world.items[action.item];
      const label = def?.name ?? action.item;
      const hint = itemHint(world, s, action.item);
      events.push(hint ? `${label}: taken. (${hint})` : `${label}: taken.`);
      break;
    }
    case "use": {
      const u = useDefFor(world, s, action.item);
      if (u) applyFx(world, s, u.fx, events);
      else events.push("Nothing happens.");
      break;
    }
    case "talk": {
      const t = world.npcs[action.npc]?.topics?.find((x) => x.id === action.topic);
      if (!t) break;
      if (t.once) s.flags[`said_${action.npc}_${t.id}`] = true;
      events.push(`${world.npcs[action.npc]?.name}: "${t.say}"`);
      if (t.fx) applyFx(world, s, t.fx, events);
      // a conversation closes on its own when the line says so, or when the
      // npc has nothing left to say / is no longer here (inTalkMode covers
      // the latter two — clearing here just keeps the state tidy)
      if (s.talking === action.npc && (t.end || !inTalkMode(world, s))) s.talking = null;
      break;
    }
    case "talkto":
      s.talking = action.npc;
      break;
    case "endtalk":
      s.talking = null;
      break;
    case "travel":
      s.travelMenu = "";
      break;
    case "travelregion":
      s.travelMenu = action.region;
      break;
    case "traveldone":
      // from inside a region list, step back to the region list; else close
      s.travelMenu = s.travelMenu && knownLandmarks(world, s).length > MENU_CAP - 1 ? "" : null;
      break;
    case "travelto": {
      s.travelMenu = null;
      events.push(`You travel to ${world.rooms[action.room]?.landmark ?? action.room}.`);
      enterRoom(world, s, action.room, events);
      break;
    }
    case "attack": {
      const def = world.npcs[action.npc]!;
      const w = bestWeapon(world, s);
      const hit = attackBonus(world, s, w);
      const roll = d20(s);
      const df = def.df ?? 10;
      const total = roll + hit;
      if (total >= df) {
        const dmg = (roll === 20 ? w.dmg * 2 : w.dmg) + perkBonus(world, s, "dmg");
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
        if (!c?.companion || npcDead(world, s, id) || s.npcRoom[id] !== s.room) continue;
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
        if (def.onDeath) applyFx(world, s, def.onDeath, events);
      } else if (def.atk) {
        npcStrike(world, s, action.npc, events, "strikes back");
        attacked = action.npc;
      }
      break;
    }
    case "custom": {
      const a = world.rooms[action.room]?.actions?.find((x) => x.id === action.id);
      if (!a) break;
      if (a.once) s.flags[`did_${a.id}`] = true;
      applyFx(world, s, a.fx, events);
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
    aggressivePass(world, s, events, attacked);
    partyRemarks(world, s, events);
  }
  journalEvents(world, prev, s, events);
  // Once, the first time fast travel is on the menu: a playtester walked the
  // whole map on foot for ninety turns before noticing the entry.
  if (!s.ended && !s.flags["_seenTravel"] && travelAvailable(world, s)) {
    s.flags["_seenTravel"] = true;
    events.push("(You know more than one place now: 'travel to a known place' moves you between landmarks in one turn.)");
  }
  // Once per region, the first time the exits line there would carry a * (an
  // unexplored side trip): locked exits explain themselves inline, this marker
  // did not, and a player who met it in the Vale had forgotten it by Thornwold.
  const seenKey = `_seenSideTrip_${world.rooms[s.room]?.region ?? ""}`;
  if (!s.ended && !s.flags[seenKey]) {
    const exits = world.rooms[s.room]?.exits ?? {};
    if (Object.values(exits).some((ex) => ex.sideTrip && !s.visited.includes(ex.to))) {
      s.flags[seenKey] = true;
      events.push("(* marks an optional side path not yet visited.)");
    }
  }
  return { state: s, events };
}

/** Find a legal action by its rendered label (used by walkthroughs and the CLI). */
export function actionByLabel(world: World, s: State, label: string): Action | null {
  const want = label.trim().toLowerCase();
  for (const a of legalActions(world, s))
    if (actionLabel(world, a, s).toLowerCase() === want) return a;
  return null;
}
