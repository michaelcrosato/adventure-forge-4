/**
 * tinyforge observation format — the token budget lives here.
 *
 * One plain-text block per turn is the ENTIRE interface: header, events, scene,
 * numbered menu. No JSON envelope, no legend, no second tool call. Numbered
 * replies keep the agent's answer to a couple of tokens.
 *
 * render() is PURE — whether to show the full room prose (first sight) or the
 * brief line (revisit) is the caller's memo (per-session, not game state), so
 * traces replay identically no matter how the text was rendered.
 */
import { actionLabel, checkMod, checkModParts, combatMods, companyHere, condOk, FAILED_CHECKS_MAX, failedChecks, hashState, inClassPhase, inCompanyMode, inPerkPickPhase, inTalkMode, inTravelMode, itemHint, journal, legalActions, menuNumbers, oddsHint, receipt, roomIsDark, roomPageOf, roomView , wildBearing} from "./engine.ts";
import { ATTRS, EPILOGUE_CAP, EPILOGUE_CHARS } from "./types.ts";
import type { Action, Cond, State, World } from "./types.ts";

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/** status lists every visited place by name up to this many; beyond it, a count and the latest few. */
export const VISITED_FULL = 12;
export const VISITED_RECENT = 5;

/**
 * A canonical label's trailing skill tag, when the hint beside it already names
 * that skill: "slip past him along the bough (grace) (DC 10, +2 grace: roll 8+
 * on the die)" says grace twice, a foot apart, 513 option lines deep across the
 * proven roads. Dropped from the display only — the canonical label is what
 * `actionByLabel` and every walkthrough and proof step match on, and it does
 * not move (see matchesMenuLabel, which knows about this).
 *
 * Only an exact bare tag: `(will, 1hp fail)` says something the hint does not
 * and stays.
 */
const SKILL_TAG = / \((might|grace|wits|will)\)$/;
function shownLabel(label: string, hint: string): string {
  const m = SKILL_TAG.exec(label);
  return m && new RegExp(`\\b${m[1]}\\b`).test(hint) ? label.slice(0, -m[0].length) : label;
}

export function renderMenu(world: World, s: State, opts: { itemHints?: boolean } = {}): { text: string; actions: Action[]; numbers: number[] } {
  const actions = legalActions(world, s);
  // the number is the entry's place in the room's whole option list, not on
  // the page showing — see menuNumbers, and the two players who pressed a
  // number that had meant something else a page ago
  const numbers = menuNumbers(world, s);
  const text = actions
    .map((a, i) => {
      const hint = oddsHint(world, s, a, opts);
      return `${numbers[i]} ${shownLabel(actionLabel(world, a, s), hint)}${hint}`;
    })
    .join("\n");
  return { text, actions, numbers };
}

/**
 * The inverse of renderMenu's line format, for clients that only see rendered
 * text (the mock players) and want to follow a walkthrough by canonical label:
 * a menu line is the canonical label, optionally followed by exactly one
 * display-only hint from oddsHint — always " (…)" at the end, whatever its
 * kind (roll odds, locked-exit clue, destination landmark, item-use preview).
 * Parentheses that belong to the label itself ("(scholar)", a perk's "(desc)")
 * survive because the whole canonical label is matched first. Callers should
 * prefer an exact match over this looser one when both are on offer.
 */
export function matchesMenuLabel(line: string, canonical: string): boolean {
  const a = line.trim().toLowerCase();
  const b = canonical.trim().toLowerCase();
  const like = (x: string) => a === x || (a.startsWith(`${x} (`) && a.endsWith(")"));
  if (like(b)) return true;
  // and the one place the rendered line is not the canonical label followed by
  // a hint: renderMenu drops a trailing skill tag the hint already names (see
  // shownLabel), so "swim it (grace)" renders as "swim it (DC 12, +2 grace: …)".
  // The same test shownLabel makes, so a line whose hint names a different
  // skill is a different option and does not match.
  const m = SKILL_TAG.exec(b);
  if (!m) return false;
  const bare = b.slice(0, -m[0].length);
  return like(bare) && new RegExp(`\\b${m[1]}\\b`).test(a.slice(bare.length));
}

