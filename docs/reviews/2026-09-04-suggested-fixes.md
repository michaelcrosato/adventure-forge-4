# Suggested fixes from the repository review

Review date: 2026-09-04.
Reviewed branch: `main`.
Reviewed commit: `11ddd8d5a52223235f0d4c64d796708788d61a07`.

This file records eight confirmed defects, suggested changes, and acceptance checks.

**Status (2026-09-05): all eight fixes applied** in the repository audit
([PR #1](https://github.com/michaelcrosato/adventure-forge-4/pull/1), branch
`claude/repo-audit-cleanup-uo5dgd`). Each item below ends with an *Applied*
note saying what changed and how the acceptance check was met.

P1 means fix promptly. P2 means fix in the normal development schedule.
Source links use the reviewed commit so that the evidence remains stable.

## 1. P1: Restore staged changes after a failed development cycle

Source: [loop/dev.sh, line 76](https://github.com/michaelcrosato/adventure-forge-4/blob/11ddd8d5a52223235f0d4c64d796708788d61a07/loop/dev.sh#L76).

**Fault:** `git checkout -- .` restores working files from the index.
If the agent stages a broken change, that change survives the restore.
The quarantine commit then includes it.

**Evidence:** An isolated driver test staged a broken source file and made the agent exit with status 1.
The driver reported a failed cycle, but the quarantine commit contained the broken file.
Verification then failed.

**Suggested change:**

- Record a clean baseline after the triage commit and before the agent starts.
- On failure, restore both the index and tracked working files to that baseline.
- Use an isolated worktree, or preserve the contents of files that existed before the cycle.
- Remove only untracked files created by the failed cycle.
- Stage only the intended triage and quarantine files. Do not use an unrestricted `git add -A` for these commits.
- Move the issue to quarantine only after the restore succeeds.
- Stop if the restore fails. Do not continue to a quarantine commit with uncertain source contents.

**Acceptance check:** In an isolated repository, stage a broken source change and fail the agent.
Confirm that source and tests match the baseline, verification passes, and the new commit contains only the intended issue move.
Repeat with a staged change to a protected file and a newly staged file.
Confirm that the post-triage baseline and pre-existing untracked file contents remain intact.

**Applied.** `loop/dev.sh` now records the baseline (`REF`) and the list of pre-existing untracked files after the triage commit and before the agent starts.
On failure it runs `git reset --hard` to that baseline, deletes only untracked files the cycle created (and the directories made for them), stops if the tree is still dirty, and only then moves the issue to `queue/failed/`.
The triage commit stages `reports/` and `queue/` only; the quarantine commit stages `queue/` only.
Checked in an isolated copy with a stub `claude` that staged a broken source edit, edited `AGENT.md`, left scratch files, and exited 1: the quarantine commit contained only the queue move, source and tests matched the baseline, a pre-existing untracked file survived, and typecheck passed afterwards.

## 2. P1: Keep report data separate from trusted metadata

Sources: [src/player.ts, line 253](https://github.com/michaelcrosato/adventure-forge-4/blob/11ddd8d5a52223235f0d4c64d796708788d61a07/src/player.ts#L253)
and [loop/report-check.mjs](https://github.com/michaelcrosato/adventure-forge-4/blob/11ddd8d5a52223235f0d4c64d796708788d61a07/loop/report-check.mjs).

**Fault:** Both report writers copy model output after host-controlled fields.
Extra report properties can replace `verified`, `seed`, `build`, or other metadata.
The API writer also permits replacement of the actual ending.

**Evidence:** The API replay returned `verified: false`, ending `beacon_lit`, and seed 7.
A report with an invalid receipt and extra properties was saved with `verified: true`, ending `invented`, and seed 999.

**Suggested change:**

- Validate the report shape and copy only the supported report properties.
- Write host-controlled metadata after the accepted report fields.
- Keep the verification result, seed, build, usage, and actual ending under host control.
- Apply the same rule to both report writers.

**Acceptance check:** Supply an invalid receipt with `verified: true` and false metadata.
Confirm that the saved report remains unverified and retains the host values.
Also confirm that a valid report still passes.

**Applied.** Both writers copy only `verdict`, `fun`, `clarity`, `turns`, `receipt`, `bugs`, `confusions`, and `suggestions` (`REPORT_FIELDS` in `src/player.ts`, mirrored in `loop/report-check.mjs`) and write the host metadata after them.
The API lane now also validates the report shape the way the MCP lane always did.
Test: "a filed report cannot overwrite host-controlled metadata" in `test/player.test.ts`; the MCP checker was exercised by hand with a forged `verified`, `seed`, `build`, and `lane`, all of which the filed report ignored while a valid receipt still verified.

## 3. P1: Make the test-count check independent of the default reporter

Source: [loop/dev.sh, line 22](https://github.com/michaelcrosato/adventure-forge-4/blob/11ddd8d5a52223235f0d4c64d796708788d61a07/loop/dev.sh#L22).

**Fault:** `count_tests` expects a line that starts with `# pass`.
On Node 24.19.0, the default reporter prints `ℹ pass 86`.
The parser returns zero before and after the cycle.
It cannot detect test cases removed from a retained file.

**Suggested change:**

- Select TAP explicitly before the file arguments: `node --import tsx --test --test-reporter=tap test/*.test.ts`.
- Require exactly one valid passing-test count. Preserve the test command's exit status.
- Treat a failed test command or a missing count as an error. Do not substitute zero.
- Keep the existing check for deleted test files.

**Acceptance check:** Confirm that the count matches the runner on supported Node versions, including Node 24.
Remove one passing test from an existing file in an isolated fixture.
Confirm that the driver rejects the cycle.
Also confirm that an unreadable count stops the cycle.

**Applied.** `count_tests` runs `node --import tsx --test --test-reporter=tap test/*.test.ts` and requires exactly one `# pass N` line; a failed run or a missing count is an error.
Before the agent runs, an unreadable count stops the driver; after, it fails the cycle ("test run failed or its passing count is unreadable") instead of reading as zero.
Checked in the isolated copy with a stub agent that removed one test from a retained file and exited 0: the cycle was rejected with "test count fell".

## 4. P2: Update the MCP mock tool check

Source: [loop/mock-player.mjs, line 110](https://github.com/michaelcrosato/adventure-forge-4/blob/11ddd8d5a52223235f0d4c64d796708788d61a07/loop/mock-player.mjs#L110).

**Fault:** The mock requires exactly `act`, `look`, and `new_game`.
The server also supplies `status`.
The check fails before a session starts.

**Evidence:** Both `npm run mock` and `npm run measure` exit with:
`unexpected tool surface: act,look,new_game,status`.

**Suggested change:** Include `status` in the expected tool set.
Keep the check for missing or unexpected tools.

**Acceptance check:** Run `npm run mock` and `npm run playtest -- 1 --mock`.
Confirm that sessions start and complete the structural check.
After fix 5, confirm that `npm run measure` completes the walkthrough.

**Applied.** The expected surface is `act, look, new_game, status`; a missing or extra tool still fails.
`npm run mock` completes a 200-step random walk, and `npm run measure` replays the Vale walkthrough over the real server to a full-score win (`vale.7.34.100.king_at_rest`), the Lighthouse one likewise.

## 5. P2: Match walkthrough labels when the menu includes display hints

Sources: [src/player.ts, line 89](https://github.com/michaelcrosato/adventure-forge-4/blob/11ddd8d5a52223235f0d4c64d796708788d61a07/src/player.ts#L89)
and [loop/mock-player.mjs, line 85](https://github.com/michaelcrosato/adventure-forge-4/blob/11ddd8d5a52223235f0d4c64d796708788d61a07/loop/mock-player.mjs#L85).

**Fault:** Hint removal does not cover all text added by `oddsHint`.
For example, the API mock cannot match `go east` to `go east (toward drowned shrine)`.
It skips required walkthrough steps.

**Evidence:** `playOne(vale, 1, mockProvider(vale))` stops at turn 35 with no ending and `stalled: true`.
The first missed step occurs at Sodden Verge.

**Suggested change:**

- Use one matching rule for both mock clients.
- Accept an exact canonical label or that label followed by a recognized display hint.
- Cover destination, locked-exit, roll, skill, and item-use hints.
- Preserve parentheses that belong to the canonical label, such as `(scholar)` or a perk description.
- Report an unmatched ordinary walkthrough step as an error. Do not silently skip it.

**Acceptance check:** Run both shipped walkthroughs through the API mock.
Confirm a win, maximum score, and a verified receipt.
After fix 4, run both through the MCP measurement client.
Check labels with destination hints, skill hints, item hints, and canonical parentheses.

**Applied.** One rule, `matchesMenuLabel` in `src/format.ts` (the inverse of `renderMenu`): a line matches its canonical label exactly, or the label followed by exactly one trailing ` (…)` hint of any kind.
`findMenuEntry` in `src/player.ts` tries an exact match first, then that rule; `loop/mock-player.mjs` carries the same two lines because it runs without `tsx`.
An ordinary step that is not on the menu now throws in both clients.
Tests: `matchesMenuLabel` cases in `test/format.test.ts` (destination, locked-exit, roll with and without modifier, item-use, canonical parentheses, near-miss rejections) and a full Vale walkthrough through the API mock in `test/player.test.ts` (win, `score === maxScore`, verified receipt).

## 6. P2: Grant early coffer XP only once

Source: [world/vale.json, line 1988](https://github.com/michaelcrosato/adventure-forge-4/blob/11ddd8d5a52223235f0d4c64d796708788d61a07/world/vale.json#L1988).

**Fault:** `coffer_sealed` and `coffer_sealed_seal_early` grant one XP on each use.
Neither topic becomes unavailable or records that the reward was given.

**Evidence:** With seed 1, choose Warden, then go south, south, east.
Ask the elder about the sealed coffer twice.
XP rises from 0 to 1 to 2, and the topic remains available.
Repeated use permits unlimited levels and maximum HP before the player leaves the village.

**Suggested change:** Use the existing conditions and flag effects to separate the first rewarded discussion from later reminders.
Use a shared reward flag for both early-coffer variants.
Keep the clue available, but grant no further XP.
No new engine operation is needed.

**Acceptance check:** Repeat each early-coffer topic and switch between the two states.
Confirm that the combined reward is at most one XP and the clue remains available.
Replay the walkthrough and ending proofs.
Update proof steps if the intended progression changes.

**Applied.** Both early-coffer topics set a shared `asked_coffer_early` flag with their one XP; two reminder topics (`coffer_sealed_again`, `coffer_sealed_seal_early_again`) keep the clue on the menu afterwards with no reward.
No proof step changed (every proof hears the grievance before visiting the elder).
Test: "asking the elder about the coffer early rewards xp once" in `test/content.test.ts`, including the switch to the seal-in-hand variant.

## 7. P2: State the damage risk for repeated door attempts

Source: [world/vale.json, line 961](https://github.com/michaelcrosato/adventure-forge-4/blob/11ddd8d5a52223235f0d4c64d796708788d61a07/world/vale.json#L961).

**Fault:** The menu says door attempts are safe without a limit.
Each failed check removes one HP and can kill the player.

**Evidence:** Use seed 320 and choose Envoy.
Take the quick trail from the gate to the barrow.
Attempt `force_doors` ten times.
All ten checks fail, and the player dies at turn 12.

**Suggested change:** Replace the safety claim with a short warning, for example:
`force the doors — failed attempts cost 1 hp`.
Correct the sealed-door variant too.
Check the loose-stone labels for the same safety claim.
Preserve the intended damage rules.

**Acceptance check:** Confirm that each affected menu states the risk before the action.
Replay the seed 320 case and confirm that the warning matches the damage.
Update walkthrough or proof labels that refer to changed text.
Run the observation-budget check.

**Applied.** `force the doors — a failed try costs 1 hp` (both variants) and `… a failed try costs 1 hp (scout|wits)` on the two loose-stone actions, whose failure branches deduct exactly that.
The strongbox and coffer labels keep their safety claim, which is true there (no hp on failure).
No walkthrough or proof referenced the changed labels; the budget test is unaffected because none of these actions sit on the proven path.
A content test in `test/content.test.ts` now fails any world where a label claims safety on a check whose failure costs hp.

## 8. P2: Use the active world for MCP report metadata

Source: [loop/report-check.mjs, line 24](https://github.com/michaelcrosato/adventure-forge-4/blob/11ddd8d5a52223235f0d4c64d796708788d61a07/loop/report-check.mjs#L24).

**Fault:** The report checker defaults to `world/lighthouse.json`.
The MCP server defaults to `world/vale.json`.
Default Vale reports therefore contain the Lighthouse content hash.

**Suggested change:** Make the server and report checker use the same world-path selection.
Use Vale as the default and preserve the `TF_WORLD` override.
Share this selection or pass the resolved path explicitly.

**Acceptance check:** With `TF_WORLD` unset, confirm that the report hash equals the Vale file hash.
With `TF_WORLD=world/lighthouse.json`, confirm that it equals the Lighthouse file hash.

**Applied.** `loop/report-check.mjs` defaults to `world/vale.json` like the server.
`loop/playtest.sh` resolves `TF_WORLD` once (absolute, default Vale), exports it for the checker, and passes it explicitly in the generated MCP config's `env`, so the server cannot be started on a different world than the one hashed.
Checked by hand: the filed hash equals the Vale file hash with `TF_WORLD` unset and the Lighthouse hash with the override.
The same wave now also lets MCP-lane players call the free `status` tool, which the server had offered but the prompt and allow-list did not.

## Verification recorded during the review

- Type checking passed.
- All 86 tests passed.
- Both shipped worlds passed validation.
- The crawler passed for both worlds.
- The MCP mock and measurement commands failed as described in fix 4.
- The default API mock failed as described in fix 5.

The full `npm run verify` command stopped when this environment blocked a socket used by the `tsx` CLI.
The remaining validator and crawler checks passed with `node --import tsx`.
This limitation is separate from the confirmed defects.

Before each implementation change lands, run the repository's required verification command.
Do not weaken tests, proof checks, or observation limits.
Changes under `loop/` require maintainer work because the automated development agent is prohibited from editing that directory.
