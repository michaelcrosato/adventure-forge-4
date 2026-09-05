/**
 * tinyforge worldgen — regions in, rooms out. Deterministic.
 *
 * A world may carry `gen` regions: a seed, a w×h grid, text pools, links to
 * authored rooms, spots (authored placements on exact cells), walls (cells that
 * are not made), and cell effects (a region's encounters). It may also carry
 * `templates` (a place written once with `$id` and `{{VAR}}` placeholders) and
 * `stamps` (where each copy stands). expandWorld turns all of it into real rooms
 * BEFORE validation, so every generated room and exit is checked exactly like
 * authored content. Same file = same world, every run, every machine. All text
 * comes from the world file — content stays data; this module only builds
 * structure and substitutes placeholders.
 *
 * Malformed gen (bad bounds, empty pools, id collisions, unresolved vars)
 * throws: a world that cannot expand cannot load.
 */
import type { ExitDef, GenDef, RoomDef, StampDef, World } from "./types.ts";

/** Same PRNG family as the engine, seeded once per region. */
function rng(seed: number): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cellId = (g: GenDef, x: number, y: number) => `${g.id}_${x}_${y}`;

/** Deterministic shuffle (Fisher–Yates over the region's PRNG). */
function shuffled<T>(arr: T[], rnd: () => number): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function expandRegion(world: World, g: GenDef): void {
  if (g.w < 1 || g.h < 1) throw new Error(`gen ${g.id}: w and h must be at least 1`);
  if (!g.pools?.descs?.length) throw new Error(`gen ${g.id}: pools.descs must not be empty`);
  const rnd = rng(g.seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]!;
  const inBounds = (x: number, y: number) => x >= 0 && x < g.w && y >= 0 && y < g.h;
  const walls = new Set((g.walls ?? []).map(([x, y]) => {
    if (!inBounds(x, y)) throw new Error(`gen ${g.id}: wall cell ${x},${y} out of bounds`);
    return `${x},${y}`;
  }));
  const open = (x: number, y: number) => inBounds(x, y) && !walls.has(`${x},${y}`);
  // scenes and names are dealt without replacement so no two cells read alike
  const scenes = shuffled(g.pools.scenes ?? [], rnd);
  const names = shuffled(g.pools.names ?? [], rnd);

  // grid rooms: north is y-1, south is y+1, west is x-1, east is x+1
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      if (walls.has(`${x},${y}`)) continue;
      const id = cellId(g, x, y);
      if (world.rooms[id]) throw new Error(`gen ${g.id}: room id ${id} already exists`);
      const scene = scenes.shift();
      const name = scene?.name ?? names.shift() ?? `${g.name} ${x},${y}`;
      const room: RoomDef = {
        name,
        desc: scene?.desc ?? pick(g.pools.descs),
        exits: {},
      };
      const brief = scene?.brief ?? (g.pools.briefs?.length ? pick(g.pools.briefs) : undefined);
      if (brief) room.brief = brief;
      if (g.region) room.region = g.region;
      if (g.cellFx?.onEnter) room.onEnter = structuredClone(g.cellFx.onEnter);
      if (g.cellFx?.onEnterOnce) room.onEnterOnce = structuredClone(g.cellFx.onEnterOnce);
      if (open(x, y - 1)) room.exits!["north"] = { to: cellId(g, x, y - 1) };
      if (open(x, y + 1)) room.exits!["south"] = { to: cellId(g, x, y + 1) };
      if (open(x - 1, y)) room.exits!["west"] = { to: cellId(g, x - 1, y) };
      if (open(x + 1, y)) room.exits!["east"] = { to: cellId(g, x + 1, y) };
      world.rooms[id] = room;
    }
  }

  // links stitch region cells to authored rooms (and back)
  for (const link of g.links ?? []) {
    const [x, y] = link.cell;
    if (!open(x, y)) throw new Error(`gen ${g.id}: link cell ${x},${y} out of bounds or walled`);
    const from = world.rooms[cellId(g, x, y)]!;
    if (from.exits![link.dir]) throw new Error(`gen ${g.id}: link overwrites exit ${link.dir} at ${x},${y}`);
    const ex: ExitDef = { to: link.to };
    if (link.landmark !== undefined) ex.landmark = link.landmark;
    if (link.sideTrip !== undefined) ex.sideTrip = link.sideTrip;
    from.exits![link.dir] = ex;
    if (link.back) {
      const target = world.rooms[link.to];
      if (target) {
        target.exits ??= {};
        if (target.exits[link.back]) throw new Error(`gen ${g.id}: back link overwrites exit ${link.back} on ${link.to}`);
        target.exits[link.back] = { to: cellId(g, x, y) };
      }
    }
  }

  // spots place authored content on exact cells
  for (const spot of g.spots ?? []) {
    const [x, y] = spot.cell;
    if (!open(x, y)) throw new Error(`gen ${g.id}: spot cell ${x},${y} out of bounds or walled`);
    const id = cellId(g, x, y);
    const room = world.rooms[id]!;
    if (spot.name) room.name = spot.name;
    if (spot.desc) room.desc = spot.desc;
    if (spot.brief) room.brief = spot.brief;
    if (spot.landmark) room.landmark = spot.landmark;
    if (spot.onEnterOnce) room.onEnterOnce = [...(room.onEnterOnce ?? []), ...spot.onEnterOnce];
    if (spot.onEnter) room.onEnter = [...(room.onEnter ?? []), ...spot.onEnter];
    if (spot.actions) room.actions = spot.actions;
    if (spot.variants) room.variants = spot.variants;
    for (const item of spot.items ?? []) {
      if (!world.items[item]) throw new Error(`gen ${g.id}: spot item ${item} not in world.items`);
      world.items[item]!.loc = id;
    }
    for (const npc of spot.npcs ?? []) {
      if (!world.npcs[npc]) throw new Error(`gen ${g.id}: spot npc ${npc} not in world.npcs`);
      world.npcs[npc]!.room = id;
    }
  }
}

