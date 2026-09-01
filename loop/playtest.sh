#!/usr/bin/env bash
# tinyforge playtest loop — waves of blind Claude players -> reports in queue/.
#
#   loop/playtest.sh              one wave of 1 player
#   loop/playtest.sh 5            one wave of 5 players
#   loop/playtest.sh 3 --mock     zero-token wiring check (structural mock player)
#
# Env: TF_PLAYER_MODEL (claude model id; default = CLI default)
#      TF_SEED_BASE (default: epoch seconds)   TF_MAX_TURNS (agent turns, default 100)
#      TF_MAX_GAME_TURNS (in-game turn budget told to the player, default 80)
#      TF_PARALLEL (players in flight, default 2)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COUNT="${1:-1}"; [[ "$COUNT" == --* ]] && COUNT=1
MOCK=0; for a in "$@"; do [[ "$a" == "--mock" ]] && MOCK=1; done
SEED_BASE="${TF_SEED_BASE:-$(date +%s)}"
SEED_BASE=$((SEED_BASE % 100000))
MAX_TURNS="${TF_MAX_TURNS:-100}"
MAX_GAME_TURNS="${TF_MAX_GAME_TURNS:-80}"
PARALLEL="${TF_PARALLEL:-2}"
WAVE_DIR="runs/playtest/$(date +%Y%m%dT%H%M%S)"
mkdir -p "$WAVE_DIR" queue

if [[ "$MOCK" == "1" ]]; then
  echo "wave (mock): $COUNT structural player(s) — no tokens, nothing filed to queue/"
  for ((i = 0; i < COUNT; i++)); do
    node loop/mock-player.mjs --seed $((SEED_BASE + i)) || { echo "mock player $i FAILED"; exit 1; }
  done
  echo "wiring green."
  exit 0
fi

command -v claude >/dev/null || { echo "claude CLI not found — install Claude Code or run with --mock"; exit 1; }

# MCP config with absolute paths so the player can run from anywhere.
CFG="$WAVE_DIR/mcp.json"
cat > "$CFG" <<EOF
{ "mcpServers": { "tinyforge": { "command": "npx", "args": ["tsx", "$ROOT/src/mcp.ts"] } } }
EOF

run_player() {
  local i="$1" seed=$((SEED_BASE + i))
  local out="$WAVE_DIR/player-$i-seed-$seed.json"
  local prompt
  prompt="$(sed -e "s/{{SEED}}/$seed/" -e "s/{{MAX_GAME_TURNS}}/$MAX_GAME_TURNS/" loop/player-prompt.md)"
  echo "  player $i (seed $seed) playing..."
  claude -p "$prompt" \
    --mcp-config "$CFG" --strict-mcp-config \
    --allowedTools "mcp__tinyforge__new_game,mcp__tinyforge__act,mcp__tinyforge__look" \
    --output-format json --max-turns "$MAX_TURNS" \
    ${TF_PLAYER_MODEL:+--model "$TF_PLAYER_MODEL"} \
    > "$out" 2> "$WAVE_DIR/player-$i.err" < /dev/null || { echo "  player $i: claude exited nonzero"; return 1; }
  node loop/report-check.mjs "$out" --seed "$seed" || echo "  player $i: report rejected"
}

echo "wave: $COUNT player(s), seeds $SEED_BASE+, parallel $PARALLEL"
pids=()
for ((i = 0; i < COUNT; i++)); do
  run_player "$i" &
  pids+=($!)
  while (( $(jobs -rp | wc -l) >= PARALLEL )); do wait -n || true; done
done
wait || true

echo "── wave summary ──"
npx tsx src/triage.ts || echo "triage failed; raw reports remain in reports/"
echo "queue now: $(ls queue/*.json 2>/dev/null | wc -l | tr -d ' ') item(s). Next: npm run devloop"
