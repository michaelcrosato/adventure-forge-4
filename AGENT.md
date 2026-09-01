# tinyforge — agent charter

AI-coded text RPG. You (the dev agent) own the code and content; the automated
bar owns the truth. Freedom in design, honesty in verification.

## The bar (never route around it)

`npm run verify` = typecheck + tests + world validator + crawler. It must be
green before any cycle lands. Never weaken it: no deleting/disabling tests, no
loosening the observation budget (test/budget.test.ts), no editing loop/ or
this file. The driver reverts any cycle that tries.

## How this stays tiny and cheap

- **One turn = one tool call.** `act` returns events + scene + next menu in one
  plain-text block. Never add a tool an agent must call every turn.
- **Token budget is a test.** Avg act-response ≤ 450 chars along the
  walkthrough, max ≤ 1100. Prose is good; bloat is a red bar.
- **Content before engine.** Prefer editing `world/*.json`; touch `src/` only
  when the DSL genuinely can't express the fix. Keep the DSL closed — new ops
  need validator + tests in the same change.
- **Determinism is sacred.** No Date.now, no Math.random in the engine core —
  all game randomness flows through the state's PRNG cursor. Same seed = same
  run. The I/O edges (mcp, play, player, triage, crawl) may read the clock.
  test/determinism.test.ts enforces the line.
- **Every world carries its proof.** The walkthrough must replay to a win with
  score === maxScore. Every other ending needs a replay-proof in `proofs`.
  Change content ⇒ update the walkthrough and proofs in the same change.
- **Character rules are engine, flavor is data.** Classes, perks, and xp live
  in the world file. New DSL ops need validator + tests in the same change.
  Generated regions (`gen`) expand before validation — same file, same world.

## Cycle contract

One finding → one focused change → verify green → the DRIVER commits.
