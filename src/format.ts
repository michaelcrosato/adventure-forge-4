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
import { actionLabel, hashState, inClassPhase, legalActions, oddsHint, receipt, roomIsDark } from "./engine.ts";
import type { Action, State, World } from "./types.ts";

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

  if (s.perkPicks > 0 && legalActions(world, s)[0]?.kind === "perkpick") {
    const menu = renderMenu(world, s);
    lines.push("Level up. Pick a perk — permanent passive bonus, not a one-time use.");
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
        return d.hostile ? `${d.name} (hostile, hp${hp})` : `${d.name} is here`;
      });
    if (npcs.length) lines.push(npcs.join("; "));
  }

  const exitDirs = Object.keys(room?.exits ?? {});
  if (exitDirs.length) lines.push(`exits: ${exitDirs.map(exitAbbr).join(" ")}`);

  const menu = renderMenu(world, s);
  lines.push(menu.text);
  return { text: lines.filter(Boolean).join("\n"), actions: menu.actions };
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
    `Goal: reach an ending. hp0 = death. One action per turn: act(s, n) with a menu number. look(s) re-shows the room and your inventory for free — no turn spent. hash ${hashState(s)}.`,
  ].join("\n");
  return { text: `${head}\n${body.text}`, actions: body.actions };
}
