import assert from "node:assert/strict";
import test from "node:test";
import { emailAllowed, notificationCatalog } from "./notification-catalog.js";
test("email categories require explicit opt-in except transactional events", () => {
  for (const kind of Object.keys(
    notificationCatalog,
  ) as (keyof typeof notificationCatalog)[]) {
    assert.equal(
      emailAllowed(kind),
      notificationCatalog[kind].category === "transactional",
    );
  }
  assert.equal(emailAllowed("product.update", { productUpdates: true }), true);
  assert.equal(
    emailAllowed("artist.update", { releaseNotifications: true }),
    false,
  );
});