export function render(
  world: World,
  s: State,
  events: string[],
  opts: { full?: boolean } = {},
): { text: string; actions: Action[]; numbers: number[] } {
  if (s.ended) {
    const e = s.ended;
    // how the world remembers what you did: every epilogue line whose
    // conditions hold competes for EPILOGUE_CAP places — heavier lines first
    // (weight, default 0), then file order — and the survivors print in file
    // order, so a realm's telling still runs first act, holds, capital
    const matching = (world.epilogue ?? [])
      .map((ep, i) => ({ ep, i }))
      .filter(({ ep }) => ep.if.every((c) => condOk(world, s, c)))
      .sort((a, b) => (b.ep.weight ?? 0) - (a.ep.weight ?? 0) || a.i - b.i);
    const chosen: typeof matching = [];
    let chars = 0;
    for (const m of matching) {
      if (chosen.length >= EPILOGUE_CAP) break;
      if (chars + m.ep.text.length + 1 > EPILOGUE_CHARS) continue; // a shorter line further down may still fit
      chosen.push(m);
      chars += m.ep.text.length + 1;
    }
    const epilogue = chosen.sort((a, b) => a.i - b.i).map(({ ep }) => ep.text);
    const lines = [
      ...events.map((x) => `[${x}]`),
      `*** ${e.kind.toUpperCase()}: ${e.id} ***`,
      e.text,
      ...epilogue,
      `score:${s.score}/${world.maxScore} turns:${s.turn} seed:${s.seed}`,
      `(score is a bonus tally of discoveries and choices; status tells the rest of the tale)`,
      `receipt:${receipt(world, s)}`,
    ];
    return { text: lines.join("\n"), actions: [], numbers: [] };
  }

  if (inClassPhase(world, s)) {
    const lines = [
      ...(events.length ? [`[${events.join(" ")}]`] : []),
      "Choose who you are.",
    ];
    if (world.progress) {
      const v = s.vars[world.progress.var] ?? 0;
      lines.push(`${world.progress.label}: ${v}/${world.progress.max}`);
    }
    const menu = renderMenu(world, s, { itemHints: !!opts.full });
    lines.push(menu.text);
    return { text: lines.join("\n"), actions: menu.actions, numbers: menu.numbers };
  }

  const room = world.rooms[s.room];
  const view = roomView(world, s);
  const dark = roomIsDark(world, s);
  const lines: string[] = [];
  const lvl = world.classes ? ` L${s.level}` : "";
  const hud = (world.hud ?? []).map((h) => ` ${h.label}${s.vars[h.var] ?? 0}`).join("");
  // active conditions, compact: " [winded 2 braced 1]" — costs nothing when none are active
  const condTxt = Object.keys(s.conds).sort().map((id) => `${world.conditions?.[id]?.name ?? id} ${s.conds[id]}`).join(" ");
  const conds = condTxt ? ` [${condTxt}]` : "";
  // No running score in the turn header. The tally moved to `status`, where the
  // line that says what the denominator means lives (two blind players read
  // "198/366" as a share of the realm), and the turn a deed earns anything says
  // so itself — applyFx pushes "(+3)" as an event. A total restated on every
  // screen in between was 2,328 characters along the realm's walkthrough, on a
  // budget with a thousand to spare, to tell a player something no turn of
  // theirs had changed.
  // which page of a crowded room is showing: the ways out stay on every page,
  // so the numbers under them move when the page does
  const pg = roomPageOf(world, s);
  const page = pg ? ` p${pg.page}/${pg.pages}` : "";
  lines.push(
    `=${view.name} | hp${s.hp}/${s.maxHp}${lvl} t${s.turn}${hud}${conds}${page}`,
  );
  // One event per line inside the one bracket. Arriving in a hold with a full
  // party prints the hold's own arrival text and then each companion's reaction
  // to it — good content, and it was being run together into a single
  // 1,043-character bracket at the Cairn-Track, the widest screen on any proven
  // road. A newline where a space was costs nothing and gives each voice its
  // own line; with one event it reads exactly as it did.
  if (events.length) lines.push(`[${foldNotices(events).join("\n")}]`);
  if (world.progress) {
    const v = s.vars[world.progress.var] ?? 0;
    lines.push(`${world.progress.label}: ${v}/${world.progress.max}`);
  }
  if (s.inv.length && opts.full) {
    // the pack is listed where a place is first shown and in status; a brief
    // view spends its characters on what changed
    const carried = s.inv.map((id) => world.items[id]?.name ?? id);
    lines.push(`carrying: ${carried.join(", ")}`);
  }

  if (inPerkPickPhase(world, s)) {
    const menu = renderMenu(world, s, { itemHints: !!opts.full });
    lines.push("Level up. Pick 1 perk/lvl for fights & checks (perm).");
    lines.push(menu.text);
    return { text: lines.filter(Boolean).join("\n"), actions: menu.actions, numbers: menu.numbers };
  }

  // an open conversation: the npc's line is in the events; the room waits
  if (inTalkMode(world, s)) {
    const menu = renderMenu(world, s, { itemHints: !!opts.full });
    lines.push(`talking with ${world.npcs[s.talking!]?.name ?? s.talking}`);
    lines.push(menu.text);
    return { text: lines.filter(Boolean).join("\n"), actions: menu.actions, numbers: menu.numbers };
  }

  // the travel menu: known places, nothing else
  if (inTravelMode(world, s)) {
    const menu = renderMenu(world, s, { itemHints: !!opts.full });
    lines.push("Travel — places you know:");
    lines.push(menu.text);
    return { text: lines.filter(Boolean).join("\n"), actions: menu.actions, numbers: menu.numbers };
  }
  // the company list: who is with you, nothing else
  if (inCompanyMode(world, s)) {
    const menu = renderMenu(world, s, { itemHints: !!opts.full });
    lines.push("Your company:");
    lines.push(menu.text);
    return { text: lines.filter(Boolean).join("\n"), actions: menu.actions, numbers: menu.numbers };
  }

  if (dark) {
    lines.push("Pitch dark. You can only feel for the exits.");
  } else {
    if (opts.full) lines.push(view.desc);
    else if (view.brief) lines.push(view.brief);
    const here = Object.keys(world.items)
      .filter((id) => s.itemLoc[id] === s.room)
      .map((id) => world.items[id]?.name ?? id);
    if (here.length) lines.push(`you notice ${here.join(", ")} here`);
    // a hostile who will still talk is told from one who only fights
    const talks = new Set(
      legalActions(world, s).flatMap((a) => (a.kind === "talk" || a.kind === "talkto" ? [a.npc] : [])),
    );
    const npcs = Object.entries(world.npcs)
      .filter(([id]) => s.npcRoom[id] === s.room && !s.party.includes(id))
      .map(([id, d]) => {
        const hp = s.npcHp[id] ?? d.hp ?? 1;
        // an npc's one-line desc shows on the full view (first sight, look), not on revisits
        const tail = opts.full && d.desc ? ` — ${d.desc}` : "";
        if (hp <= 0) return `${d.name} (${s.flags[`laid_${id}`] ? "at rest" : "dead"})`;
        const pierce = d.pierce ? ", armor useless" : "";
        // active conditions, folded into the existing parenthetical (or a new one, if it carried none) — empty when it holds none
        const condTag = Object.keys(s.npcConds[id] ?? {}).sort().map((cid) => `${world.conditions?.[cid]?.name ?? cid} ${s.npcConds[id]![cid]}`).join(", ");
        const withCond = condTag ? `, ${condTag}` : "";
        // a standoff content has ended (`calm`) reads as the peace it is
        if ((d.aggressive || d.hostile) && s.flags[`calm_${id}`]) return `${d.name} is here (stood down${withCond})${tail}`;
        if (d.aggressive) return `${d.name} (hostile, attacks on sight, hp${hp}/${d.hp ?? 1}${pierce}${withCond})${tail}`;
        // a hostile that is not aggressive never strikes first: say so, so walking past reads as the choice it is
        if (d.hostile) return `${d.name} (hostile, holds its ground, hp${hp}/${d.hp ?? 1}${pierce}${talks.has(id) ? ", will hear you out" : ""}${withCond})${tail}`;
        return condTag ? `${d.name} is here (${condTag})${tail}` : `${d.name} is here${tail}`;
      });
    if (npcs.length) lines.push(npcs.join("; "));
    // Only the companions the menu does not already name as company. With two
    // or more to speak with, "speak with the company (Vell, Tamsin, Brother
    // Osk, Lys)" is right there on the menu and this line repeated it word for
    // word — forty characters on every screen of the full-party road, to say
    // what the screen already said.
    //
    // Below two it stays, all of it. A lone "talk to Lys" does not say she is
    // travelling with you: an npc merely standing in the room reads the same
    // way, and the difference is the whole point of the line. Only the word
    // "company" makes it unambiguous, and that only appears at two or more. A
    // companion with nothing to say is on no menu entry at all and always
    // belongs here.
    const named = new Set(companyHere(world, s));
    const quiet = s.party.filter((id) => !named.has(id) || named.size < 2);
    if (quiet.length) lines.push(`with you: ${quiet.map((id) => world.npcs[id]?.name ?? id).join(", ")}`);
  }

  // Deep in a generated wilderness, where you stand counted from the nearest
  // named place you have already been. Three playtest reports asked for this:
  // the bearings are right, but following "three north, then two east" meant
  // counting hops by hand. Nothing prints next door to a place you know, or
  // where you have not yet stood in one.
  if (!dark) {
    const bearing = wildBearing(world, s);
    if (bearing) lines.push(bearing);
  }

  // No "exits: N W E S" line. legalActions offers every exit as its own numbered
  // `go <dir>` — locked ones included — so the line restated the menu directly
  // under it, at 2,569 characters along the realm's walkthrough, on a budget with
  // twenty to spare. Its one piece of its own, the "*" on an unwalked side trip,
  // moved into the `go` line, where it says what it means: two playtest reports
  // asked what the asterisk was and nothing on the screen ever answered.

  const menu = renderMenu(world, s, { itemHints: !!opts.full });
  lines.push(menu.text);
  return { text: lines.filter(Boolean).join("\n"), actions: menu.actions, numbers: menu.numbers };
}

