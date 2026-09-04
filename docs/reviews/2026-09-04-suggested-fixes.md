# Suggested fixes from the repository review

Review date: 2026-09-04.
Reviewed branch: `main`.
Reviewed commit: `11ddd8d5a52223235f0d4c64d796708788d61a07`.

This file records eight confirmed defects, suggested changes, and acceptance checks.
The fixes have not been applied.

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
