#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
task_root="$(mktemp -d /tmp/music-city-track-credits.XXXXXX)"
container_name="music-city-track-credits-$BASHPID"
server_pid=""
client_pid=""
worker_pid=""
cleanup() {
  for pid in "$server_pid" "$client_pid" "$worker_pid"; do if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; fi; done
  for pid in "$server_pid" "$client_pid" "$worker_pid"; do if [[ -n "$pid" ]]; then wait "$pid" 2>/dev/null || true; fi; done
  docker rm -f "$container_name" >/dev/null 2>&1 || true
  rm -rf "$task_root"
}
trap cleanup EXIT
cd "$repo"
pnpm --filter @music-city/shared build
umask 077
openssl rand -hex 24 | sed 's/^/POSTGRES_PASSWORD=/' > "$task_root/database.env"
docker run --rm -d --name "$container_name" --env-file "$task_root/database.env" -e POSTGRES_DB=track_credits_test -p 127.0.0.1::5432 --tmpfs /var/lib/postgresql/18/docker:rw,nosuid,size=512m postgres:18 >/dev/null
read -r database_port < <(docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' "$container_name")
set -a
. "$task_root/database.env"
set +a
database_url="postgres://postgres:$POSTGRES_PASSWORD@127.0.0.1:$database_port/track_credits_test"
unset POSTGRES_PASSWORD
for _ in $(seq 1 80); do
  if docker exec "$container_name" pg_isready -U postgres -d track_credits_test >/dev/null 2>&1; then break; fi
  sleep 0.25
done
TRACK_METADATA_TEST_DATABASE_URL="$database_url" NODE_ENV=test pnpm --filter server exec tsx --test src/modules/tracks/track-metadata.integration.test.ts
MEDIA_WORKER_TEST_DATABASE_URL="$database_url" NODE_ENV=test pnpm --filter server exec tsx --test src/modules/publication/publication.integration.test.ts
AGREEMENTS_TEST_DATABASE_URL="$database_url" NODE_ENV=test pnpm --filter server exec tsx --test --test-concurrency=1 src/modules/agreements/agreements.integration.test.ts src/modules/agreements/finalization.integration.test.ts
SETTLEMENTS_TEST_DATABASE_URL="$database_url" NODE_ENV=test pnpm --filter server exec tsx --test src/modules/settlements/settlement.integration.test.ts
if [[ "${1:-}" != "--browser" && "${1:-}" != "--studio" && "${1:-}" != "--audit" && "${1:-}" != "--release" ]]; then exit 0; fi

python3 - <<'PY' > "$task_root/ports"
import socket
sockets = [socket.socket(), socket.socket()]
for sock in sockets:
    sock.bind(('127.0.0.1', 0))
print(*(sock.getsockname()[1] for sock in sockets))
for sock in sockets: sock.close()
PY
read -r api_port client_port < "$task_root/ports"
node --input-type=module > "$task_root/signing-key" <<'NODE'
import { createRequire } from 'node:module';
const require = createRequire(`${process.cwd()}/server/package.json`);
console.log(require('@stellar/stellar-sdk').Keypair.random().secret());
NODE
read -r signing_key < "$task_root/signing-key"
mkdir -p "$task_root/runtime/server"
(cd "$task_root/runtime/server" && env NODE_ENV=test DATABASE_URL="$database_url" PORT="$api_port" CLIENT_ORIGIN="http://127.0.0.1:$client_port" ADMIN_CLIENT_ORIGIN="http://127.0.0.1:$client_port" APP_BASE_URL="http://127.0.0.1:$api_port" STELLAR_SEP10_SECRET="$signing_key" STORAGE_PROVIDER=local MEDIA_PROVIDER=local REFERRALS_ENABLED=true ARTIST_ONBOARDING_FEE_PRICE=0 "$repo/server/node_modules/.bin/tsx" "$repo/server/src/main.ts" > "$task_root/server.log" 2>&1) &
server_pid=$!
(cd "$task_root/runtime/server" && env NODE_ENV=test DATABASE_URL="$database_url" CLIENT_ORIGIN="http://127.0.0.1:$client_port" ADMIN_CLIENT_ORIGIN="http://127.0.0.1:$client_port" APP_BASE_URL="http://127.0.0.1:$api_port" STELLAR_SEP10_SECRET="$signing_key" STORAGE_PROVIDER=local MEDIA_PROVIDER=local ARTIST_ONBOARDING_FEE_PRICE=0 "$repo/server/node_modules/.bin/tsx" "$repo/server/src/worker.ts" > "$task_root/worker.log" 2>&1) &
worker_pid=$!

(cd "$repo/client" && env VITE_API_BASE_URL="http://127.0.0.1:$api_port/api/v1" VITE_APP_BASE_URL="http://127.0.0.1:$client_port" VITE_DYNAMIC_ENVIRONMENT_ID=dynamic-environment-id-required ./node_modules/.bin/vite --host 127.0.0.1 --port "$client_port" --strictPort > "$task_root/client.log" 2>&1) &
client_pid=$!
ready=false
for _ in $(seq 1 120); do
  if curl -fsS "http://127.0.0.1:$api_port/api/v1/health/ready" >/dev/null 2>&1 && curl -fsS "http://127.0.0.1:$client_port" >/dev/null 2>&1; then ready=true; break; fi
  sleep 0.25
done
if [[ "$ready" != true ]]; then cat "$task_root/server.log" "$task_root/client.log"; exit 1; fi
if [[ -z "${PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH:-}" ]] && command -v google-chrome >/dev/null; then export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH="$(command -v google-chrome)"; fi
verification_script="$repo/scripts/track-credits-browser.mjs"
evidence_dir="${TRACK_CREDITS_EVIDENCE_DIR:-$repo/docs/track-credits-evidence}"
if [[ "${1:-}" == "--studio" ]]; then
  verification_script="$repo/scripts/studio-ui-browser.mjs"
  evidence_dir="${STUDIO_UI_EVIDENCE_DIR:-$repo/docs/studio-ui-evidence}"
fi
if [[ "${1:-}" == "--audit" ]]; then
  verification_script="$repo/scripts/studio-ui-audit-browser.mjs"
  evidence_dir="${STUDIO_UI_EVIDENCE_DIR:-$repo/docs/studio-ui-evidence}"
fi
if [[ "${1:-}" == "--release" ]]; then
  verification_script="$repo/scripts/release-flow-browser.mjs"
  evidence_dir="$repo/docs/music-creation-ux-evidence"
fi
TEST_DATABASE_URL="$database_url" TEST_API_URL="http://127.0.0.1:$api_port/api/v1" TEST_CLIENT_URL="http://127.0.0.1:$client_port" TEST_EVIDENCE_DIR="$evidence_dir" node "$verification_script"
