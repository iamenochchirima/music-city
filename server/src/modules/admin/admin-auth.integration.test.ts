import assert from "node:assert/strict";
import test from "node:test";

const testUrl = process.env.REFERRALS_TEST_DATABASE_URL;

test("admin bootstrap is authorized and race-safe; login attempts are database-limited", { skip: !testUrl }, async () => {
  const url = new URL(testUrl!);
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname.endsWith("_test"), "Use an isolated local database ending in _test");
  process.env.DATABASE_URL = testUrl;
  process.env.NODE_ENV = "test";

  const { databaseService } = await import("../../services/database.service.js");
  const { adminService } = await import("./admin.service.js");
  const bootstrap = {
    bootstrapToken: "music-city-local-bootstrap-token",
    name: "First Admin",
    email: "first-admin@example.test",
    password: "long-test-password-1",
  };

  await databaseService.initialize({ repair: false });
  await assert.rejects(
    adminService.bootstrap({ ...bootstrap, bootstrapToken: "wrong-token" }),
    (error: unknown) => error instanceof Error && "statusCode" in error && error.statusCode === 403,
  );

  const racing = await Promise.allSettled([
    adminService.bootstrap(bootstrap),
    adminService.bootstrap(bootstrap),
  ]);
  assert.equal(racing.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(racing.filter((result) => result.status === "rejected").length, 1);
  const count = await databaseService.countAdmins();
  assert.equal(count, 1);

  const wrongPassword = await adminService.login(
    { email: bootstrap.email, password: "wrong-password" },
    "192.0.2.10",
  ).catch((error: Error) => error);
  const unknownEmail = await adminService.login(
    { email: "missing@example.test", password: "wrong-password" },
    "192.0.2.11",
  ).catch((error: Error) => error);
  assert.equal((wrongPassword as { statusCode?: number }).statusCode, 401);
  assert.equal((unknownEmail as { statusCode?: number }).statusCode, 401);
  assert.equal((wrongPassword as Error).message, (unknownEmail as Error).message);

  await adminService.createAdmin({
    name: "Second Admin",
    email: "second-admin@example.test",
    password: "another-test-password-2",
    role: "admin",
  });
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await assert.rejects(
      adminService.login({ email: "unknown-login@example.test", password: "incorrect-password" }, "192.0.2.50"),
      (error: unknown) => error instanceof Error && "statusCode" in error && error.statusCode === 401,
    );
  }
  await assert.rejects(
    adminService.login({ email: "unknown-login@example.test", password: "incorrect-password" }, "192.0.2.50"),
    (error: unknown) => error instanceof Error && "statusCode" in error && error.statusCode === 429,
  );
  const otherAdmin = await adminService.login(
    { email: "second-admin@example.test", password: "another-test-password-2" },
    "192.0.2.51",
  );
  assert.equal(otherAdmin.admin.email, "second-admin@example.test");
});
