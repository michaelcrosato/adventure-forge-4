/**
 * tinyforge worldgen — regions in, rooms out. Deterministic.
 *
 * A world may carry `gen` regions: a seed, a w×h grid, text pools, links to
 * authored rooms, and spots (authored placements on exact cells). expandWorld
 * turns each region into real rooms BEFORE validation, so every generated room
 * and exit is checked exactly like authored content. Same file = same world,
 * every run, every machine. All text comes from pools in the world file —
 * content stays data; this module only builds structure.
 *
 * Malformed gen (bad bounds, empty pools, id collisions) throws: a world that
 * cannot expand cannot load.
 */
import type { GenDef, RoomDef, World } from "./types.ts";

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

function expandRegion(world: World, g: GenDef): void {
  if (g.w < 1 || g.h < 1) throw new Error(`gen ${g.id}: w and h must be at least 1`);
  if (!g.pools?.descs?.length) throw new Error(`gen ${g.id}: pools.descs must not be empty`);
  const rnd = rng(g.seed);
  const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]!;
  const inBounds = (x: number, y: number) => x >= 0 && x < g.w && y >= 0 && y < g.h;

  // grid rooms: north is y-1, south is y+1, west is x-1, east is x+1
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const id = cellId(g, x, y);
      if (world.rooms[id]) throw new Error(`gen ${g.id}: room id ${id} already exists`);
      const room: RoomDef = {
        name: `${g.name} ${x},${y}`,
        desc: pick(g.pools.descs),
        exits: {},
      };
      const brief = g.pools.briefs?.length ? pick(g.pools.briefs) : undefined;
      if (brief) room.brief = brief;
      if (y > 0) room.exits!["north"] = { to: cellId(g, x, y - 1) };
      if (y < g.h - 1) room.exits!["south"] = { to: cellId(g, x, y + 1) };
      if (x > 0) room.exits!["west"] = { to: cellId(g, x - 1, y) };
      if (x < g.w - 1) room.exits!["east"] = { to: cellId(g, x + 1, y) };
      world.rooms[id] = room;
    }
  }

  // links stitch region cells to authored rooms (and back)
  for (const link of g.links ?? []) {
    const [x, y] = link.cell;
    if (!inBounds(x, y)) throw new Error(`gen ${g.id}: link cell ${x},${y} out of bounds`);
    const from = world.rooms[cellId(g, x, y)]!;
    if (from.exits![link.dir]) throw new Error(`gen ${g.id}: link overwrites exit ${link.dir} at ${x},${y}`);
    from.exits![link.dir] = { to: link.to };
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
    if (!inBounds(x, y)) throw new Error(`gen ${g.id}: spot cell ${x},${y} out of bounds`);
    const id = cellId(g, x, y);
    const room = world.rooms[id]!;
    if (spot.name) room.name = spot.name;
    if (spot.desc) room.desc = spot.desc;
    if (spot.onEnterOnce) room.onEnterOnce = spot.onEnterOnce;
    if (spot.actions) room.actions = spot.actions;
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

/** Expand every gen region into rooms. No gen means no change. */
export function expandWorld(world: World): World {
  for (const g of world.gen ?? []) expandRegion(world, g);
  return world;
}
