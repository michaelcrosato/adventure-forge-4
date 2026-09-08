/**
 * Shape audit for authors and reviewers — what a region is made of, and how
 * much of it the player can do anything with.
 *
 * A room the player can only walk out of is a corridor, however well it is
 * written: no action, nobody standing there, nothing to take. The realm's
 * regions were measured at 4% to 60% corridors depending on when they were
 * written, so this prints the number per region and names the rooms, and the
 * region brief holds every new region to under 15%.
 *
 * Also prints each region's structural fingerprint side by side, so a realm
 * that has been growing by copying its last region can be seen doing it.
 *
 * Counted per class, because that is what a player experiences: an action
 * gated on one class is not an action for the other three, so a room whose
 * only content is a Scout's find is a corridor to a Warden. The class-blind
 * count is the optimistic one and is printed last.
 *
 *   node --import tsx scripts/audit-shape.ts world/reach.json [--prefix fd] [--bare]
 */
import { loadWorld } from "../src/validate.ts";
import type { World } from "../src/types.ts";

const [path, ...rest] = process.argv.slice(2);
if (!path) { console.error("usage: node --import tsx scripts/audit-shape.ts <world.json> [--prefix xx] [--bare]"); process.exit(2); }
const only = rest.includes("--prefix") ? rest[rest.indexOf("--prefix") + 1]! : null;
const listBare = rest.includes("--bare");
const listRites = rest.includes("--rites");
const world: World = loadWorld(path);

const prefixOf = (id: string) => id.split("_")[0] ?? "";
const regionOf = (id: string) => world.rooms[id]?.region ?? prefixOf(id);

// where npcs and items start: a room with someone in it, or something in it, is not a corridor
// (an npc's place is `room`, an item's is `loc` — "inv"/"nowhere" are not rooms)
const peopled = new Set<string>();
for (const n of Object.values(world.npcs)) if (n.room) peopled.add(n.room);
const stocked = new Set<string>();
for (const it of Object.values(world.items)) if (it.loc && world.rooms[it.loc]) stocked.add(it.loc);

/** An action gated on another class is not on offer to this one. */
const classes = Object.keys(world.classes ?? {});
const offeredTo = (a: { if?: unknown[] }, c: string): boolean => {
  for (const cond of (a.if ?? []) as unknown[]) {
    if (!Array.isArray(cond)) continue;
    if (cond[0] === "class" && cond[1] !== c) return false;
    if (cond[0] === "!class" && cond[1] === c) return false;
  }
  return true;
};

/**
 * How a hold's grief is actually RESTED, which the `fates` column cannot show:
 * every hold must offer rest/bargain/burn by contract, so that column reads the
 * same for all fifteen forever. What varies — and what the seven-rites work is
 * changing — is the shape of the asking. Read off the conditions guarding
 * whichever effect sets `<code>_hollow_rested`, including the `if`, `check` and
 * `chance` branches it is nested inside (Mootcombe's sequence lives three deep):
 *   witness someone living has to be standing there
 *   order   a sequence var, taken in its right order
 *   count   a tally of gathered things ("three verses", "three names")
 *   carry   a specific thing has to be in hand
 *   plain   flags alone — the shape the seven-rites work is replacing
 *
 * Flags never classify. Every rite is flag-gated (`<code>_hollow_grievance`,
 * `!<code>_hollow_done`), so counting them would print `plain` for all fifteen
 * and see nothing; `plain` is the verdict only for a setter guarded by nothing
 * else. Every distinct shape a region offers is printed, not the most
 * flattering one: a rest reachable two ways is two shapes, and hiding the
 * duller road is how a tool starts lying to its author.
 *
 * This reads gates, not intent, and cannot do better. Two shapes are invisible
 * to it by construction:
 *   - a **witness** recorded as a flag. The Meres' fifth road asks a villager
 *     to wade in with you, then gates on the flag saying she agreed — `plain`,
 *     beside its four `witness` siblings.
 *   - a **trade**. "Give it back what was taken" is paid one hop earlier and
 *     recorded as an ordinary flag, so the Hearthlands' trade reads `plain`
 *     too. I tried the hop — find every flag set in the same breath as a
 *     charge, call those rites trades — and it labelled eight regions `trade`,
 *     including holds whose gate-flag merely happened to cost a standing point
 *     on the way. A gate charging something incidentally is not a rite that
 *     asks for payment, and nothing in the data separates them. Reverted:
 *     a column that cannot tell the Hearthlands from Embermoor is worse than
 *     one that admits it only reads gates.
 *
 * That is why `--rites` names every setter and its verdict — the column says
 * look here, and the author is the one who reads.
 */
