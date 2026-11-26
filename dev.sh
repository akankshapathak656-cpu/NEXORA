#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"

API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-5173}"

CYAN=$'\033[0;36m'
MAGENTA=$'\033[0;35m'
DIM=$'\033[2m'
RESET=$'\033[0m'

prefix_logs() {
  local tag="$1"
  while IFS= read -r line; do
    printf '%s %s\n' "$tag" "$line"
  done
}

# Ensure backend virtualenv & dependencies exist
if [ ! -x "$BACKEND_DIR/.venv/bin/uvicorn" ]; then
  printf '%s Setting up Python virtualenv...\n' "${CYAN}[api]${RESET}"
  if command -v uv >/dev/null 2>&1; then
    (cd "$BACKEND_DIR" && uv venv && uv pip install -r requirements.txt)
  else
    python3 -m venv "$BACKEND_DIR/.venv"
    "$BACKEND_DIR/.venv/bin/pip" install -r "$BACKEND_DIR/requirements.txt"
  fi
fi

# Ensure frontend dependencies exist
if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  printf '%s Installing frontend dependencies...\n' "${MAGENTA}[web]${RESET}"
  (cd "$FRONTEND_DIR" && npm install)
fi

PIDS=()

cleanup() {
  trap - INT TERM EXIT
  printf '\n%sShutting down NEXORA dev servers...%s\n' "$DIM" "$RESET"
  for pid in "${PIDS[@]:-}"; do
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  wait 2>/dev/null || true
}

trap cleanup INT TERM EXIT

printf '%s Starting FastAPI on http://%s:%s (docs: /docs)\n' "${CYAN}[api]${RESET}" "$API_HOST" "$API_PORT"
(
  cd "$BACKEND_DIR"
  exec "$BACKEND_DIR/.venv/bin/uvicorn" app.main:app \
    --host "$API_HOST" \
    --port "$API_PORT" \
    --reload
) > >(prefix_logs "${CYAN}[api]${RESET}") 2>&1 &
PIDS+=($!)

printf '%s Starting Vite on http://localhost:%s\n' "${MAGENTA}[web]${RESET}" "$WEB_PORT"
(
  cd "$FRONTEND_DIR"
  exec npm run dev -- --port "$WEB_PORT"
) > >(prefix_logs "${MAGENTA}[web]${RESET}") 2>&1 &
PIDS+=($!)

wait
