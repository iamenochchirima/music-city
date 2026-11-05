import assert from "node:assert/strict";
import test from "node:test";
import { createCashOutEnvelopeCipher } from "./cashout-envelope.js";

test("signed envelopes are encrypted and bound to the order, attempt and hash", () => {
  assert.throws(() => createCashOutEnvelopeCipher(Buffer.alloc(31)));
  const cipher = createCashOutEnvelopeCipher(Buffer.alloc(32, 7));
  const encrypted = cipher.encrypt("order", "attempt", "hash", "signed-envelope");
  assert.equal(encrypted.includes(Buffer.from("signed-envelope")), false);
  assert.equal(cipher.decrypt("order", "attempt", "hash", encrypted), "signed-envelope");
  assert.throws(() => cipher.decrypt("other", "attempt", "hash", encrypted));
  assert.throws(() => cipher.decrypt("order", "other", "hash", encrypted));
  assert.throws(() => cipher.decrypt("order", "attempt", "other", encrypted));
  const altered = Buffer.from(encrypted); altered[altered.length - 1] ^= 1;
  assert.throws(() => cipher.decrypt("order", "attempt", "hash", altered));
  assert.throws(() => createCashOutEnvelopeCipher(Buffer.alloc(32, 8)).decrypt("order", "attempt", "hash", encrypted));
});
