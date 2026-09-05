#!/usr/bin/env node
/**
 * Validate a playtest report and file it into queue/.
 *
 *   node loop/report-check.mjs <claude-output.json> --seed <n>
 *
 * The player's final message must contain a fenced ```json report. The receipt
 * it quotes is verified by REPLAYING the server's recorded trace through the
 * engine (`tsx src/crawl.ts --replay`) — a report whose receipt doesn't replay
 * is filed as verified:false. This is the 30-line version of zork-unlimited's
 * exit-interview verification.
 */
import { execFileSync, execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// The same world the MCP server (src/mcp.ts) serves by default, so a report's
// content hash names the world the player actually saw; loop/playtest.sh also
// passes its resolved TF_WORLD to both, so an override cannot drift either.
const WORLD_PATH = process.env.TF_WORLD ?? join(ROOT, "world", "reach.json");

// The files a world is made of: the root, then every `include` part in load
// order (globs sort by name). Mirrors worldFiles in src/validate.ts — this
// file runs without tsx, so it cannot import it.
function worldFiles(path) {
  const root = JSON.parse(readFileSync(path, "utf8"));
  const dir = dirname(path);
  const files = [path];
  for (const pat of root.include ?? []) {
    const base = basename(pat);
    if (base.includes("*")) {
      const d = join(dir, dirname(pat));
      const re = new RegExp(`^${base.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*")}$`);
      const matches = existsSync(d) ? readdirSync(d).filter((f) => re.test(f)).sort().map((f) => join(d, f)) : [];
      files.push(...matches);
    } else files.push(join(dir, pat));
  }
  return files;
}

function buildId() {
  let rev = "nogit";
  try { rev = execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8" }).trim(); } catch {}
  const h = createHash("sha256");
  for (const f of worldFiles(WORLD_PATH)) h.update(readFileSync(f));
  return { rev, world: h.digest("hex").slice(0, 8) };
}

// The fields a player's report may contribute, and nothing else. Everything the
// host knows better (verified, seed, build, cost) is written AFTER these, so a
// report can never overwrite it. Mirrors REPORT_FIELDS in src/player.ts.
const REPORT_FIELDS = ["verdict", "fun", "clarity", "turns", "receipt", "bugs", "confusions", "suggestions"];
const args = process.argv.slice(2);
const outFile = args[0];
const seed = args.includes("--seed") ? Number(args[args.indexOf("--seed") + 1]) : null;
if (!outFile) {
  console.error("usage: node loop/report-check.mjs <claude-output.json> --seed <n>");
  process.exit(2);
}

const raw = readFileSync(outFile, "utf8");
let resultText = raw;
let costUsd = null;
try {
  const parsed = JSON.parse(raw);
  resultText = parsed.result ?? raw;
  costUsd = parsed.total_cost_usd ?? null;
} catch {
  /* plain text output is fine too */
}

const fence = /```json\s*([\s\S]*?)```/.exec(resultText);
if (!fence) {
  console.error("REJECT: no fenced ```json report in player output");
  process.exit(1);
}
let report;
try {
  report = JSON.parse(fence[1]);
} catch (e) {
  console.error(`REJECT: report is not valid JSON (${e.message})`);
  process.exit(1);
}

const errs = [];
const num = (k, lo, hi) => {
  if (typeof report[k] !== "number" || report[k] < lo || report[k] > hi) errs.push(`${k} must be ${lo}..${hi}`);
};
if (!["won", "lost", "quit", "stuck"].includes(report.verdict)) errs.push("verdict must be won|lost|quit|stuck");
num("fun", 1, 5);
num("clarity", 1, 5);
if (!Array.isArray(report.bugs)) errs.push("bugs must be an array");
if (!Array.isArray(report.suggestions)) errs.push("suggestions must be an array");
if (typeof report.receipt !== "string") errs.push("receipt must be quoted verbatim");
if (errs.length) {
  console.error(`REJECT: ${errs.join("; ")}`);
  process.exit(1);
}

// Verify the receipt against the recorded trace, by replay. The trace's seed
// must also match the seed this player was assigned — a receipt from some other
// session in runs/ does not count.
let verified = false;
const runsDir = join(ROOT, "runs");
try {
  for (const f of readdirSync(runsDir)) {
    if (!f.endsWith(".json")) continue;
    let trace;
    try {
      trace = JSON.parse(readFileSync(join(runsDir, f), "utf8"));
    } catch {
      continue; // a concurrent player may be mid-write to this file; it isn't our receipt either way
    }
    if (trace.receipt === report.receipt) {
      if (seed !== null && trace.seed !== seed) continue;
      const replayed = execFileSync(process.execPath, ["--import", "tsx", join(ROOT, "src", "crawl.ts"), "--replay", join(runsDir, f)], {
        cwd: ROOT,
        encoding: "utf8",
      }).trim();
      verified = replayed === report.receipt;
      break;
    }
  }
} catch (e) {
  console.error(`verify: replay failed (${e.message}) — filing as verified:false`);
  verified = false;
}

const ts = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync(join(ROOT, "reports"), { recursive: true });
const accepted = Object.fromEntries(REPORT_FIELDS.filter((k) => k in report).map((k) => [k, report[k]]));
const item = {
  ...accepted,
  schema: 1,
  kind: "playtest",
  lane: "mcp",
  ts,
  seed,
  build: buildId(),
  cost_usd: costUsd,
  verified,
};
const file = join(ROOT, "reports", `playtest-${ts}${seed !== null ? `-s${seed}` : ""}.json`);
writeFileSync(file, JSON.stringify(item, null, 2));
console.log(
  `filed ${file.replace(ROOT + "/", "")} verdict:${report.verdict} fun:${report.fun} clarity:${report.clarity} bugs:${(report.bugs ?? []).length} verified:${verified}${costUsd !== null ? ` cost:$${costUsd.toFixed(4)}` : ""}`,
);