/**
 * Free, any-time check (no turn cost) — recaps the objectives, every tracked
 * path (e.g. verses vs crown), which faction/branch choices currently stand
 * (e.g. sealed vs open), which rooms have already been visited (a memory aid
 * against repetitive backtracking), what's carried, held perks, and current
 * check/combat modifier totals, so a player can confirm their build right
 * before committing to a major choice instead of re-summing perks by hand.
 */
/** A bare mechanical notice: "(+5)", "(-2)", "(+3xp)", "(the Watch +2)", "(Lys -1)". */
const NOTICE = /^\((?:[+-]\d+(?:xp)?|.{1,28} [+-]\d+)\)$/;

/**
 * A turn's mechanical notices fold onto one line, and its score and xp add up.
 *
 * One action can earn score twice and xp twice, and each pushed its own event.
 * Given a line each (which is what makes four companions answering a hold
 * legible) that became "(+5)", "(+3xp)", "(+5xp)", "(+5)" down the screen —
 * four lines to say two numbers. A run of them now reads "(+10, +8xp)".
 *
 * Only adjacent runs fold. A notice sits directly after the thing that earned
 * it, and prose between two of them means they belong to different moments;
 * merging across that would move a number away from its cause.
 */
function foldNotices(events: string[]): string[] {
  const out: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (!run.length) return;
    if (run.length === 1) out.push(run[0]!);
    else {
      let score = 0, xp = 0;
      const named: string[] = [];
      for (const e of run) {
        const body = e.slice(1, -1);
        const num = /^([+-]\d+)(xp)?$/.exec(body);
        if (num) { if (num[2]) xp += Number(num[1]); else score += Number(num[1]); continue; }
        named.push(body);
      }
      const parts: string[] = [];
      if (score) parts.push(`${score > 0 ? "+" : ""}${score}`);
      if (xp) parts.push(`${xp > 0 ? "+" : ""}${xp}xp`);
      parts.push(...named);
      out.push(`(${parts.join(", ")})`);
    }
    run = [];
  };
  for (const e of events) {
    if (NOTICE.test(e)) run.push(e);
    else { flush(); out.push(e); }
  }
  flush();
  return out;
}

