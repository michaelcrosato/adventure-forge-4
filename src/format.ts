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
import { actionLabel, checkMod, combatMods, condOk, hashState, inClassPhase, inPerkPickPhase, legalActions, oddsHint, receipt, roomIsDark } from "./engine.ts";
import { ATTRS } from "./types.ts";
import type { Action, State, World } from "./types.ts";

const signed = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

export function renderMenu(world: World, s: State): { text: string; actions: Action[] } {
  const actions = legalActions(world, s);
  const text = actions
    .map((a, i) => `${i + 1} ${actionLabel(world, a, s)}${oddsHint(world, s, a)}`)
    .join("\n");
  return { text, actions };
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
    const lines = [
      ...events.map((x) => `[${x}]`),
      `*** ${e.kind.toUpperCase()}: ${e.id} ***`,
      e.text,
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
  const dark = roomIsDark(world, s);
  const lines: string[] = [];
  const lvl = world.classes ? ` L${s.level}` : "";
  lines.push(
    `=${room?.name ?? s.room} | hp${s.hp}/${s.maxHp}${lvl} score${s.score}/${world.maxScore} t${s.turn}`,
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

  if (dark) {
    lines.push("Pitch dark. You can only feel for the exits.");
  } else {
    if (opts.full) lines.push(room?.desc ?? "");
    else if (room?.brief) lines.push(room.brief);
    const here = Object.keys(world.items)
      .filter((id) => s.itemLoc[id] === s.room)
      .map((id) => world.items[id]?.name ?? id);
    if (here.length) lines.push(`you notice ${here.join(", ")} here`);
    const npcs = Object.entries(world.npcs)
      .filter(([id]) => s.npcRoom[id] === s.room)
      .map(([id, d]) => {
        const hp = s.npcHp[id] ?? d.hp ?? 1;
        if (hp <= 0) return `${d.name} (dead)`;
        return d.hostile ? `${d.name} (hostile, hp${hp}/${d.hp ?? 1})` : `${d.name} is here`;
      });
    if (npcs.length) lines.push(npcs.join("; "));
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
  const visited = s.visited ?? [];
  if (visited.length) {
    const names = visited.map((id) => world.rooms?.[id]?.name ?? id);
    lines.push(`Visited: ${names.join(", ")}`);
  }
  if (s.inv.length) {
    const carried = s.inv.map((id) => world.items[id]?.name ?? id);
    lines.push(`carrying: ${carried.join(", ")}`);
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
    const checks = ATTRS.map((a) => `${a}${signed(checkMod(world, s, a))}`).join(" ");
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
    `Goal: reach an ending. hp0 = death. One action per turn: act(s, n) with a menu number. look(s)/status(s): free scene/quest recap incl. every path, no turn spent. hash ${hashState(s)}.`,
  ].join("\n");
  return { text: `${head}\n${body.text}`, actions: body.actions };
}
