/**
 * Land a finished region: move its part file out of world/reach/wip/ into
 * world/reach/, regenerate the master stubs for whatever is still unwritten,
 * drop the region's private root and stub set from drafts/, and revalidate the
 * draft realm (validator, crawler, lint). Stops before moving anything if the
 * region's own private root does not validate.
 *
 *   node --import tsx scripts/land.ts th
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, renameSync, unlinkSync } from "node:fs";

const REGION_CODES = new Set(["th", "fd", "wm", "ir", "hb", "sk", "cp", "mg"]);
const code = process.argv[2];
if (!code || !REGION_CODES.has(code)) { console.error("usage: node --import tsx scripts/land.ts <th|fd|wm|ir|hb|sk|cp|mg>"); process.exit(2); }

const run = (args: string[], quiet = false) => {
  const out = execFileSync(process.execPath, ["--import", "tsx", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (!quiet) process.stdout.write(out);
  return out;
};

const wip = readdirSync("world/reach/wip").filter((f) => f.startsWith(`${code}_`) && f.endsWith(".json"));
if (!wip.length) { console.error(`no world/reach/wip/${code}_*.json to land`); process.exit(1); }

// 1. the author's own root must be clean first
if (existsSync(`drafts/reach_${code}.json`)) {
  console.log(`— validating the author's private root`);
  try { run(["src/validate.ts", `drafts/reach_${code}.json`]); }
  catch (e) { console.error(String((e as { stdout?: string }).stdout ?? e)); console.error("private root is not clean — not landing"); process.exit(1); }
}

// 2. move the part file(s) into the realm
for (const file of wip) {
  renameSync(`world/reach/wip/${file}`, `world/reach/${file}`);
  console.log(`— moved world/reach/wip/${file} -> world/reach/${file}`);
}

// 3. stubs for whatever is still unwritten
const landed = readdirSync("world/reach")
  .map((f) => /^([a-z]{2})_.*\.json$/.exec(f)?.[1])
  .filter((c): c is string => !!c && REGION_CODES.has(c));
run(["scripts/stubs.ts", "master", ...new Set(landed)]);

// 4. the author's scaffolding is done with
for (const f of [`drafts/reach_${code}.json`, `drafts/stubs_${code}.json`]) if (existsSync(f)) { unlinkSync(f); console.log(`— removed ${f}`); }

// 5. the draft realm must still be whole
console.log(`— validating the draft realm`);
let ok = true;
try { run(["src/validate.ts", "drafts/reach.json"]); } catch (e) { ok = false; console.error(String((e as { stdout?: string }).stdout ?? e)); }
try { run(["src/crawl.ts", "drafts/reach.json"]); } catch (e) { ok = false; console.error(String((e as { stdout?: string; stderr?: string }).stdout ?? "") + String((e as { stderr?: string }).stderr ?? "")); }
try { run(["scripts/lint-world.ts", "drafts/reach.json", "--prefix", code]); } catch (e) { ok = false; console.error(String((e as { stdout?: string }).stdout ?? e)); }
console.log(ok ? `✓ ${code} landed` : `✗ ${code} landed with problems above — fix them before committing`);
process.exit(ok ? 0 : 1);
