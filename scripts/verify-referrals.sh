#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Use an explicitly supplied isolated test database, or create a temporary one.
# Never read the application's DATABASE_URL for integration tests.
task_db_root=""
cleanup() {
  if [[ -n "$task_db_root" ]]; then
    "$task_pg_bin/pg_ctl" -D "$task_db_root/data" -m fast stop >/dev/null || true
    rm -rf -- "$task_db_root"
  fi
}
trap cleanup EXIT

if [[ -z "${REFERRALS_TEST_DATABASE_URL:-}" ]]; then
  task_pg_bin="$(pg_config --bindir)"
  [[ -x "$task_pg_bin/initdb" ]] || { echo 'Set REFERRALS_TEST_DATABASE_URL to an isolated local database ending in _test.' >&2; exit 1; }
  task_db_root="$(mktemp -d "${TMPDIR:-/tmp}/music-city-referral-check.XXXXXX")"
  task_db_port="$(python3 - <<'PY'
import socket
with socket.socket() as sock:
    sock.bind(('127.0.0.1',0))
    print(sock.getsockname()[1])
PY
)"
  "$task_pg_bin/initdb" -D "$task_db_root/data" --auth=trust --no-locale > "$task_db_root/init.log"
  "$task_pg_bin/pg_ctl" -D "$task_db_root/data" -l "$task_db_root/server.log" -o "-h 127.0.0.1 -p $task_db_port -k $task_db_root" start >/dev/null
  "$task_pg_bin/createdb" -h 127.0.0.1 -p "$task_db_port" music_city_referrals_test
  export REFERRALS_TEST_DATABASE_URL="postgres://$(id -un)@127.0.0.1:$task_db_port/music_city_referrals_test"
fi

pnpm --filter @music-city/shared build
pnpm --filter server exec tsx --test --test-concurrency=1 \
  src/modules/referrals/referrals.service.test.ts \
  src/modules/referrals/referrals.integration.test.ts \
  src/modules/sponsorships/sponsorships.integration.test.ts \
  src/modules/users/users.service.test.ts \
  src/modules/payments/payments.service.test.ts \
  src/modules/releases/releases.service.test.ts
pnpm --filter client exec vitest run src/features/referrals/referral-registration.test.tsx src/features/onboarding/early-user-discount.test.tsx
pnpm --filter admin test
pnpm -r typecheck