/**
 * Replace placeholders in every string of a template copy: `{{VAR}}` from the
 * stamp's vars, `$name` -> `<instance>_name`. Applied to keys and values alike,
 * so room ids, item ids, npc ids, flag and var names, exit targets, and prose
 * all move together. A `$` followed by a letter or underscore is always a
 * placeholder inside a template; prose that needs a literal one does not
 * belong in a template.
 */
function substitute<T>(value: T, inst: string, vars: Record<string, string>, where: string): T {
  const sub = (s: string): string => {
    const out = s
      .replace(/\{\{([A-Za-z_][A-Za-z0-9_]*)\}\}/g, (_, v: string) => {
        if (!(v in vars)) throw new Error(`${where}: no value for {{${v}}}`);
        return vars[v]!;
      })
      .replace(/\$([A-Za-z_][A-Za-z0-9_]*)/g, (_, n: string) => `${inst}_${n}`);
    return out;
  };
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return sub(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v as Record<string, unknown>)) o[sub(k)] = walk(x);
      return o;
    }
    return v;
  };
  return walk(value) as T;
}

function expandStamp(world: World, st: StampDef): void {
  const where = `stamp ${st.id}`;
  const tpl = world.templates?.[st.template];
  if (!tpl) throw new Error(`${where}: unknown template ${st.template}`);
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(st.id)) throw new Error(`${where}: id must be an identifier`);
  const host = world.rooms[st.at];
  if (!host) throw new Error(`${where}: host room ${st.at} does not exist (stamps expand after gen regions — a cell id like wood_2_1 works)`);
  for (const v of tpl.vars ?? []) if (!st.vars || !(v in st.vars)) throw new Error(`${where}: template ${st.template} needs var ${v}`);
  const copy = substitute(
    { rooms: tpl.rooms, items: tpl.items ?? {}, npcs: tpl.npcs ?? {}, entrance: tpl.entrance },
    st.id,
    st.vars ?? {},
    where,
  );
  for (const [id, room] of Object.entries(copy.rooms)) {
    if (world.rooms[id]) throw new Error(`${where}: room id ${id} already exists`);
    if (room.region === undefined && host.region !== undefined) room.region = host.region;
    world.rooms[id] = room;
  }
  for (const [id, item] of Object.entries(copy.items)) {
    if (world.items[id]) throw new Error(`${where}: item id ${id} already exists`);
    world.items[id] = item;
  }
  for (const [id, npc] of Object.entries(copy.npcs)) {
    if (world.npcs[id]) throw new Error(`${where}: npc id ${id} already exists`);
    world.npcs[id] = npc;
  }
  const entrance = world.rooms[copy.entrance];
  if (!entrance || !(copy.entrance in copy.rooms)) throw new Error(`${where}: entrance ${tpl.entrance} is not a template room`);
  host.exits ??= {};
  if (host.exits[st.dir]) throw new Error(`${where}: host ${st.at} already has an exit ${st.dir}`);
  const ex: ExitDef = { to: copy.entrance };
  if (st.if) ex.if = st.if;
  if (st.lockedMsg !== undefined) ex.lockedMsg = st.lockedMsg;
  if (st.hint !== undefined) ex.hint = st.hint;
  if (st.landmark !== undefined) ex.landmark = st.landmark;
  if (st.sideTrip !== undefined) ex.sideTrip = st.sideTrip;
  host.exits[st.dir] = ex;
  if (st.back) {
    entrance.exits ??= {};
    if (entrance.exits[st.back]) throw new Error(`${where}: entrance already has an exit ${st.back}`);
    entrance.exits[st.back] = { to: st.at };
  }
}

/** Expand every gen region, then every stamp, into rooms. No gen and no stamps means no change. */
export function expandWorld(world: World): World {
  for (const g of world.gen ?? []) expandRegion(world, g);
  for (const st of world.stamps ?? []) expandStamp(world, st);
  return world;
}
