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
import { actionLabel, checkMod, checkModParts, combatMods, condOk, hashState, inClassPhase, inPerkPickPhase, inTalkMode, inTravelMode, journal, legalActions, oddsHint, receipt, roomIsDark, roomView } from "./engine.ts";
import { ATTRS, EPILOGUE_CAP } from "./types.ts";
import type { Action, State, World } from "./types.ts";

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export function renderMenu(world: World, s: State): { text: string; actions: Action[] } {
  const actions = legalActions(world, s);
  const text = actions
    .map((a, i) => `${i + 1} ${actionLabel(world, a, s)}${oddsHint(world, s, a)}`)
    .join("\n");
  return { text, actions };
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
  return a === b || (a.startsWith(`${b} (`) && a.endsWith(")"));
}

// Compass abbreviations for the "exits:" orientation line — every direction
// word a world actually uses (see world/*.json); anything else falls back to
// its capitalized self.
const DIR_ABBR: Record<string, string> = {
  north: "N",
  south: "S",
  east: "E",
  west: "W",
  up: "U",
  down: "D",
  in: "In",
  out: "Out",
};

function exitAbbr(dir: string): string {
  return DIR_ABBR[dir] ?? dir.charAt(0).toUpperCase() + dir.slice(1);
}

export function render(
  world: World,
  s: State,
  events: string[],
  opts: { full?: boolean } = {},
): { text: string; actions: Action[] } {
  if (s.ended) {
    const e = s.ended;
    // how the world remembers what you did: every epilogue line whose
    // conditions hold, in authored order, up to the cap
    const epilogue = (world.epilogue ?? [])
      .filter((ep) => ep.if.every((c) => condOk(world, s, c)))
      .slice(0, EPILOGUE_CAP)
      .map((ep) => ep.text);
    const lines = [
      ...events.map((x) => `[${x}]`),
      `*** ${e.kind.toUpperCase()}: ${e.id} ***`,
      e.text,
      ...epilogue,
      `score:${s.score}/${world.maxScore} turns:${s.turn} seed:${s.seed}`,
      `(score tallies discoveries and choices along the way — a bonus, not required)`,
      `receipt:${receipt(world, s)}`,
    ];
    return { text: lines.join("\n"), actions: [] };
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
    const menu = renderMenu(world, s);
    lines.push(menu.text);
    return { text: lines.join("\n"), actions: menu.actions };
  }

  const room = world.rooms[s.room];
  const view = roomView(world, s);
  const dark = roomIsDark(world, s);
  const lines: string[] = [];
  const lvl = world.classes ? ` L${s.level}` : "";
  const hud = (world.hud ?? []).map((h) => ` ${h.label}${s.vars[h.var] ?? 0}`).join("");
  lines.push(
    `=${view.name} | hp${s.hp}/${s.maxHp}${lvl} score${s.score}/${world.maxScore} t${s.turn}${hud}`,
  );
  if (events.length) lines.push(`[${events.join(" ")}]`);
  if (world.progress) {
    const v = s.vars[world.progress.var] ?? 0;
    lines.push(`${world.progress.label}: ${v}/${world.progress.max}`);
  }
  if (s.inv.length) {
    const carried = s.inv.map((id) => world.items[id]?.name ?? id);
    lines.push(`carrying: ${carried.join(", ")}`);
  }

  if (inPerkPickPhase(world, s)) {
    const menu = renderMenu(world, s);
    lines.push("Level up. Pick 1 perk/lvl for fights & checks (perm).");
    lines.push(menu.text);
    return { text: lines.filter(Boolean).join("\n"), actions: menu.actions };
  }

  // an open conversation: the npc's line is in the events; the room waits
  if (inTalkMode(world, s)) {
    const menu = renderMenu(world, s);
    lines.push(`talking with ${world.npcs[s.talking!]?.name ?? s.talking}`);
    lines.push(menu.text);
    return { text: lines.filter(Boolean).join("\n"), actions: menu.actions };
  }

  // the travel menu: known places, nothing else
  if (inTravelMode(world, s)) {
    const menu = renderMenu(world, s);
    lines.push("Travel — places you know:");
    lines.push(menu.text);
    return { text: lines.filter(Boolean).join("\n"), actions: menu.actions };
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
    const npcs = Object.entries(world.npcs)
      .filter(([id]) => s.npcRoom[id] === s.room && !s.party.includes(id))
      .map(([id, d]) => {
        const hp = s.npcHp[id] ?? d.hp ?? 1;
        if (hp <= 0) return `${d.name} (dead)`;
        if (d.hostile || d.aggressive) return `${d.name} (hostile, hp${hp}/${d.hp ?? 1})`;
        return `${d.name} is here`;
      });
    if (npcs.length) lines.push(npcs.join("; "));
    const party = s.party.map((id) => world.npcs[id]?.name ?? id);
    if (party.length) lines.push(`with you: ${party.join(", ")}`);
  }

  const exitDirs = Object.keys(room?.exits ?? {});
  if (exitDirs.length) {
    const marked = exitDirs.map((dir) => {
      const ex = room!.exits![dir]!;
      const unexplored = ex.sideTrip && !s.visited.includes(ex.to);
      return exitAbbr(dir) + (unexplored ? "*" : "");
    });
    lines.push(`exits: ${marked.join(" ")}`);
  }

  const menu = renderMenu(world, s);
  lines.push(menu.text);
  return { text: lines.filter(Boolean).join("\n"), actions: menu.actions };
}

