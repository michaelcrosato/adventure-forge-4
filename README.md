# tinyforge

An AI-coded, AI-playtested text RPG. A small deterministic engine, an MCP
server with 4 tools, blind AI playtesters, and a dev loop that only lands
green changes. Content is data. Every claim about the game is proven by a
replay, not asserted.

Two worlds ship today. **The Gray Reach** is the default game: a realm of ten
regions — the Vale of Ash as its first act, seven holds each with its own
unrested grief, a mountain pass, and a capital where the endings wait — with
companions who judge you, six factions that remember, fast travel between the
landmarks you have found, and seven endings, every one replay-proven. **The
Vale of Ash** is the compact original it grew from: four classes, perks,
levels, dice, two factions, a generated wood, and seven endings of its own.

```
playtest loop                               dev loop
blind players (MCP, API, or shell lane)     claude -p (dev agent)
   │  play; every trace replay-verified        │  reads ONE issue
   ▼                                           ▼
reports/*.json (raw, build-stamped)         npm run verify (green or revert)
   │  triage: cluster + corroborate            │
   ▼                                           ▼
queue/*-issue-*.json ─────────────────────► git commit → next wave plays it
```

## Quickstart

```bash
npm install
npm run verify        # the whole bar: typecheck + tests + validator + crawler
npm run play          # play The Vale of Ash in your terminal
npm run turn -- new 7 # one command per turn (for players that live in a shell)
npm run mcp           # MCP server (stdio); .mcp.json wires it into Claude Code
npm run mock          # zero-token structural player over real MCP (wiring check)
npm run measure       # full walkthrough over real MCP + token stats
npm run playtest 3    # wave of 3 blind Claude Code players (subscription lane)
npm run fleet -- --count 10 --parallel 5   # direct-API lane (needs ANTHROPIC_API_KEY)
npm run fleet -- --mock --count 2          # zero-token driver check for the API lane
npm run devloop 5     # up to 5 dev cycles: finding -> change -> verify -> commit
```

Needs Node 20+. Works on Windows, macOS, and Linux. The live loops need the
Claude Code CLI. `TF_WORLD=<file>` picks the world for every entry point —
`world/lighthouse.json` (the small regression world), `world/vale.json` (the
original Vale) — and defaults to the Gray Reach.

## What a turn looks like

One tool call, one plain-text block:

```
=Last Light Square | hp10/10 L1 score5 t3 gold0
[reeve: "It kills slow. Crops first, then cattle..." (+5) (+3xp)]
The dry well.
reeve is here
exits: N W E S
1 go north
2 go west
3 go east
4 go south
5 read the notice board
6 talk to reeve
```

The agent answers `act(s, 6)`. That is the whole interface. Along the proven
Vale walkthrough an `act` response averages ~450 chars (~120 tokens) and a
whole 34-turn session is ~18k chars (~4.7k tokens) of game text.
`npm run measure` prints the live numbers.

## The game systems

- **Classes.** Warden (fight), Scout (move and notice), Scholar (know),
  Envoy (talk). The first menu of every game is the class choice. Class gates
  content everywhere: a scholar reads the verses outright, a scout finds the
  crack in the barrow doors, an envoy talks the coffer open. Every obstacle
  has a force, a craft, and a words route, so no class is ever locked out.
- **Dice.** One die, the d20. Checks roll d20 + attribute + perk bonuses
  against a difficulty, and the menu previews the odds before you spend the
  turn. Attacks roll d20 + weapon + might against defense. Armor reduces
  damage taken. Every roll comes from the seed.
- **Perks and levels.** XP comes from beats, kills, and discovery. Levels
  give +2 max hp and a perk pick from a menu of what you qualify for.
- **Conversations.** A talkative npc folds its topics behind one `talk to X`
  entry; inside, the menu is the topics and a farewell in the npc's own
  voice. Topics gate on what you have heard, done, and carried.
- **Companions.** Recruit them, and they follow you room to room, fight
  beside you, remark on where you are and what you just chose, say "Lys
  disapproves." when they do, confide in you at high approval, and walk out
  at low — or when you cross the one line each of them has.
- **Choices that matter.** Promise the Reeve to seal the barrow and the
  priest's blessing is closed to you. Reputation with six factions prints the
  turn it moves and opens or closes doors across the realm. Rooms change with
  your choices; a burned village stays burned. Every ending appends the
  epilogue lines your flags have earned, so no two playthroughs end alike.
- **The world.** Regions with fast travel between discovered landmarks
  (browsing the travel menu is free; only the journey costs a turn); a
  journal that prints "Quest — …" the turn a stage changes; wilderness
  generated from seeded grids with a named scene on every cell; dungeons
  stamped from templates so a hundred barrows can each be written once. The
  generator is proven to 25,600 rooms in one test — bigger than Skyrim's map
  at any sane cell size.

## Proof over promises

`npm run verify` (~10s) enforces:

- **Typecheck** — strict, no unchecked indexing.
- **Tests** (168) — determinism (same seed = byte-identical run, and an engine
  core that provably never reads the clock), the character layer,
  conversations and companions, travel and the journal, templates and
  stamps, worlds in parts, worldgen scale, triage promotion rules, the fleet
  driver and its report honesty check, content rules the shipped worlds must
  keep, and the token budget along every world's walkthrough (the realm
  draft included).
- **Validator** — every reference resolves, the DSL is closed, every room is
  reachable, no class ever faces a perk menu bigger than the cap, the primary
  walkthrough replays to a win with score === maxScore, and **every other
  ending carries its own replay-proof**. "Choice matters" is checked, not
  claimed.
- **Crawler** — seeded random walks over the real engine checking crash,
  empty-menu, purity, bounds, and template-hole invariants every step.

Every session writes a trace. A playtest report's receipt must equal an
engine replay of that trace, or the report files as unverified. No playtest
lane can hand-wave a session.

The same bar runs in CI (`.github/workflows/verify.yml`) on Node 20, 22, and
24 for every push to `main` and every pull request, followed by the
zero-token mock player and the walkthrough measurement over the real MCP
server.

## Three playtest lanes

| | `npm run playtest` (MCP + Claude Code) | `npm run fleet` (in-process + raw API) | `npm run turn` (shell) |
|---|---|---|---|
| player sees | game via the 4 MCP tools inside a full agent harness | only rendered game text | one screen per command |
| needs | Claude subscription | `ANTHROPIC_API_KEY` | a shell |
| best for | interop proof | volume: 10–100 cheap players per wave | any agent with a Bash tool |

Same report schema, same queue, same replay-verified receipts either way
(`loop/report-check.mjs` files a shell-lane report too). A report contributes
only its own fields; the host writes `verified`, `seed`, `build`, and the
actual ending, so no report can claim more than its replay proves.

## Writing content

`docs/authoring.md` is the complete DSL — conditions, effects, rooms, items,
npcs and conversations, companions, generated regions, templates and stamps,
quests, epilogue — with the id conventions, the style and token budget, and
how proofs are written. `docs/superpowers/specs/2026-09-05-realm-design.md`
is the realm's design and state contract; `docs/region-brief.md` is the brief
a region author works from.

```bash
node --import tsx scripts/lint-world.ts world/reach.json      # text budgets, per-region counts
node --import tsx scripts/audit-choices.ts world/reach.json  # which choices the world reads back, and which it forgets
node --import tsx scripts/walk.ts world/reach.json steps.json  # label list -> walkthrough, perk picks inserted
node scripts/fmt-json.mjs world/reach/*.json                  # compact, stable content formatting
```

## Layout

```
src/engine.ts     pure reducer: PRNG, checks, combat, classes, perks, xp, party, travel, journal
src/worldgen.ts   seeded regions, templates and stamps (structure only; text from the world file)
src/format.ts     the token budget lives here
src/validate.ts   loader (parts, includes), closed-DSL checks, reachability, walkthrough and ending proofs
src/crawl.ts      mechanical crawler + trace replay
src/mcp.ts        4 tools: new_game / act / look / status
src/turn.ts       the shell lane: one command per turn, replayed from its trace
src/player.ts     direct-API fleet lane
src/triage.ts     reports -> atomic corroborated issues
src/play.ts       human CLI
world/reach.json  The Gray Reach (the default game): root, classes, perks, quests, walkthrough, proofs
world/reach/      its parts — the Vale rebuilt, companions, templates, and eight more regions
world/vale.json   The Vale of Ash, the original compact world
world/lighthouse.json  the small regression world
scripts/          author tools: lint, choice audit, walk, stubs, land, fmt
test/             165 tests, including the token budget and determinism rules
loop/             playtest wave, dev cycle, mock player, report checker
queue/ done/      the one inbox (issues) and its archive
docs/             design specs, the authoring guide, review findings
AGENT.md          the charter the dev agent is prompted with
```

## The loops, unattended

```bash
npm run playtest 5
TF_PLAYER_MODEL=<model-id> TF_SEED_BASE=100 npm run playtest 10
TF_DEV_FLAGS=--dangerously-skip-permissions npm run devloop 10   # only on a machine you trust
```

Driver-enforced per dev cycle: clean tree in, protected paths untouched
(`loop/`, `AGENT.md`), no deleted tests, test count non-decreasing, no no-op
cycles, verify green — else restore the tree to its pre-agent baseline and
quarantine the issue in `queue/failed/`. Three straight failures trip the
circuit breaker. Between waves and the dev loop, triage clusters
near-duplicate findings across reports (deterministic word overlap, no
model): mechanical bugs promote alone, subjective suggestions need 2+
independent reports to rise.

## Provenance

Built by AI (Claude). The lighthouse world and flywheel came first (won 55/55
blind on the first queued playtest, receipt verified by trace replay). The
character systems, ending proofs, worldgen, and the Vale of Ash were added
2026-09-01 after a repo audit. Companions, conversations, regions, templates,
and the Gray Reach began 2026-09-05. MIT-yours.