type Rite = "witness" | "order" | "count" | "carry" | "plain";
const riteOrder: Rite[] = ["witness", "order", "count", "carry", "plain"];
const riteOf = (conds: unknown[]): Rite[] => {
  const seen = new Set<Rite>();
  const walk = (cs: unknown[]) => {
    for (const c of cs) {
      if (!Array.isArray(c)) continue;
      if (c[0] === "npcHere" || c[0] === "inParty") seen.add("witness");
      else if (c[0] === "var" && /_(step|order|stage)$/.test(String(c[1]))) seen.add("order");
      else if (c[0] === "var" && typeof c[3] === "number" && c[3] > 1) seen.add("count");
      else if (c[0] === "has") seen.add("carry");
      else if (c[0] === "any") walk((c[1] ?? []) as unknown[]);
    }
  };
  walk(conds);
  return seen.size ? riteOrder.filter((r) => seen.has(r)) : ["plain"];
};

type Shape = {
  rooms: number; bare: number; bareIds: string[]; perClass: Record<string, number>; rite: Set<Rite>;
  landmarks: number; actions: number; variants: number; sideTrips: number;
  npcs: number; talkers: number; topics: number; items: number; quests: number;
  epilogue: number; fates: Set<string>;
};
const blank = (): Shape => ({ rooms: 0, bare: 0, bareIds: [], perClass: Object.fromEntries(classes.map((c) => [c, 0])), rite: new Set(), landmarks: 0, actions: 0, variants: 0, sideTrips: 0, npcs: 0, talkers: 0, topics: 0, items: 0, quests: 0, epilogue: 0, fates: new Set() });
const shapes = new Map<string, Shape>();
const shape = (r: string) => shapes.get(r) ?? shapes.set(r, blank()).get(r)!;

for (const [id, room] of Object.entries(world.rooms)) {
  const s = shape(regionOf(id));
  s.rooms += 1;
  s.actions += (room.actions ?? []).length;
  s.variants += (room.variants ?? []).length;
  if (room.landmark) s.landmarks += 1;
  for (const e of Object.values(room.exits ?? {})) if (e.sideTrip) s.sideTrips += 1;
  // a corridor: nothing to do here but leave
  const anything = peopled.has(id) || stocked.has(id);
  if (!(room.actions ?? []).length && !anything) { s.bare += 1; s.bareIds.push(id); }
  for (const c of classes) if (!anything && !(room.actions ?? []).some((a) => offeredTo(a, c))) s.perClass[c] = (s.perClass[c] ?? 0) + 1;
}
for (const [id, n] of Object.entries(world.npcs)) {
  const s = shape(n.companion ? "party" : n.room ? regionOf(n.room) : prefixOf(id));
  s.npcs += 1;
  if (n.dialogue) s.talkers += 1;
  s.topics += (n.topics ?? []).length;
}
for (const [id, it] of Object.entries(world.items)) shape(world.rooms[it.loc] ? regionOf(it.loc) : prefixOf(id)).items += 1;
const companionIds = new Set(Object.entries(world.npcs).filter(([, n]) => n.companion).map(([id]) => id));
const bucket = (r: string) => (companionIds.has(r) ? "party" : (shapes.get(r)?.rooms ?? 0) > 0 ? r : "realm");
for (const id of Object.keys(world.quests ?? {})) shape(bucket(prefixOf(id))).quests += 1;

// the three fates a hold's grief can meet: which does this region actually offer?
const riteRoads = new Map<string, { id: string; rites: Rite[] }[]>();
const restSetter = (fx: unknown, conds: unknown[], region: string, id: string): void => {
  if (!Array.isArray(fx)) return;
  for (const f of fx as unknown[]) {
    if (!Array.isArray(f)) continue;
    if (f[0] === "set" && /_hollow_rested$/.test(String(f[1]))) {
      const rites = riteOf(conds);
      for (const r of rites) shape(region).rite.add(r);
      const roads = riteRoads.get(region) ?? riteRoads.set(region, []).get(region)!;
      if (!roads.some((r) => r.id === id)) roads.push({ id, rites });
    } else if (f[0] === "if") {
      // the then-branch is guarded by these conditions too; the else-branch by their failure
      restSetter(f[2], [...conds, ...(Array.isArray(f[1]) ? (f[1] as unknown[]) : [])], region, id);
      restSetter(f[3], conds, region, id);
    } else if (f[0] === "check" || f[0] === "chance") {
      restSetter(f[3], conds, region, id); restSetter(f[4], conds, region, id);
    }
  }
};

