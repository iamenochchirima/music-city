import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { assertDatabaseTargetAllowed } from "./database-safety.js";

test("allows loopback PostgreSQL for development and test processes", () => {
  for (const environment of ["development", "test"] as const) {
    assert.doesNotThrow(() =>
      assertDatabaseTargetAllowed(
        "postgres://music-city:secret@127.0.0.1:5432/music_city_test",
        environment,
      ),
    );
  }
});

test("rejects hosted databases and PostgreSQL host overrides outside production", () => {
  assert.throws(
    () => assertDatabaseTargetAllowed("postgres://app:secret@db.example/music_city_test", "development"),
    /unsafe DATABASE_URL/,
  );
  assert.throws(
    () => assertDatabaseTargetAllowed("postgres://app:secret@localhost/music_city_test?host=db.example", "test"),
    /unsafe DATABASE_URL/,
  );
  assert.throws(
    () => assertDatabaseTargetAllowed("postgres://app:secret@localhost/music_city", "development"),
    /unsafe DATABASE_URL/,
  );
});

test("allows a production database and blocks API initialization before remote I/O in test mode", () => {
  assert.doesNotThrow(() =>
    assertDatabaseTargetAllowed("postgres://app:secret@db.example/music_city", "production"),
  );

  const databaseServiceUrl = pathToFileURL(
    fileURLToPath(new URL("../services/database.service.ts", import.meta.url)),
  ).href;
  const childScript = `
    const { databaseService } = await import(${JSON.stringify(databaseServiceUrl)});
    await databaseService.initialize();
  `;
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", childScript],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "test",
        DATABASE_URL: "postgres://app:secret@db.example/music_city_test",
      },
    },
  );

  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /Refusing database startup outside production/);
});
