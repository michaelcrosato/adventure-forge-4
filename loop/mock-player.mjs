#!/usr/bin/env node
/**
 * Zero-token structural player — tinyforge's fleet:mock.
 *
 * Speaks real MCP (newline-delimited JSON-RPC over stdio) to the real server,
 * so it proves the exact wiring a live agent uses, for free.
 *
 *   node loop/mock-player.mjs                  random walk, 120 steps max
 *   node loop/mock-player.mjs --seed 7
 *   node loop/mock-player.mjs --measure        follow the walkthrough, print token stats
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const opt = (f, d) => (args.includes(f) ? args[args.indexOf(f) + 1] : d);
const SEED = Number(opt("--seed", 7));
const MEASURE = flag("--measure");
const MAX_STEPS = Number(opt("--max-steps", 200));

// node --import tsx (not npx) so this works on Windows too, where spawn("npx") fails
const child = spawn(process.execPath, ["--import", "tsx", join(ROOT, "src", "mcp.ts")], {
  cwd: ROOT,
  stdio: ["pipe", "pipe", "inherit"],
});

let nextId = 1;
const pending = new Map();
let buf = "";
child.stdout.on("data", (d) => {
  buf += d.toString();
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i);
    buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {
      /* non-JSON noise */
    }
  }
});

function rpc(method, params) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, (msg) => (msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)));
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`timeout: ${method}`));
      }
    }, 15000);
  });
}
const notify = (method, params) =>
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method, params }) + "\n");
const callTool = async (name, a) => {
  const r = await rpc("tools/call", { name, arguments: a });
  return r.content?.[0]?.text ?? "";
};

// deterministic policy rng
let rngA = SEED | 0;
const rnd = () => {
  rngA = (rngA + 0x6d2b79f5) | 0;
  let t = Math.imul(rngA ^ (rngA >>> 15), 1 | rngA);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Menu text may carry a display-only " (need N+)" odds hint (see oddsHint in
// src/engine.ts) that is never part of the canonical label walkthroughs match on.
const stripOdds = (label) => label.replace(/ \(need \d+\+\)$/, "");

const menuOf = (text) =>
  text
    .split("\n")
    .map((l) => /^(\d+) (.+)$/.exec(l))
    .filter(Boolean)
    .map((m) => ({ n: Number(m[1]), label: stripOdds(m[2]) }));

function expandWalkthrough() {
  const path = process.env.TF_WORLD ?? join(ROOT, "world", "vale.json");
  const world = JSON.parse(readFileSync(path, "utf8"));
  // repeats are expanded lazily at play time by label matching
  return world.walkthrough;
}

const main = async () => {
  await rpc("initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "tinyforge-mock", version: "0.1.0" },
  });
  notify("notifications/initialized", {});
  const tools = await rpc("tools/list", {});
  const names = tools.tools.map((t) => t.name).sort();
  if (JSON.stringify(names) !== JSON.stringify(["act", "look", "new_game"]))
    throw new Error(`unexpected tool surface: ${names.join(",")}`);

  let text = await callTool("new_game", { seed: SEED });
  const sid = /^s=(\S+)/.exec(text)?.[1];
  if (!sid) throw new Error("no session id in new_game response");
  const sizes = [text.length];
  let turns = 0;
  let ended = null;

  const script = MEASURE ? expandWalkthrough() : null;
  let si = 0;
  let repeatStep = null;

  while (turns < MAX_STEPS) {
    if (/\*\*\* (WIN|LOSE)/.test(text)) {
      ended = /\*\*\* (WIN|LOSE): (\w+)/.exec(text)?.[2] ?? "?";
      break;
    }
    const menu = menuOf(text);
    if (!menu.length) throw new Error(`no menu and no ending at turn ${turns}:\n${text}`);
    let pick;
    if (script) {
      // follow the walkthrough by label
      let wanted;
      if (repeatStep) wanted = repeatStep.repeat;
      else {
        const stepDef = script[si];
        if (stepDef === undefined) break;
        if (typeof stepDef === "string") {
          wanted = stepDef;
          si++;
        } else {
          repeatStep = stepDef;
          wanted = stepDef.repeat;
        }
      }
      pick = menu.find((m) => m.label.toLowerCase() === wanted.toLowerCase());
      if (!pick && repeatStep) {
        // repeat target no longer offered => condition satisfied, move on
        repeatStep = null;
        si++;
        continue;
      }
      if (!pick) throw new Error(`walkthrough label "${wanted}" not in menu at turn ${turns}`);
    } else {
      pick = menu[Math.floor(rnd() * menu.length)];
    }
    text = await callTool("act", { s: sid, a: pick.n });
    sizes.push(text.length);
    turns++;
  }

  const avg = sizes.reduce((a, b) => a + b, 0) / sizes.length;
  const max = Math.max(...sizes);
  const est = (c) => Math.round(c / 3.8); // rough chars->tokens
  const receipt = /receipt:(\S+)/.exec(text)?.[1] ?? "-";
  console.log(
    [
      `mock-player: ${ended ? `ended ${ended}` : `stopped after ${turns} turns`} (seed ${SEED})`,
      `  turns: ${turns}  tool calls: ${turns + 1}  (1 call per turn)`,
      `  response size: avg ${avg.toFixed(0)} chars (~${est(avg)} tok), max ${max} (~${est(max)} tok)`,
      `  whole session game-side text: ${sizes.reduce((a, b) => a + b, 0)} chars (~${est(sizes.reduce((a, b) => a + b, 0))} tok)`,
      `  receipt: ${receipt}`,
    ].join("\n"),
  );
  child.kill();
  process.exit(0);
};

main().catch((e) => {
  console.error(`mock-player FAILED: ${e.message}`);
  child.kill();
  process.exit(1);
});
