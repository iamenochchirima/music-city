#!/usr/bin/env bash

# Launch the Music City local development stack in separate GNOME Terminal tabs.
# Default local URLs:
#   Client: http://localhost:4317
#   Admin:  http://localhost:4318
#   Server: http://localhost:4319 (can be changed with PORT in .env)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Required command not found: $1" >&2
    exit 1
  fi
}

require_command pnpm
require_command gnome-terminal

echo 'Building shared workspace package...'
pnpm --filter @music-city/shared build

declare -A services=(
  [server]='pnpm dev:server'
  [client]='pnpm dev:client'
  [admin]='pnpm dev:admin'
)

make_launcher() {
  local name="$1"
  local command="$2"
  local launcher="${TMPDIR:-/tmp}/music-city-${name}.sh"
  local quoted_root

  printf -v quoted_root '%q' "$ROOT_DIR"

  {
    printf '%s\n' '#!/usr/bin/env bash' 'set -euo pipefail'
    printf 'cd %s\n' "$quoted_root"
    printf '%s\n' "$command" ''
    printf "echo '[Music City %s] process exited. Press Enter to close.'\n" "$name"
    printf '%s\n' 'read -r _ || true'
  } > "$launcher"

  chmod +x "$launcher"
  printf '%s\n' "$launcher"
}

add_service() {
  local name="$1"
  local launcher

  if [[ -z "${services[$name]:-}" ]]; then
    echo "Unknown service: $name" >&2
    echo "Available services: admin client server" >&2
    exit 1
  fi

  launcher="$(make_launcher "$name" "${services[$name]}")"
  gnome-terminal --tab --title="Music City ${name}" -- bash "$launcher"
}

show_usage() {
  cat <<'USAGE'
Usage: ./scripts/run_local_stack.sh [server|client|admin ...]

With no arguments, launches all Music City services in separate terminal tabs:
  Client  http://localhost:4317
  Admin   http://localhost:4318
  Server  http://localhost:4319 (PORT in .env can override this)

Examples:
  ./scripts/run_local_stack.sh
  ./scripts/run_local_stack.sh server
  ./scripts/run_local_stack.sh server client
  ./scripts/run_local_stack.sh admin
USAGE
}

if [[ $# -eq 0 ]]; then
  for service in server client admin; do
    add_service "$service"
  done
elif [[ "$1" == '-h' || "$1" == '--help' ]]; then
  show_usage
  exit 0
else
  for service in "$@"; do
    add_service "$service"
  done
fi

echo 'Launching Music City local stack...'
echo '  Client: http://localhost:4317'
echo '  Admin:  http://localhost:4318'
echo '  Server: http://localhost:4319 (unless PORT is overridden)'
