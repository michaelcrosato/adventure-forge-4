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
#      TF_WORLD (world file; default world/vale.json, same as the server)
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# One resolved world path for the whole wave: the MCP server the players talk
# to, the mock player, and the report checker (whose build hash names the world
# the player saw) must all mean the same file. Absolute, so a relative override
# survives being spawned from elsewhere.
WORLD="${TF_WORLD:-$ROOT/world/vale.json}"
case "$WORLD" in /*|?:*) ;; *) WORLD="$ROOT/$WORLD" ;; esac
[[ -f "$WORLD" ]] || { echo "TF_WORLD not found: $WORLD"; exit 1; }
export TF_WORLD="$WORLD"

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
# The CLI spawns this command without a shell, so npx (a .cmd shim on
# Windows) fails silently; use bare "node" instead, same fix as
# mock-player.mjs/report-check.mjs. $ROOT is an MSYS path under Git Bash
# (e.g. /c/dev/...), which the CLI — a native Windows process — can't
# resolve either, so convert it and double its backslashes for valid JSON.
# The world is passed explicitly in the server's env: an MCP host may start
# servers with a minimal environment, so an exported TF_WORLD alone is not a
# guarantee the server plays the world the checker hashes.
MCP_ENTRY="$ROOT/src/mcp.ts"
MCP_WORLD="$WORLD"
if command -v cygpath >/dev/null; then
  MCP_ENTRY="$(cygpath -w "$MCP_ENTRY")"
  MCP_WORLD="$(cygpath -w "$MCP_WORLD")"
fi
MCP_ENTRY="${MCP_ENTRY//\\/\\\\}"
MCP_WORLD="${MCP_WORLD//\\/\\\\}"
CFG="$WAVE_DIR/mcp.json"
cat > "$CFG" <<EOF
{ "mcpServers": { "tinyforge": { "command": "node", "args": ["--import", "tsx", "$MCP_ENTRY"], "env": { "TF_WORLD": "$MCP_WORLD" } } } }
EOF

run_player() {
  local i="$1" seed=$((SEED_BASE + i))
  local out="$WAVE_DIR/player-$i-seed-$seed.json"
  local prompt
  prompt="$(sed -e "s/{{SEED}}/$seed/" -e "s/{{MAX_GAME_TURNS}}/$MAX_GAME_TURNS/" loop/player-prompt.md)"
  echo "  player $i (seed $seed) playing..."
  claude -p "$prompt" \
    --mcp-config "$CFG" --strict-mcp-config \
    --allowedTools "mcp__tinyforge__new_game,mcp__tinyforge__act,mcp__tinyforge__look,mcp__tinyforge__status" \
    --output-format json --max-turns "$MAX_TURNS" \
    ${TF_PLAYER_MODEL:+--model "$TF_PLAYER_MODEL"} \
    > "$out" 2> "$WAVE_DIR/player-$i.err" < /dev/null || { echo "  player $i: claude exited nonzero"; return 1; }
  node loop/report-check.mjs "$out" --seed "$seed" || echo "  player $i: report rejected"
}

echo "wave: $COUNT player(s), seeds $SEED_BASE+, parallel $PARALLEL, world ${WORLD#"$ROOT/"}"
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
