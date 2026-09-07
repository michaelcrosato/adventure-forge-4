#!/usr/bin/env node
/**
 * Compact, stable formatting for content JSON: objects one key per line,
 * arrays of primitives (and short arrays of short arrays — effects, conds)
 * on one line. Content files are read by people; this keeps them readable
 * whether a hand or a script last touched them.
 *
 *   node scripts/fmt-json.mjs world/reach/*.json
 */
import { readFileSync, writeFileSync } from "node:fs";

const INLINE_MAX = 110;

function fmt(v, indent) {
  const pad = "  ".repeat(indent);
  const padIn = "  ".repeat(indent + 1);
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    const flat = `[${v.map((x) => fmt(x, 0)).join(", ")}]`;
    const primitive = v.every((x) => x === null || typeof x !== "object");
    if (primitive || (flat.length <= INLINE_MAX && !flat.includes("\n"))) return flat;
    return `[\n${v.map((x) => padIn + fmt(x, indent + 1)).join(",\n")}\n${pad}]`;
  }
  if (v && typeof v === "object") {
    const keys = Object.keys(v);
    if (!keys.length) return "{}";
    const flat = `{ ${keys.map((k) => `${JSON.stringify(k)}: ${fmt(v[k], 0)}`).join(", ")} }`;
    if (flat.length <= INLINE_MAX && !flat.includes("\n")) return flat;
    return `{\n${keys.map((k) => `${padIn}${JSON.stringify(k)}: ${fmt(v[k], indent + 1)}`).join(",\n")}\n${pad}}`;
  }
  return JSON.stringify(v);
}

for (const f of process.argv.slice(2)) {
  const data = JSON.parse(readFileSync(f, "utf8"));
  writeFileSync(f, `${fmt(data, 0)}\n`);
  console.log(`formatted ${f}`);
}
