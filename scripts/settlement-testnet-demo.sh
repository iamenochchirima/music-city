#!/usr/bin/env bash
set -euo pipefail
repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
run_name="${SETTLEMENT_DEMO_RUN_NAME:-final}"
if [[ ! "$run_name" =~ ^[a-z0-9-]+$ ]]; then echo "Use a lowercase demonstration run name" >&2; exit 1; fi
state_root="${XDG_STATE_HOME:-$HOME/.local/state}/music-city/settlement-demo-$run_name"
mkdir -p "$state_root"
chmod 700 "$state_root"
umask 077
if [[ ! -f "$state_root/database.env" ]]; then openssl rand -hex 24 | sed 's/^/POSTGRES_PASSWORD=/' > "$state_root/database.env"; fi
container_name="music-city-settlement-demo-$run_name"
if ! docker container inspect "$container_name" >/dev/null 2>&1; then
  docker run -d --name "$container_name" --env-file "$state_root/database.env" -e POSTGRES_DB=settlement_demo_test -p 127.0.0.1::5432 -v "music-city-settlement-demo-$run_name:/var/lib/postgresql" postgres:18 >/dev/null
else
  docker start "$container_name" >/dev/null
fi
read -r database_port < <(docker inspect --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}' "$container_name")
set -a
. "$state_root/database.env"
set +a
export SETTLEMENTS_TEST_DATABASE_URL="postgres://postgres:$POSTGRES_PASSWORD@127.0.0.1:$database_port/settlement_demo_test"
unset POSTGRES_PASSWORD
export SETTLEMENTS_DEMO_STATE_PATH="$state_root/private-state.json"
for _ in $(seq 1 80); do
  if docker exec "$container_name" pg_isready -U postgres -d settlement_demo_test >/dev/null 2>&1; then break; fi
  sleep 0.25
done
cd "$repo"
pnpm --filter @music-city/shared build
cargo build --manifest-path contracts/Cargo.toml --target wasm32v1-none --release
pnpm --filter server settlements:demo:testnet