const fateOf = (flag: string) => /_hollow_rested$/.test(flag) ? "rest" : /_hollow_burned$/.test(flag) ? "burn" : /_hollow_bargained$/.test(flag) ? "bargain" : null;
const scanFx = (fxs: unknown, region: string): void => {
  if (!Array.isArray(fxs)) return;
  for (const fx of fxs as unknown[]) {
    if (!Array.isArray(fx)) continue;
    if (fx[0] === "set" && typeof fx[1] === "string") { const f = fateOf(fx[1]); if (f) shape(region).fates.add(f); }
    for (const part of fx) if (Array.isArray(part)) scanFx([part], region), scanFx(part, region);
  }
};
for (const [id, room] of Object.entries(world.rooms)) {
  const r = regionOf(id);
  scanFx(room.onEnter, r); scanFx(room.onEnterOnce, r);
  for (const a of room.actions ?? []) { scanFx(a.fx, r); restSetter(a.fx, (a.if ?? []) as unknown[], r, a.id); }
}
for (const [id, n] of Object.entries(world.npcs)) {
  const r = n.room ? regionOf(n.room) : prefixOf(id);
  for (const t of n.topics ?? []) { scanFx(t.fx, r); restSetter(t.fx, (t.if ?? []) as unknown[], r, `${id}/${t.id}`); }
  scanFx(n.onDeath, r);
}
for (const ep of world.epilogue ?? []) {
  // an epilogue line belongs to whichever region's flags it reads
  const seen = new Set<string>();
  const scan = (cs: unknown): void => {
    if (!Array.isArray(cs)) return;
    for (const c of cs as unknown[]) {
      if (!Array.isArray(c)) continue;
      if ((c[0] === "flag" || c[0] === "!flag") && typeof c[1] === "string") seen.add(prefixOf(c[1]));
      if (c[0] === "any") scan(c[1]);
    }
  };
  scan(ep.if);
  for (const r of seen) shape(bucket(r)).epilogue += 1;
}

const rows = [...shapes.entries()]
  .filter(([r, s]) => s.rooms > 0 || r === "realm" || r === "party")
  .filter(([r]) => !only || r === only)
  .sort(([a, x], [b, y]) => (y.rooms > 0 ? 1 : 0) - (x.rooms > 0 ? 1 : 0) || a.localeCompare(b));
if (!rows.length) { console.error(`no region ${only}`); process.exit(1); }

const pad = (v: string | number, n: number) => String(v).padStart(n);
const classCols = classes.map((c) => c.slice(0, 4).padStart(5)).join("");
console.log(`region  rooms  corridors${classCols}   lmk  acts  varis  npcs  talk  topics  items  quests  epil  fates                rite`);
let bareAll = 0, roomsAll = 0;
for (const [r, s] of rows) {
  bareAll += s.bare; roomsAll += s.rooms;
  void r;
  const pct = s.rooms ? Math.round((100 * s.bare) / s.rooms) : 0;
  const flag = pct >= 15 ? " <" : "";
  console.log(
    `${r.padEnd(6)} ${pad(s.rooms, 6)}  ${pad(`${s.bare} (${pct}%)`, 9)}${flag.padEnd(2)}${classes.map((c) => pad(s.perClass[c] ?? 0, 5)).join("")} ${pad(s.landmarks, 4)} ${pad(s.actions, 5)} ${pad(s.variants, 6)} ${pad(s.npcs, 5)} ${pad(s.talkers, 5)} ${pad(s.topics, 7)} ${pad(s.items, 6)} ${pad(s.quests, 7)} ${pad(s.epilogue, 5)}  ${(([...s.fates].sort().join("/") || "—") + "").padEnd(20)} ${riteOrder.filter((r) => s.rite.has(r)).join("+") || "—"}`,
  );
}
const pctAll = roomsAll ? Math.round((100 * bareAll) / roomsAll) : 0;
console.log(`${"all".padEnd(6)} ${pad(roomsAll, 6)}  ${pad(`${bareAll} (${pctAll}%)`, 9)}`);
console.log();
console.log("rite: how the hold's grief is RESTED, which `fates` cannot show — every hold offers");
console.log("rest/bargain/burn by contract, so that column reads the same for all fifteen forever.");
console.log("witness = someone living has to be there; order = a sequence taken in its right order;");
console.log("count = a tally of gathered things; carry = a thing in hand; plain = flags alone, the");
console.log("shape the seven-rites work is replacing. It reads gates, not intent: `--rites` names");
console.log("every road to rest and its verdict, so a `plain` can be looked at rather than trusted.");
console.log();
if (listRites) {
  for (const [r] of rows) {
    const roads = riteRoads.get(r);
    if (!roads?.length) continue;
    console.log(`${r}:`);
    for (const road of roads) console.log(`  ${road.rites.join("+").padEnd(14)} ${road.id}`);
  }
  console.log();
}
console.log("corridors: rooms with no action, nobody standing there, and nothing to take —");
console.log("a player can only walk out. '<' marks a region over the brief's 15% bar.");
if (classes.length) {
  const totals = classes.map((c) => `${c} ${rows.reduce((n, [, s]) => n + (s.perClass[c] ?? 0), 0)}`).join(", ");
  console.log();
  console.log(`Per class, which is what a player actually walks through: ${totals}.`);
  console.log("An action gated on one class is not an action for the other three, so the");
  console.log("class-blind figure above is the optimistic one. Fill a room for everybody,");
  console.log("or fill it four ways.");
}

if (listBare) {
  console.log();
  for (const [r, s] of rows) {
    if (!s.bare) continue;
    console.log(`== ${r} (${s.bare})`);
    for (const id of s.bareIds) console.log(`  ${id}  "${world.rooms[id]?.name ?? ""}"`);
  }
}
