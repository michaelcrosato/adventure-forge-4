# tinyforge

An **AI-coded, AI-playtested** text RPG in ~2,000 lines — the
[zork-unlimited](https://github.com/michaelcrosato/zork-unlimited) flywheel
(deterministic engine → MCP server → blind playtest loop → dev loop) rebuilt as
the smallest version that still keeps the property that matters: **freedom in
design, honesty in verification.**

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
npm run verify        # the whole bar: typecheck + tests + validator + crawler (~5s)
npm run play          # play it yourself in the terminal
npm run mcp           # MCP server (stdio); .mcp.json wires it into Claude Code
npm run mock          # zero-token structural player over real MCP (wiring check)
npm run measure       # full walkthrough over real MCP + token stats
npm run playtest 3    # wave of 3 blind Claude Code players (subscription lane)
npm run fleet -- --count 10 --parallel 5   # direct-API lane (needs ANTHROPIC_API_KEY)
npm run fleet -- --mock --count 2          # zero-token driver check for the API lane
npm run devloop 5     # up to 5 dev cycles: finding -> change -> verify -> commit
```

Requires Node 20+ and (for the live loops) the Claude Code CLI. `git init` +
one commit before the first `devloop`.

## What a turn looks like

One tool call, one plain-text block, ~55 tokens:

```
=Lamp Room | hp9/10 sc40/55 t21
[Oil works into the gears and the mechanism turns free. (+10)]
The great cold lamp.
1 go down
2 light the beacon
```

The agent answers `act(s, 2)`. That's the whole interface.

## Measured (this checkout, real runs)

| metric | tinyforge | zork-unlimited |
|---|---|---|
| code | ~1,050 lines `src/` (2,005 total) | 112,733 lines TS |
| MCP tools an agent must understand | **3** | 43 |
| tool calls per game turn | **1** (menu inlined) | 1–3 (obs/actions/step; inlining added later) |
| act response | avg ~206 chars (~54 tok), max ~500 | compact JSON + legend protocol |
| full blind win, game-side text | ~1.4k tokens, 26 calls | (long session, one context window budget) |
| verify bar | **~5s** (`npm run verify`) | minutes (`health`), crawl:smoke alone 20–35s |
| real blind playtest (Claude, seed 42) | won 55/55, $0.33, receipt verified | — |
| real dev cycle (finding → landed commit) | $0.53, 20 agent turns | — |

Why it advances faster: a cycle is bounded by its verify bar, and this bar runs
in seconds; a playtest is bounded by tokens/turn, and a turn is one small call.

## Two playtest lanes (and why both exist)

The engine is a **library**; MCP is just one adapter over it. That makes the
transport a choice per use, not an architecture:

| | `npm run playtest` (MCP + Claude Code) | `npm run fleet` (in-process + raw API) |
|---|---|---|
| player sees | game via MCP tools inside a full agent harness | ONLY rendered game text (blind by construction) |
| prefix carried per model call | ~43k tok (harness prompt + tool defs) | ~0.5k tok (player charter) |
| measured, one full win | seed 42: **1,197k** cache-read, $0.33 · seed 77: **2,027k** cache-read, $0.54 | seed 77 exact construction: **104k chars ≈ 25-30k tok** input across 28 calls (+~0.2k out) |
| token accounting | harness-reported | exact, per call, from API usage |
| needs | Claude subscription, no key | `ANTHROPIC_API_KEY`, per-token billing |
| best for | interop proof, humans-with-Claude, any-vendor CLIs | volume: 10-100 cheap players per wave |

Same report schema, same queue, same replay-verified receipts either way — a
report's receipt must equal an engine replay of the recorded trace, so neither
lane can hand-wave a session. The MCP server (140 lines) stays because it is
the interop surface any agent can connect to; the fleet runs in-process because
paying a ~43k-token harness to relay a 55-token observation is the wrong tool
for volume. `--mock` proves the fleet driver end to end for zero tokens.

Live per-turn sessions carry a stall guard — 12 turns with no new room and no
score ends the session as `stalled`, which is cheaper than funding a wandering
model to its turn cap and is itself a finding.

Negative result, kept for the record: a one-shot plan lane (one model call
plans the whole game from the opening scene; host executes the labels) was
trialed live and removed. With menu-local labels and unguessable proper nouns
("take storm lantern", "ask innkeep: the dark tower"), a real model's 30-step
plan executed exactly 1 action before derailing — the depth-before-derail
metric is structurally pinned at ~1 here, so the lane bought no information.
It only works for games that expose a globally stable, guessable action-id
grammar, which this game deliberately does not.

## What was kept vs shed

**Kept (the essence):** pure `step(state, action)` reducer, seeded PRNG cursor
in the state (same seed = byte-identical run, replayable traces), content as
validated data with a closed condition/effect DSL, legal-action menus as ground
truth, a walkthrough that must replay to a full-score win (ending witness +
score-economy proof in one), a zero-LLM crawler, blind players restricted to
the game's MCP surface, receipts verified by trace replay, one intake queue,
red-reverts-green-commits dev cycles, an observation token budget enforced as a
test, and a charter (`AGENT.md`) with do-not-weaken rules the driver enforces.

**Shed (the weight):** the overworld/journey-contract layer, 40 of 43 tools,
JSON+legend observation protocol (plain text instead), vendor registries and
capture attestation (single operator, trust your own machine — the receipt
replay keeps reports honest), exit-interview cross-verifiers, GitHub intake
sync, fleets/personas/cohort ledgers, eslint/prettier/vitest (tsc + node:test).

## Layout

```
src/engine.ts     pure reducer, PRNG, hash, legal actions   (~330 lines)
src/format.ts     the token budget lives here               (~100)
src/validate.ts   closed-DSL checks + walkthrough proof     (~150)
src/crawl.ts      Tier-1 mechanical crawler + trace replay  (~120)
src/mcp.ts        3 tools: new_game / act / look            (~140)
src/player.ts     direct-API fleet lane (in-process)        (~250)
src/triage.ts     reports -> atomic corroborated issues     (~150)
src/play.ts       human CLI                                 (~50)
world/*.json      the game (content is data, never code)
test/             determinism, validator corpus, TOKEN BUDGET, triage rules
loop/playtest.sh  wave of blind claude -p players -> reports/
loop/dev.sh       issue -> one change -> verify -> commit (red reverts)
loop/mock-player.mjs  zero-token structural player (real MCP stdio)
reports/          raw session evidence (build-stamped, replay-verified)
queue/ done/      the one inbox (issues) and its archive
AGENT.md          the charter the dev agent is prompted with
```

## The loops, unattended

```bash
npm run playtest 5          # or loop it: while true; do npm run playtest 3; npm run devloop 3; done
TF_PLAYER_MODEL=<model-id> TF_SEED_BASE=100 npm run playtest 10
TF_DEV_FLAGS=--dangerously-skip-permissions npm run devloop 10   # only on a machine you trust
```

Driver-enforced per cycle: clean tree in, protected paths untouched (`loop/`,
`AGENT.md`), no deleted tests, test count non-decreasing, no no-op cycles (the
agent must actually change `src/`, `world/` or `test/` — marking an issue done
without a diff is a failure), verify green — else revert, and the issue moves
to `queue/failed/`. Three consecutive failures trip the circuit breaker.

Between the waves and the dev loop sits `src/triage.ts`: raw reports are
evidence, the queue holds atomic ISSUES. Triage clusters near-duplicate
findings across a wave (deterministic word-overlap, no model), counts
corroboration across independent reports, and applies zork-unlimited's
promotion philosophy in miniature: mechanical bugs promote alone, subjective
suggestions reach P1 only when 2+ independent players agree. Reports are
stamped with the build (git rev + world content hash); the dev loop warns when
it picks up an issue filed against an older build.

## Provenance

Built 100% by AI (Claude, 2026-09-01) from a review of zork-unlimited: the
first queued finding was filed by a real blind Claude playtest (won 55/55,
receipt `lighthouse.42.25.55.beacon_lit.732babd1` verified by trace replay),
and commit `d29207b` was landed by a real unattended dev cycle consuming that
finding. MIT-yours.
