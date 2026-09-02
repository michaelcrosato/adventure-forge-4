#!/usr/bin/env bash
# tinyforge dev loop — assess -> one change -> verify -> commit. Red reverts.
#
#   loop/dev.sh          one cycle
#   loop/dev.sh 5        up to five cycles (stops when queue is empty)
#
# Env: TF_DEV_MODEL (model id)  TF_DEV_MAX_TURNS (default 50)
#      TF_DEV_FLAGS (extra claude flags; e.g. --dangerously-skip-permissions
#                    for fully unattended runs on a machine you trust)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
CYCLES="${1:-1}"
MAX_TURNS="${TF_DEV_MAX_TURNS:-50}"
FAILS=0
mkdir -p runs
RUN_ID="$(date +%Y%m%dT%H%M%S)"  # else dev-cycle-N.json is overwritten by the next invocation's cycle N

command -v claude >/dev/null || { echo "claude CLI not found — install Claude Code"; exit 1; }
git rev-parse HEAD >/dev/null 2>&1 || { echo "not a git repo — run: git init && git add -A && git commit -m init"; exit 1; }

count_tests() { npm run -s test 2>/dev/null | grep -Eo '^# pass [0-9]+' | grep -Eo '[0-9]+' || echo 0; }

for ((c = 1; c <= CYCLES; c++)); do
  echo "── cycle $c/$CYCLES ─────────────────────────────"
  git diff --quiet && git diff --cached --quiet || { echo "dirty tree — commit or stash first"; exit 1; }
  REF="$(git rev-parse HEAD)"

  # assess: triage any fresh reports into issues, then queued work first, P0 > P1 > P2, oldest first
  npx tsx src/triage.ts 2>/dev/null || true
  git add -A >/dev/null 2>&1 && git -c user.email="loop@tinyforge" -c user.name="tinyforge-loop" \
    commit -qm "triage: reports -> issues" >/dev/null 2>&1 || true
  FINDING="$(ls queue/P0-*.json queue/P1-*.json queue/P2-*.json 2>/dev/null | head -1 || true)"
  [[ -z "$FINDING" ]] && { echo "queue empty — nothing to do. (Run npm run playtest to refill.)"; exit 0; }
  echo "finding: $FINDING"
  # staleness advisory: an issue filed against an older build is still evidence, just older
  ISSUE_REV="$(node -e 'try{const f=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const b=(f.builds&&f.builds[0])||f.build;if(b&&b.rev)process.stdout.write(b.rev)}catch{}' "$FINDING")"
  CUR_REV="$(git rev-parse --short HEAD)"
  [[ -n "$ISSUE_REV" && "$ISSUE_REV" != "$CUR_REV" ]] && \
    echo "  note: filed on build $ISSUE_REV, current is $CUR_REV — re-check it still reproduces"

  npm run -s verify >/dev/null || { echo "bar is RED before work — fix the tree first"; exit 1; }
  TESTS_BEFORE="$(count_tests)"

  PROMPT="$(cat AGENT.md; echo; sed -e "/{{FINDING}}/{r $FINDING" -e "d}" loop/dev-prompt.md)"
  set +e
  claude -p "$PROMPT" \
    --allowedTools "Read,Glob,Grep,Edit,Write,Bash(npm *),Bash(npx *),Bash(node *)" \
    --permission-mode acceptEdits \
    --output-format json --max-turns "$MAX_TURNS" \
    ${TF_DEV_MODEL:+--model "$TF_DEV_MODEL"} \
    ${TF_DEV_FLAGS:-} \
    > "runs/dev-cycle-$RUN_ID-$c.json" 2>&1 < /dev/null
  AGENT_RC=$?
  set -e

  # integrity: the loop and charter are not the agent's to edit; tests may not shrink
  BAD_EDITS="$(git diff --name-only "$REF" -- loop/ AGENT.md | tr '\n' ' ')"
  DELETED_TESTS="$(git diff --diff-filter=D --name-only "$REF" -- test/ | tr '\n' ' ')"
  TESTS_AFTER="$(count_tests)"

  if [[ "$AGENT_RC" -ne 0 ]]; then REASON="agent exited $AGENT_RC"
  elif [[ -n "$BAD_EDITS" ]]; then REASON="edited protected paths: $BAD_EDITS"
  elif [[ -n "$DELETED_TESTS" ]]; then REASON="deleted tests: $DELETED_TESTS"
  elif [[ "$TESTS_AFTER" -lt "$TESTS_BEFORE" ]]; then REASON="test count fell $TESTS_BEFORE -> $TESTS_AFTER"
  elif git diff --quiet "$REF" -- src world test; then REASON="no-op cycle: agent changed nothing in src/ world/ test/"
  elif ! npm run -s verify; then REASON="verify red after work"
  else REASON=""
  fi

  if [[ -n "$REASON" ]]; then
    echo "✗ cycle $c FAILED: $REASON — reverting"
    # whole-repo clean, not just src/world/test/queue/done/reports: a failed
    # agent can leave scratch files anywhere (e.g. repo root), and .gitignore
    # already protects node_modules/, runs/, and *.log from removal here.
    git checkout -- . && git clean -fd >/dev/null 2>&1 || true
    mkdir -p queue/failed && mv "$FINDING" "queue/failed/$(basename "$FINDING")"
    git add -A >/dev/null 2>&1 && git -c user.email="loop@tinyforge" -c user.name="tinyforge-loop" \
      commit -qm "loop: quarantine $(basename "$FINDING") ($REASON)" >/dev/null 2>&1 || true
    FAILS=$((FAILS + 1))
    [[ "$FAILS" -ge 3 ]] && { echo "3 consecutive failures — circuit breaker, stopping"; exit 1; }
    continue
  fi

  FAILS=0
  mkdir -p done
  DEST="done/$(basename "$FINDING")"
  # the agent is told never to touch queue/done itself, but stay resilient if
  # $FINDING is already gone from queue/ (e.g. an earlier interrupted run) —
  # read wherever it actually is rather than crash on a stale queue/ path
  READ_FROM="$FINDING"; [[ -f "$FINDING" ]] || READ_FROM="$DEST"
  TITLE="finding"
  [[ -f "$READ_FROM" ]] && TITLE="$(node -e 'const f=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));console.log((f.title||f.bugs?.[0]?.what||f.kind||"finding").slice(0,60))' "$READ_FROM")"
  [[ -f "$FINDING" ]] && mv "$FINDING" "$DEST"
  git add -A
  git commit -q -m "loop: $TITLE" -m "finding: $(basename "$FINDING") | verified: npm run verify green"
  echo "✓ cycle $c landed: $(git log -1 --format=%h) loop: $TITLE"
done
