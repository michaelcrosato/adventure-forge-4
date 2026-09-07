/**
 * The determinism rule, enforced instead of trusted: the engine core may not
 * touch the clock or ambient randomness. Only the I/O edges (server, players,
 * triage, crawl timing) may. Any NEW src file is held to the core rule by
 * default — add it to IO_EDGE only if it really is an I/O edge.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const IO_EDGE = new Set(["mcp.ts", "play.ts", "player.ts", "triage.ts", "crawl.ts", "turn.ts"]);
const BANNED = ["Date.now", "Math.random", "new Date("];

test("engine core has no ambient time or randomness", () => {
  const dir = fileURLToPath(new URL("../src", import.meta.url));
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".ts") || IO_EDGE.has(f)) continue;
    const src = readFileSync(join(dir, f), "utf8");
    for (const bad of BANNED) {
      assert.ok(
        !src.includes(bad),
        `src/${f} uses ${bad} — all game randomness must flow through the state's PRNG cursor`,
      );
    }
  }
});