/**
 * Free, any-time check (no turn cost) — recaps the objectives, every tracked
 * path (e.g. verses vs crown), which faction/branch choices currently stand
 * (e.g. sealed vs open), which rooms have already been visited (a memory aid
 * against repetitive backtracking), what's carried, held perks, and current
 * check/combat modifier totals, so a player can confirm their build right
 * before committing to a major choice instead of re-summing perks by hand.
 */
export function renderStatus(world: World, s: State): string {
  const lines: string[] = [];
  const recap = world.objectives ?? world.intro;
  if (recap) lines.push(recap);
  type Track = { var: string; label: string; max: number; remaining?: { flag: string; label: string }[] };
  const tracks: Track[] = world.statusTracks ?? (world.progress ? [world.progress] : []);
  for (const t of tracks) {
    let line = `${t.label}: ${s.vars[t.var] ?? 0}/${t.max}`;
    const remaining = t.remaining?.filter((r) => !s.flags[r.flag]);
    if (remaining?.length) line += ` (unexplored: ${remaining.map((r) => r.label).join(", ")})`;
    lines.push(line);
  }
  for (const p of world.statusPaths ?? []) {
    const hit = p.states.find((st) => st.if.every((c) => condOk(world, s, c)));
    const text = hit?.text ?? p.fallback;
    if (text) lines.push(`${p.label}: ${text}`);
  }
  // the journal: every active quest with its current line, then the closed ones by name
  if (world.quests) {
    const q = journal(world, s);
    const active = q.filter((x) => x.status === "active");
    if (active.length) lines.push(`Quests:\n${active.map((x) => `- ${x.name}: ${x.text}`).join("\n")}`);
    const done = q.filter((x) => x.status === "done").map((x) => x.name);
    if (done.length) lines.push(`Done: ${done.join(", ")}`);
    const failed = q.filter((x) => x.status === "failed").map((x) => x.name);
    if (failed.length) lines.push(`Failed: ${failed.join(", ")}`);
  }
  for (const h of world.hud ?? []) lines.push(`${h.label}: ${s.vars[h.var] ?? 0}`);
  const visited = s.visited ?? [];
  if (visited.length) {
    const names = visited.map((id) => world.rooms?.[id]?.name ?? id);
    lines.push(`Visited: ${names.join(", ")}`);
  }
  if (s.inv.length) {
    const carried = s.inv.map((id) => world.items[id]?.name ?? id);
    lines.push(`carrying: ${carried.join(", ")}`);
  }
  if (s.party?.length) {
    const party = s.party.map((id) => world.npcs[id]?.name ?? id);
    lines.push(`Party: ${party.join(", ")}`);
  }
  if (s.perks?.length) {
    const perks = s.perks.map((id) => {
      const p = world.perks?.[id];
      return p ? `${p.name} (${p.desc})` : id;
    });
    lines.push(`Perks: ${perks.join(", ")}`);
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
    lines.push(`Combat: hit${signed(cm.hit)} dmg${signed(cm.dmg)} armor${signed(cm.armor)}`);
  }
  return lines.length ? lines.join("\n") : "No progress to report.";
}

export function renderIntro(
  world: World,
  s: State,
  events: string[],
): { text: string; actions: Action[] } {
  const body = render(world, s, events, { full: true });
  const head = [
    `${world.title} (seed ${s.seed})`,
    world.intro,
    `Goal: reach an ending. hp0 = death. One action per turn: act(s, n) with a menu number. look(s)/status(s): free scene/quest/items recap incl. every path, no turn spent. hash ${hashState(s)}.`,
  ].join("\n");
  return { text: `${head}\n${body.text}`, actions: body.actions };
}
