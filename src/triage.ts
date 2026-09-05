/**
 * tinyforge triage — deterministic Tier-3 in ~150 lines.
 *
 * Raw session reports (reports/*.json) are EVIDENCE; the dev loop should eat
 * ISSUES. Triage explodes each report into atomic units (one bug / confusion /
 * suggestion each), clusters near-duplicates across the wave (word-overlap
 * coefficient — no model, no randomness), counts corroboration, and files one
 * queue item per cluster. Rules: a P0 bug promotes alone; a P1 bug promotes
 * alone; subjective units (confusions, suggestions) file at P2 and rise to P1
 * only when 2+ independent reports corroborate. Consumed reports move to
 * reports/triaged/. Re-running is idempotent: an issue id already present in
 * queue/, queue/failed/ or done/ is not re-filed. Subjective units (confusion/
 * suggestion) get a second, fuzzier check: a wave over wave restates the same
 * concern in different words, so a new one is also dropped when its title
 * overlaps >= 0.5 with any already-filed confusion/suggestion — the same
 * threshold clusterUnits uses within one wave, just applied across waves too.
 * Bug reports skip this fuzzy check and always need an exact id match, so a
 * recurring bug (maybe a regression) is never silently swallowed.
 * queue/superseded/ (issues folded by hand into a better-corroborated one,
 * listed in its _manifest.json) counts as already known too.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

type Unit = {
  kind: "bug" | "confusion" | "suggestion";
  sev: "P0" | "P1" | "P2";
  title: string;
  where?: string;
  report: string; // filename
  seed?: number;
  model?: string;
  build?: unknown;
  verified?: boolean;
};

const STOP = new Set(
  "the a an to of in on for and or is was are it that this with at be as i you your it's not no never would should could".split(" "),
);

export function bag(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => (w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w));
  return new Set(words);
}

/** Overlap coefficient |A∩B| / min(|A|,|B|) — robust to one side being wordier. */
export function overlap(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const w of a) if (b.has(w)) inter++;
  return inter / Math.min(a.size, b.size);
}

export function unitsFromReport(file: string, r: Record<string, unknown>): Unit[] {
  const meta = { report: file, seed: r.seed as number, model: r.model as string, build: r.build, verified: r.verified as boolean };
  const out: Unit[] = [];
  for (const b of (Array.isArray(r.bugs) ? r.bugs : []) as { sev?: string; what?: string; where?: string }[]) {
    if (!b.what) continue;
    const sev = b.sev === "P0" ? "P0" : "P1";
    out.push({ kind: "bug", sev, title: b.what, where: b.where, ...meta });
  }
  for (const c of (Array.isArray(r.confusions) ? r.confusions : []) as string[])
    if (c) out.push({ kind: "confusion", sev: "P2", title: c, ...meta });
  for (const s of (Array.isArray(r.suggestions) ? r.suggestions : []) as string[])
    if (s) out.push({ kind: "suggestion", sev: "P2", title: s, ...meta });
  return out;
}

export type Issue = {
  schema: 1;
  kind: "issue";
  id: string;
  priority: "P0" | "P1" | "P2";
  unit_kind: Unit["kind"];
  title: string;
  where?: string;
  corroboration: number; // distinct reports in the cluster
  verified_reports: number;
  evidence: { report: string; seed?: number; model?: string; quote: string }[];
  builds: unknown[];
  created: string;
};

