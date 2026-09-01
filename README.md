# tinyforge

An AI-coded, AI-playtested text RPG. A small deterministic engine, an MCP
server with 3 tools, blind AI playtesters, and a dev loop that only lands
green changes. Content is data. Every claim about the game is proven by a
replay, not asserted.

The shipped game is **The Vale of Ash**: four character classes, perks,
levels, dice, two factions, a generated overworld region, and four different
endings — every one of them replay-proven reachable by the validator.

```
playtest loop                               dev loop
blind players (MCP lane or API lane)        claude -p (dev agent)
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
npm run mcp           # MCP server (stdio); .mcp.json wires it into Claude Code
npm run mock          # zero-token structural player over real MCP (wiring check)
npm run measure       # full walkthrough over real MCP + token stats
npm run playtest 3    # wave of 3 blind Claude Code players (subscription lane)
npm run fleet -- --count 10 --parallel 5   # direct-API lane (needs ANTHROPIC_API_KEY)
npm run fleet -- --mock --count 2          # zero-token driver check for the API lane
npm run devloop 5     # up to 5 dev cycles: finding -> change -> verify -> commit
```

Needs Node 20+. Works on Windows, macOS, and Linux. The live loops need the
Claude Code CLI. Set `TF_WORLD=world/lighthouse.json` to play the small
regression world instead.

## What a turn looks like

One tool call, one plain-text block:

```
=Last Light Square | hp10/10 L1 score5/100 t3
[reeve: "It kills slow. Crops first, then cattle..." (+5) (+3xp)]
The dry well.
1 go north
2 go west
3 go east
4 go south
5 ask reeve: the barrow
```

The agent answers `act(s, 4)`. That is the whole interface. Average response
along the proven walkthrough: ~170 chars (~45 tokens).

## The game systems

- **Classes.** Warden (fight), Scout (move and notice), Scholar (know),
  Envoy (talk). The first menu of every game is the class choice. Class gates
  content everywhere: a scholar reads the verses outright, a scout finds the
  crack in the barrow doors, an envoy talks the coffer open.
- **Dice.** One die, the d20. Checks roll d20 + attribute + perk bonuses
  against a difficulty. Attacks roll d20 + weapon + might against defense.
  Armor reduces damage taken. Every roll comes from the seed.
- **Perks and levels.** XP comes from beats, kills, and discovery. Levels
  give +2 max hp and a perk pick from a menu of what you qualify for.
- **Choices that matter.** Promise the Reeve to seal the barrow and the
  priest's blessing is closed to you. Learn why the king lingers and a
  third road opens. Four endings: bind him, kill him, repay him, join him.
- **The overworld.** The Ashwood between the village and the barrow is
  generated: a seeded grid with text pools, stitched to authored sites
  (hunter's camp, drowned chapel, watchtower). The generator is proven to
  25,600 rooms in one test — bigger than Skyrim's map at any sane cell size
  — while the shipped region stays small enough to play on a token budget.

## Proof over promises

`npm run verify` (~10s) enforces:

- **Typecheck** — strict, no unchecked indexing.
- **Tests** (45) — determinism (same seed = byte-identical run, and an engine
  core that provably never reads the clock), the character layer, worldgen,
  triage promotion rules, and the token budget along every world's walkthrough.
- **Validator** — every reference resolves, the DSL is closed, the primary
  walkthrough replays to a win with score === maxScore, and **every other
  ending carries its own replay-proof**. "Choice matters" is checked, not
  claimed.
- **Crawler** — seeded random walks over the real engine checking crash,
  empty-menu, purity, and bounds invariants every step. All 78 vale rooms
  reached.

Every session writes a trace. A playtest report's receipt must equal an
engine replay of that trace, or the report files as unverified. Neither
playtest lane can hand-wave a session.

## Two playtest lanes

| | `npm run playtest` (MCP + Claude Code) | `npm run fleet` (in-process + raw API) |
|---|---|---|
| player sees | game via MCP tools inside a full agent harness | only rendered game text |
| needs | Claude subscription | `ANTHROPIC_API_KEY` |
| best for | interop proof | volume: 10–100 cheap players per wave |

Same report schema, same queue, same replay-verified receipts either way.
`--mock` proves either driver end to end for zero tokens.

## Layout

```
src/engine.ts     pure reducer: PRNG, checks, combat, classes, perks, xp
src/worldgen.ts   seeded region generator (structure only; text from pools)
src/format.ts     the token budget lives here
src/validate.ts   closed-DSL checks + walkthrough and ending proofs
src/crawl.ts      mechanical crawler + trace replay
src/mcp.ts        3 tools: new_game / act / look
src/player.ts     direct-API fleet lane
src/triage.ts     reports -> atomic corroborated issues
src/play.ts       human CLI
world/vale.json   The Vale of Ash (the game)
world/lighthouse.json  the small regression world
test/             45 tests, including the token budget and determinism rules
loop/             playtest wave, dev cycle, mock player, report checker
queue/ done/      the one inbox (issues) and its archive
AGENT.md          the charter the dev agent is prompted with
docs/superpowers/specs/  design docs
```

## The loops, unattended

```bash
npm run playtest 5
TF_PLAYER_MODEL=<model-id> TF_SEED_BASE=100 npm run playtest 10
TF_DEV_FLAGS=--dangerously-skip-permissions npm run devloop 10   # only on a machine you trust
```

Driver-enforced per dev cycle: clean tree in, protected paths untouched
(`loop/`, `AGENT.md`), no deleted tests, test count non-decreasing, no no-op
cycles, verify green — else revert and quarantine the issue. Three straight
failures trip the circuit breaker. Between waves and the dev loop, triage
clusters near-duplicate findings across reports (deterministic word overlap,
no model): mechanical bugs promote alone, subjective suggestions need 2+
independent reports to rise.

## Provenance

Built by AI (Claude). The lighthouse world and flywheel came first (won 55/55
blind on the first queued playtest, receipt verified by trace replay). The
character systems, ending proofs, worldgen, and the Vale of Ash were added
2026-09-01 after a repo audit. MIT-yours.
