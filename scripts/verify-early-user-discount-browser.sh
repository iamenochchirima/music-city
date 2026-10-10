#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo"
evidence_dir="${EARLY_USER_EVIDENCE_DIR:-$repo/docs/early-user-discount-evidence}"
task_root="$(mktemp -d "${TMPDIR:-/tmp}/music-city-early-user-e2e.XXXXXX")"
pg_bin="$(pg_config --bindir)"
db_user="$(id -un)"
server_pid=""
client_pid=""
admin_pid=""

mapfile -t automatic_ports < <(python3 - <<'PY'
import socket
sockets = []
try:
    for _ in range(4):
        sock = socket.socket()
        sock.bind(('127.0.0.1', 0))
        sockets.append(sock)
    for sock in sockets:
        print(sock.getsockname()[1])
finally:
    for sock in sockets:
        sock.close()
PY
)
api_port="${EARLY_USER_TEST_API_PORT:-${automatic_ports[0]}}"
client_port="${EARLY_USER_TEST_CLIENT_PORT:-${automatic_ports[1]}}"
admin_port="${EARLY_USER_TEST_ADMIN_PORT:-${automatic_ports[2]}}"
db_port="${automatic_ports[3]}"

cleanup() {
  for pid in "$server_pid" "$client_pid" "$admin_pid"; do
    if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; fi
  done
  for pid in "$server_pid" "$client_pid" "$admin_pid"; do
    if [[ -n "$pid" ]]; then wait "$pid" 2>/dev/null || true; fi
  done
  "$pg_bin/pg_ctl" -D "$task_root/data" -m fast stop >/dev/null 2>&1 || true
  rm -rf -- "$task_root"
}
trap cleanup EXIT

node --input-type=module >"$task_root/sep10.secret" <<'NODE'
import { createRequire } from 'node:module';
const require = createRequire(`${process.cwd()}/server/package.json`);
console.log(require('@stellar/stellar-sdk').Keypair.random().secret());
NODE
read -r test_sep10_secret < "$task_root/sep10.secret"

"$pg_bin/initdb" -D "$task_root/data" --auth=trust --no-locale >"$task_root/init.log"
"$pg_bin/pg_ctl" -D "$task_root/data" -l "$task_root/postgres.log" -o "-h 127.0.0.1 -p $db_port -k $task_root" start >/dev/null
"$pg_bin/createdb" -h 127.0.0.1 -p "$db_port" music_city_early_user_test
database_url="postgres://$db_user@127.0.0.1:$db_port/music_city_early_user_test"

mkdir -p "$evidence_dir"
(cd "$repo/server" && env NODE_ENV=test DATABASE_URL="$database_url" PORT="$api_port" CLIENT_ORIGIN="http://127.0.0.1:$client_port" ADMIN_CLIENT_ORIGIN="http://127.0.0.1:$admin_port" APP_BASE_URL="http://127.0.0.1:$api_port" JWT_SECRET="early-user-browser-test-jwt" ADMIN_JWT_SECRET="early-user-browser-admin-jwt" PLAYBACK_TOKEN_SECRET="early-user-browser-playback" STELLAR_SEP10_SECRET="$test_sep10_secret" STELLAR_HOME_DOMAIN=localhost REFERRALS_ENABLED=true ARTIST_ONBOARDING_FEE_PRICE=0 ./node_modules/.bin/tsx src/main.ts >"$task_root/server.log" 2>&1) &
server_pid=$!
(cd "$repo/client" && env VITE_API_BASE_URL="http://127.0.0.1:$api_port/api/v1" VITE_APP_BASE_URL="http://127.0.0.1:$client_port" ./node_modules/.bin/vite --host 127.0.0.1 --port "$client_port" --strictPort >"$task_root/client.log" 2>&1) &
client_pid=$!
(cd "$repo/admin" && env VITE_ADMIN_API_BASE_URL="http://127.0.0.1:$api_port/api/v1/admin" VITE_ADMIN_APP_BASE_URL="http://127.0.0.1:$admin_port" ./node_modules/.bin/vite --host 127.0.0.1 --port "$admin_port" --strictPort >"$task_root/admin.log" 2>&1) &
admin_pid=$!

ready=false
for _ in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:$api_port/api/v1/health" >/dev/null 2>&1 \
    && curl -fsS "http://127.0.0.1:$client_port" >/dev/null 2>&1 \
    && curl -fsS "http://127.0.0.1:$admin_port" >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 0.25
done
if [[ "$ready" != true ]]; then
  echo "The isolated app stack did not become ready. Temporary logs: $task_root"
  exit 1
fi

TEST_API_URL="http://127.0.0.1:$api_port/api/v1" \
TEST_CLIENT_URL="http://127.0.0.1:$client_port" \
TEST_ADMIN_URL="http://127.0.0.1:$admin_port" \
TEST_EVIDENCE_DIR="$evidence_dir" \
node "$repo/scripts/early-user-discount-browser.mjs"