export function clusterUnits(units: Unit[]): Issue[] {
  // deterministic union-find over same-kind units with word-overlap >= 0.5
  const parent = units.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const bags = units.map((u) => bag(`${u.title} ${u.where ?? ""}`));
  for (let i = 0; i < units.length; i++)
    for (let j = i + 1; j < units.length; j++) {
      if (units[i]!.kind !== units[j]!.kind) continue;
      if (overlap(bags[i]!, bags[j]!) >= 0.5) parent[find(j)] = find(i);
    }
  const groups = new Map<number, Unit[]>();
  units.forEach((u, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(u);
  });

  const issues: Issue[] = [];
  for (const g of groups.values()) {
    const reps = new Set(g.map((u) => u.report));
    const corr = reps.size;
    const worstSev = g.some((u) => u.sev === "P0") ? "P0" : g.some((u) => u.sev === "P1") ? "P1" : "P2";
    const priority: Issue["priority"] =
      worstSev !== "P2" ? worstSev : corr >= 2 ? "P1" : "P2"; // subjective rises only with corroboration
    const title = g.map((u) => u.title).sort((a, b) => b.length - a.length)[0]!;
    const id = createHash("sha256").update([...bag(title)].sort().join("-")).digest("hex").slice(0, 8);
    issues.push({
      schema: 1,
      kind: "issue",
      id,
      priority,
      unit_kind: g[0]!.kind,
      title,
      where: g.find((u) => u.where)?.where,
      corroboration: corr,
      verified_reports: g.filter((u) => u.verified).length,
      evidence: g.slice(0, 3).map((u) => ({ report: u.report, seed: u.seed, model: u.model, quote: u.title })),
      builds: [...new Set(g.map((u) => JSON.stringify(u.build ?? null)))].map((s) => JSON.parse(s)),
      created: new Date().toISOString(),
    });
  }
  // stable order: priority, then id
  return issues.sort((a, b) => a.priority.localeCompare(b.priority) || a.id.localeCompare(b.id));
}

export function triage(opts?: { reportsDir?: string; queueDir?: string; dedupeDirs?: string[] }): {
  consumed: number;
  filed: Issue[];
  skipped: number;
} {
  const reportsDir = opts?.reportsDir ?? join(ROOT, "reports");
  const queueDir = opts?.queueDir ?? join(ROOT, "queue");
  const dedupeDirs = opts?.dedupeDirs ?? [
    queueDir,
    join(queueDir, "failed"),
    join(queueDir, "superseded"),
    join(ROOT, "done"),
  ];
  mkdirSync(join(reportsDir, "triaged"), { recursive: true });
  mkdirSync(queueDir, { recursive: true });

  const files = readdirSync(reportsDir).filter((f) => f.endsWith(".json")).sort();
  const units: Unit[] = [];
  const readable: string[] = []; // only these get archived; unreadable/foreign files stay put
  for (const f of files) {
    try {
      const r = JSON.parse(readFileSync(join(reportsDir, f), "utf8")) as Record<string, unknown>;
      if (r.kind === "playtest") {
        units.push(...unitsFromReport(f, r));
        readable.push(f);
      } else {
        console.error(`triage: leaving ${f} (kind is not "playtest")`);
      }
    } catch {
      console.error(`triage: leaving ${f} (not valid JSON)`);
    }
  }
  const existingIds = new Set<string>();
  const priorSubjective: Set<string>[] = []; // title+where bags of already-filed confusion/suggestion issues
  for (const d of dedupeDirs) {
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) {
      const m = /-issue-([0-9a-f]{8})\.json$/.exec(f);
      if (!m) continue;
      existingIds.add(m[1]!);
      try {
        const prior = JSON.parse(readFileSync(join(d, f), "utf8")) as Issue;
        if (prior.unit_kind !== "bug") priorSubjective.push(bag(`${prior.title} ${prior.where ?? ""}`));
      } catch {
        // unreadable entry: id-dedup above still applies, just no title to fuzzy-compare against
      }
    }
  }
  const issues = clusterUnits(units);
  const filed: Issue[] = [];
  let skipped = 0;
  for (const issue of issues) {
    if (existingIds.has(issue.id)) { skipped++; continue; }
    if (issue.unit_kind !== "bug") {
      const titleBag = bag(`${issue.title} ${issue.where ?? ""}`);
      if (priorSubjective.some((b) => overlap(b, titleBag) >= 0.5)) { skipped++; continue; }
    }
    writeFileSync(join(queueDir, `${issue.priority}-issue-${issue.id}.json`), JSON.stringify(issue, null, 2));
    filed.push(issue);
  }
  for (const f of readable) renameSync(join(reportsDir, f), join(reportsDir, "triaged", f));
  return { consumed: readable.length, filed, skipped };
}

if (process.argv[1]?.endsWith("triage.ts")) {
  const r = triage();
  console.log(
    `triage: ${r.consumed} report(s) -> ${r.filed.length} new issue(s)${r.skipped ? `, ${r.skipped} already known` : ""}`,
  );
  for (const i of r.filed)
    console.log(`  ${i.priority} ${i.unit_kind} x${i.corroboration} (${i.verified_reports} verified): ${i.title.slice(0, 90)}`);
}