export function renderStatus(world: World, s: State): string {
  const lines: string[] = [];
  // the recap follows the story: a staged objectives list shows its first entry whose conditions hold
  const obj = world.objectives;
  const recap = Array.isArray(obj) ? obj.find((o) => o.if.every((c) => condOk(world, s, c)))?.text : (obj ?? world.intro);
  // after the end, the recap would point forward; say instead that the tale is told
  if (s.ended) lines.push("The tale is told. What follows is how things stood at the end; the quests listed are the ones left undone.");
  else if (recap) lines.push(recap);
  // the score's ceiling lives here, not in every turn's header, where it read as a progress bar
  // the turn, so a player counting a budget need not cross-reference the last screen's header
  if (s.turn > 0) lines.push(`Turn ${s.turn}.`);
  if (world.maxScore !== undefined)
    // Two blind players in one wave read "198/366" as how much of the realm
    // they had seen and concluded they were two-thirds done. The old note said
    // the tally "can fill long before the tale ends", which is not true of any
    // proven route — the walkthrough reaches 366 on its last turn — so it
    // misled twice over. Say what the denominator actually is.
    lines.push(`Score: ${s.score} (deeds and discoveries; ${world.maxScore} is what one whole route pays, and there is more realm than one route)`);
  if (s.ended) {
    // the ending screen fits six lines; here the whole telling is free
    const told = (world.epilogue ?? []).filter((ep) => ep.if.every((c) => condOk(world, s, c))).map((ep) => `- ${ep.text}`);
    if (told.length) lines.push(`How the realm remembers you:\n${told.join("\n")}`);
  }
  type Track = { var: string; label: string; max: number; remaining?: { flag: string; label: string }[]; if?: Cond[] };
  const tracks: Track[] = world.statusTracks ?? (world.progress ? [world.progress] : []);
  for (const t of tracks) {
    if (t.if && !t.if.every((c) => condOk(world, s, c))) continue;
    let line = `${t.label}: ${s.vars[t.var] ?? 0}/${t.max}`;
    const remaining = t.remaining?.filter((r) => !s.flags[r.flag]);
    if (remaining?.length) line += ` (unexplored: ${remaining.map((r) => r.label).join(", ")})`;
    lines.push(line);
  }
  for (const p of world.statusPaths ?? []) {
    if (p.if && !p.if.every((c) => condOk(world, s, c))) continue;
    const hit = p.states.find((st) => st.if.every((c) => condOk(world, s, c)));
    const text = hit?.text ?? p.fallback;
    // a path that names its var shows the number too, so a "+1" that has not moved the label still reads as something
    const v = p.var ? (s.vars?.[p.var] ?? 0) : undefined;
    const num = v === undefined ? "" : ` (${v > 0 ? "+" : ""}${v})`;
    if (text) lines.push(`${p.label}: ${text}${num}`);
  }
  // the journal: every active quest with its current line, then the closed ones by name
  if (world.quests) {
    const q = journal(world, s);
    const active = q.filter((x) => x.status === "active");
    // the road (quests marked main) reads first, apart from the side threads
    const road = active.filter((x) => world.quests?.[x.id]?.main);
    const side = active.filter((x) => !world.quests?.[x.id]?.main);
    if (road.length) lines.push(`${s.ended ? "The road, as it ended" : "The road"}:\n${road.map((x) => `- ${x.name}: ${x.text}`).join("\n")}`);
    // a hold's grief — the quest that settles its hollow — is named as such, so
    // a town's side threads never read as the thing the hold is waiting on
    const grief = (id: string) => /_hollow_|hollows_|hollow_(resolved|done|good)/.test(JSON.stringify(world.quests?.[id]?.done ?? []));
    if (side.length) lines.push(`${s.ended ? "Left undone" : "Quests"}:\n${side.map((x) => `- ${x.name}${grief(x.id) ? " (this hold's grief)" : ""}: ${x.text}`).join("\n")}`);
    const done = q.filter((x) => x.status === "done").map((x) => x.name);
    if (done.length) lines.push(`Done: ${done.join(", ")}`);
    const failed = q.filter((x) => x.status === "failed").map((x) => x.name);
    // a quest whose asker's wish can no longer be met reads as closed, the word the journal event used
    if (failed.length) lines.push(`Closed: ${failed.join(", ")}`);
  }
  for (const h of world.hud ?? []) lines.push(`${h.label}: ${s.vars[h.var] ?? 0}`);
  // The visited list is a memory aid, not a map: past a dozen places it
  // becomes a wall of names that costs tokens every time status is called,
  // so a big world shows the count and the most recent few instead.
  const visited = s.visited ?? [];
  if (visited.length) {
    const names = visited.map((id) => world.rooms?.[id]?.name ?? id);
    if (names.length <= VISITED_FULL) lines.push(`Visited: ${names.join(", ")}`);
    else lines.push(`Visited: ${names.length} places (lately: ${names.slice(-VISITED_RECENT).join(", ")})`);
  }
  if (s.inv.length) {
    // status is the one place every carried item's hint is always listed
    const carried = s.inv.map((id) => {
      const it = world.items[id];
      const hint = itemHint(world, s, id);
      return it ? (hint ? `${it.name} (${hint})` : it.name) : id;
    });
    lines.push(`carrying: ${carried.join(", ")}`);
  }
  if (s.party?.length) {
    // regard in numbers, the same ones the "(Lys -1)" events move, so how near a companion is to walking is never a guess
    const party = s.party.map((id) => {
      const def = world.npcs[id];
      const name = def?.name ?? id;
      const a = s.vars?.[`appr_${id}`] ?? 0;
      const bits: string[] = [];
      // regard is always shown, from the day they join; at -2 the next thing they mind is the last
      bits.push(`regard ${a > 0 ? "+" : ""}${a}${a <= -2 ? ", near leaving" : ""}`);
      if (def?.hp !== undefined) bits.push(`hp ${s.npcHp?.[id] ?? def.hp}/${def.hp}${s.flags?.[`down_${id}`] ? ", down" : ""}`);
      return bits.length ? `${name} (${bits.join(", ")})` : name;
    });
    // a companion below full strength: say where healing is, since no carried item reaches them
    const hurt = s.party.some((id) => { const def = world.npcs[id]; return def?.hp !== undefined && (s.npcHp?.[id] ?? def.hp) < def.hp; });
    lines.push(`Party: ${party.join(", ")}${hurt ? " — a rest at any hearth heals them" : ""}`);
  }
  if (s.perks?.length) {
    const perks = s.perks.map((id) => {
      const p = world.perks?.[id];
      return p ? `${p.name} (${p.desc})` : id;
    });
    lines.push(`Perks: ${perks.join(", ")}`);
  }
  // optional-chained like party/perks above: a caller that predates this field stays valid
  if (Object.keys(s.conds ?? {}).length) {
    // remaining turns, plus the condition's own hint if it carries one — the
    // same numbers the HUD tag and the Checks/Combat totals below already count
    const conds = Object.keys(s.conds)
      .sort()
      .map((id) => {
        const def = world.conditions?.[id];
        const n = s.conds[id]!;
        return `${def?.name ?? id} (${n} turn${n === 1 ? "" : "s"} left)${def?.hint ? ` — ${def.hint}` : ""}`;
      });
    lines.push(`Conditions: ${conds.join("; ")}`);
  }
  // A check that has cost a retry is worth surfacing somewhere: the odds
  // preview already shows the raised DC on the room/topic itself, but a
  // player who has walked away from one (or three) has no other way to
  /**
   * Where the player stands with each faction, and the rank they hold.
   *
   * `world.factions` existed only to name a faction inside an event — "(the
   * Gray Church +2)" — and was never shown anywhere as a total. Six factions,
   * two ranks each, payoffs for those ranks wired into all sixteen regions,
   * and a player had no way to learn they were at +13 with the Church, that a
   * rank existed at all, or how close they were to one. The fourth wave's
   * three players reached keepers +25, church +13, watch +6 and free +5
   * between them, every one of those past a threshold, and collected two
   * ranks in total.
   *
   * The rank comes off the flags content already sets by convention —
   * `rep_keepers` pairs with `keepers_trusted` and `keepers_sworn` — so this
   * needs nothing new in the world data. Standing at zero is left out: it
   * means the faction has not entered the story yet.
   */
  const standing = Object.entries(world.factions ?? {})
    .map(([v, name]) => ({ v, name, n: s.vars[v] ?? 0, code: v.replace(/^rep_/, "") }))
    .filter((f) => f.n !== 0)
    .sort((a, b) => b.n - a.n)
    .map((f) => {
      const rank = s.flags[`${f.code}_sworn`] ? " sworn" : s.flags[`${f.code}_trusted`] ? " trusted" : "";
      return `${f.name} ${f.n > 0 ? "+" : ""}${f.n}${rank}`;
    });
  if (standing.length) lines.push(`Standing: ${standing.join(", ")}`);
  // recall that later. Worst-tried first; past FAILED_CHECKS_MAX, a plain
  // count for the rest rather than a line that grows without bound.
  const tried = failedChecks(world, s);
  if (tried.length) {
    const shown = tried.slice(0, FAILED_CHECKS_MAX).map((f) => `${f.label} (${f.attempts}x, now DC ${f.dc})`);
    const more = tried.length > FAILED_CHECKS_MAX ? `, +${tried.length - FAILED_CHECKS_MAX} more` : "";
    lines.push(`Failed before: ${shown.join(", ")}${more}`);
  }
  // Only worlds with a character system carry attrs/perks worth summing; a
  // classless world's s.attrs stays empty all game, so this would be an
  // all-zero, meaningless line there.
  if (world.classes && s.attrs) {
    // Breakdown only shown when more than one thing stacks into a check
    // (base plus at least one perk) — matches the same "+N label" style as
    // the post-roll check event, so the two frames read as one system.
    const checks = ATTRS.map((a) => {
      const parts = checkModParts(world, s, a);
      const breakdown =
        parts.length > 1 ? ` (${parts.map((p) => `${p.n > 0 ? "+" : ""}${p.n} ${p.label}`).join(", ")})` : "";
      return `${a}${signed(checkMod(world, s, a))}${breakdown}`;
    }).join(" ");
    lines.push(`Checks: ${checks}`);
    const cm = combatMods(world, s);
    // name the weapon and armor that count, so a second piece is known not to stack
    const by = (id: string | null) => (id ? ` (${world.items[id]?.name ?? id})` : "");
    lines.push(`Combat: hit${signed(cm.hit)} dmg${signed(cm.dmg)}${by(cm.weapon)} armor${signed(cm.armor)}${by(cm.armorItem)}`);
    // An ability spends a pool, and until now nothing anywhere said how much was
    // left in it — not the menu, not here. A Warden could press "break them"
    // twice and find out the third time by its absence. Only pools this
    // character's abilities can actually spend are listed, so a Scholar is not
    // shown the Warden's.
    const mine = new Map<string, string>(); // pool -> the class whose ability spends it
    for (const ab of Object.values(world.abilities ?? {})) {
      const forMe = (ab.if ?? []).every((c) => !(c[0] === "class" && c[1] !== s.classId) && !(c[0] === "!class" && c[1] === s.classId));
      if (!forMe) continue;
      const cls = (ab.if ?? []).find((c) => c[0] === "class")?.[1];
      const named = typeof cls === "string" ? (world.classes?.[cls]?.name ?? "") : "";
      for (const c of ab.if ?? []) if (c[0] === "var" && typeof c[1] === "string" && c[1] in (world.resources ?? {})) mine.set(c[1], named);
      for (const f of ab.fx ?? []) if (f[0] === "addvar" && typeof f[1] === "string" && f[1] in (world.resources ?? {})) mine.set(f[1], named);
    }
    const pools = [...mine].sort(([a], [b]) => a.localeCompare(b))
      .map(([v, named]) => `${named ? `${named} ` : ""}${s.vars[v] ?? 0}/${world.resources![v]}`);
    if (pools.length) lines.push(`Ready to spend: ${pools.join(", ")} (a rest fills it)`);
  }
  return lines.length ? lines.join("\n") : "No progress to report.";
}

export function renderIntro(
  world: World,
  s: State,
  events: string[],
): { text: string; actions: Action[]; numbers: number[] } {
  const body = render(world, s, events, { full: true });
  const head = [
    `${world.title} (seed ${s.seed})`,
    world.intro,
    `Goal: reach an ending. hp0 = death. One action per turn: act(s, n) with a menu number. look(s)/status(s): free scene/quest/items recap incl. every path, no turn spent. hash ${hashState(s)}.`,
  ].join("\n");
  return { text: `${head}\n${body.text}`, actions: body.actions, numbers: body.numbers };
}
