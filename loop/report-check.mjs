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
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function buildId() {
  let rev = "nogit";
  try { rev = execSync("git rev-parse --short HEAD", { cwd: ROOT, encoding: "utf8" }).trim(); } catch {}
  const worldPath = process.env.TF_WORLD ?? join(ROOT, "world", "lighthouse.json");
  const world = createHash("sha256").update(readFileSync(worldPath)).digest("hex").slice(0, 8);
  return { rev, world };
}
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

// Verify the receipt against the recorded trace, by replay.
let verified = false;
const runsDir = join(ROOT, "runs");
try {
  for (const f of readdirSync(runsDir)) {
    if (!f.endsWith(".json")) continue;
    const trace = JSON.parse(readFileSync(join(runsDir, f), "utf8"));
    if (trace.receipt === report.receipt) {
      const replayed = execFileSync("npx", ["tsx", join(ROOT, "src", "crawl.ts"), "--replay", join(runsDir, f)], {
        cwd: ROOT,
        encoding: "utf8",
      }).trim();
      verified = replayed === report.receipt;
      break;
    }
  }
} catch {
  verified = false;
}

const ts = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync(join(ROOT, "reports"), { recursive: true });
const item = {
  schema: 1,
  kind: "playtest",
  lane: "mcp",
  ts,
  seed,
  build: buildId(),
  cost_usd: costUsd,
  verified,
  ...report,
};
const file = join(ROOT, "reports", `playtest-${ts}${seed !== null ? `-s${seed}` : ""}.json`);
writeFileSync(file, JSON.stringify(item, null, 2));
console.log(
  `filed ${file.replace(ROOT + "/", "")} verdict:${report.verdict} fun:${report.fun} clarity:${report.clarity} bugs:${(report.bugs ?? []).length} verified:${verified}${costUsd !== null ? ` cost:$${costUsd.toFixed(4)}` : ""}`,
);
