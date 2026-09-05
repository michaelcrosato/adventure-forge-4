/**
 * Scaffolding for building the realm region by region.
 *
 * The gateway table below (from the region assignments doc) names every room
 * that joins two regions. While a region is unwritten, its gateways exist as
 * stub rooms so the realm still validates: each stub leads to a per-region
 * "unwritten" hub (so the reachability check passes) and back to its neighbor.
 * Every hub offers the scaffold ending the draft walkthrough uses.
 *
 *   node --import tsx scripts/stubs.ts master th fd      -> world/reach/zz_stubs.json with stubs for
 *                                                          every region EXCEPT va, th, fd (the written ones)
 *   node --import tsx scripts/stubs.ts private ir        -> drafts/stubs_ir.json (stubs for every region but
 *                                                          ir, plus a scaffold oracle) and drafts/reach_ir.json,
 *                                                          a private root for the ir author: the committed
 *                                                          Vale + companions + templates + their own
 *                                                          world/reach/wip/ir_*.json, and nothing else
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

type Gate = { room: string; dir: string; to: string; landmark: string };
const REGIONS: Record<string, { name: string; gates: Gate[] }> = {
  va: { name: "the Vale of Ash", gates: [] }, // written
  th: { name: "Thornwold", gates: [
    { room: "th_east_edge", dir: "east", to: "va_west_road", landmark: "Thornwold edge" },
    { room: "th_north_track", dir: "north", to: "ir_south_track", landmark: "Thornwold north track" },
    { room: "th_south_track", dir: "south", to: "sk_north_track", landmark: "Thornwold south track" },
  ] },
  fd: { name: "Fenmarch", gates: [
    { room: "fd_causeway_west", dir: "west", to: "va_causeway", landmark: "Fenmarch causeway" },
    { room: "fd_north_dike", dir: "north", to: "hb_south_dike", landmark: "Fenmarch north dike" },
    { room: "fd_coast_road", dir: "south", to: "sk_coast_road", landmark: "Fenmarch coast road" },
  ] },
  wm: { name: "Wardmoor", gates: [
    { room: "wm_south_gate", dir: "south", to: "va_north_road", landmark: "Highward south gate" },
    { room: "wm_west_road", dir: "west", to: "ir_east_road", landmark: "Wardmoor west road" },
    { room: "wm_east_road", dir: "east", to: "hb_west_road", landmark: "Wardmoor east road" },
    { room: "wm_north_road", dir: "north", to: "cp_south_stair", landmark: "Wardmoor north road" },
  ] },
  ir: { name: "the Iron Downs", gates: [
    { room: "ir_east_road", dir: "east", to: "wm_west_road", landmark: "Iron Downs east road" },
    { room: "ir_south_track", dir: "south", to: "th_north_track", landmark: "Iron Downs south track" },
  ] },
  hb: { name: "Hollowbrook", gates: [
    { room: "hb_west_road", dir: "west", to: "wm_east_road", landmark: "Hollowbrook west road" },
    { room: "hb_south_dike", dir: "south", to: "fd_north_dike", landmark: "Hollowbrook south dike" },
  ] },
  sk: { name: "the Saltkerns", gates: [
    { room: "sk_north_track", dir: "north", to: "th_south_track", landmark: "Saltkerns north track" },
    { room: "sk_coast_road", dir: "east", to: "fd_coast_road", landmark: "Saltkerns coast road" },
    { room: "sk_smugglers_stair", dir: "up", to: "cp_smugglers_cave", landmark: "the smugglers' stair" },
  ] },
  cp: { name: "Coldpass", gates: [
    { room: "cp_south_stair", dir: "south", to: "wm_north_road", landmark: "Coldpass south stair" },
    { room: "cp_smugglers_cave", dir: "down", to: "sk_smugglers_stair", landmark: "the smugglers' cave" },
    { room: "cp_pass", dir: "north", to: "mg_south_gate", landmark: "the pass" },
  ] },
  mg: { name: "Marrowgate", gates: [
    { room: "mg_south_gate", dir: "south", to: "cp_pass", landmark: "Marrowgate south gate" },
  ] },
};

const END_LABEL = "(scaffold) the road ends here for now";
const END_FX = [["score", 100], ["end", "win", "zz_stub_win", "The realm is unfinished; this ending is a scaffold and will be removed."]];

function stubsFor(exclude: Set<string>, withOracle: boolean, gatedOracle = true): Record<string, unknown> {
  const rooms: Record<string, unknown> = {};
  for (const [code, r] of Object.entries(REGIONS)) {
    if (exclude.has(code) || !r.gates.length) continue;
    const hub = `${code}_stub_hub`;
    const hubExits: Record<string, unknown> = {};
    for (const g of r.gates) {
      const exits: Record<string, unknown> = { [g.dir]: { to: g.to } };
      // Highward admits no one from a blighted hold until the barrow is dealt with
      exits["in"] = g.room === "wm_south_gate"
        ? { to: hub, if: [["flag", "act2_open"]], lockedMsg: "The Watch admits no one from a blighted hold until the barrow is dealt with.", hint: "settle the Hollow King first" }
        : { to: hub };
      rooms[g.room] = {
        name: `${g.landmark} (stub)`,
        desc: `${r.name} begins here. This region is not yet written.`,
        brief: `${g.landmark} (stub).`,
        region: code,
        landmark: g.landmark,
        exits,
        onEnterOnce: [["set", `${code}_entered`]],
      };
      hubExits[`to_${g.room}`] = { to: g.room };
    }
    rooms[hub] = {
      name: `${r.name} (unwritten)`,
      desc: `A placeholder for ${r.name} while the realm is built.`,
      brief: `${r.name} (unwritten).`,
      region: code,
      exits: hubExits,
      actions: [{ id: `${code}_stub_end`, label: END_LABEL, fx: END_FX }],
    };
  }
  const out: Record<string, unknown> = { rooms };
  if (withOracle) {
    out["npcs"] = {
      zz_oracle: {
        name: "gray rider",
        room: "va_gate",
        desc: "A rider in road-dust who is not in the story yet.",
        // only once act 1 is settled, so a playtest of the Vale never meets the scaffolding early
        topics: [{ id: "end", label: END_LABEL, ...(gatedOracle ? { if: [["flag", "act2_open"]] } : {}), say: "This is as far as the road goes, for now.", fx: END_FX }],
      },
    };
  }
  return out;
}

const [mode, ...codes] = process.argv.slice(2);
if (mode === "master") {
  const written = new Set(["va", ...codes]);
  // the oracle stays in the master stubs while any region is unwritten, so the
  // draft walkthrough can end after act 1 whatever neighbor lands next
  const stubs = stubsFor(written, true);
  writeFileSync("world/reach/zz_stubs.json", `${JSON.stringify(stubs, null, 2)}\n`);
  console.log(`world/reach/zz_stubs.json: stubs for ${Object.keys(REGIONS).filter((c) => !written.has(c)).join(", ")}`);
} else if (mode === "private" && codes[0] && codes[1]) {
  const [code, file] = codes as [string, string];
  if (!REGIONS[code]) { console.error(`unknown region ${code}`); process.exit(2); }
  mkdirSync("world/reach/wip", { recursive: true });
  const own = `world/reach/wip/${file}`;
  if (!existsSync(own)) {
    // a skeleton to start from: the region's gateway rooms with the exact ids
    // and neighbor exits the realm expects — the author replaces the prose
    const rooms: Record<string, unknown> = {};
    const center = `${code}_settlement`;
    const centerExits: Record<string, unknown> = {};
    for (const g of REGIONS[code]!.gates) {
      rooms[g.room] = {
        name: `TODO ${g.landmark}`,
        desc: "TODO — write this gateway room.",
        brief: "TODO.",
        region: code,
        landmark: g.landmark,
        exits: { [g.dir]: { to: g.to }, in: { to: center } },
        onEnterOnce: [["set", `${code}_entered`]],
      };
      centerExits[`to_${g.room}`] = { to: g.room };
    }
    // a placeholder settlement joining the gateways, so the skeleton validates;
    // the author replaces it with the real settlement and wilderness
    rooms[center] = { name: "TODO settlement", desc: "TODO — the region's settlement.", brief: "TODO.", region: code, exits: centerExits };
    writeFileSync(own, `${JSON.stringify({ rooms, items: {}, npcs: {}, quests: {}, epilogue: [] }, null, 2)}\n`);
  }
  // an author's root ends at the oracle straight from the gate, so it is not gated there
  const stubs = stubsFor(new Set(["va", code]), true, false);
  writeFileSync(`drafts/stubs_${code}.json`, `${JSON.stringify(stubs, null, 2)}\n`);
  const root = JSON.parse(readFileSync("drafts/reach.json", "utf8")) as Record<string, unknown>;
  root["include"] = [
    "../world/reach/va_village.json", "../world/reach/va_wood.json", "../world/reach/va_barrow.json",
    "../world/reach/companions.json", "../world/reach/templates.json",
    `stubs_${code}.json`,
    `../${own}`,
  ];
  const wt = root["walkthrough"] as unknown[];
  root["walkthrough"] = [wt[0], `ask gray rider: ${END_LABEL}`];
  writeFileSync(`drafts/reach_${code}.json`, `${JSON.stringify(root, null, 2)}\n`);
  console.log(`drafts/reach_${code}.json + drafts/stubs_${code}.json, author file ${own}`);
} else {
  console.error("usage: stubs.ts master <written codes...> | private <code> <code_name.json>");
  process.exit(2);
}
