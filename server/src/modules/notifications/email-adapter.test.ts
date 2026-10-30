import assert from "node:assert/strict";
import test from "node:test";
import { env } from "../../config/env.js";
import {
  deliverEmail,
  emailConfigurationError,
  renderEmail,
} from "./email-adapter.js";
test("email templates escape HTML and include a useful absolute deep link", () => {
  const email = renderEmail(
    {
      title: '<script>"test"</script>',
      body: "A & B",
      href: "/account/agreements/demo",
    },
    "https://music.example.test",
  );
  assert.match(
    email.text,
    /https:\/\/music.example.test\/account\/agreements\/demo/,
  );
  assert.ok(!email.html.includes("<script>"));
  assert.match(email.html, /A &amp; B/);
  assert.match(email.text, /transactional notification/);
  assert.match(
    renderEmail({
      title: "News",
      body: "News",
      href: "/account",
      category: "productUpdates",
    }).text,
    /opted in/,
  );
});
test("Resend adapter submits plain text and HTML with a stable provider idempotency key", async () => {
  const previous = {
    provider: env.NOTIFICATION_EMAIL_PROVIDER,
    key: env.RESEND_API_KEY,
    from: env.NOTIFICATION_EMAIL_FROM,
    node: env.NODE_ENV,
  };
  const originalFetch = globalThis.fetch;
  try {
    env.NOTIFICATION_EMAIL_PROVIDER = "sink";
    env.NODE_ENV = "production";
    assert.match(emailConfigurationError()!, /not allowed/);
    env.NODE_ENV = "test";
    env.NOTIFICATION_EMAIL_PROVIDER = "resend";
    env.RESEND_API_KEY = "fake-key";
    env.NOTIFICATION_EMAIL_FROM = "Music City <updates@example.test>";
    let calls = 0;
    globalThis.fetch = async (url, options) => {
      calls++;
      assert.equal(url, "https://api.resend.com/emails");
      assert.equal(
        (options!.headers as Record<string, string>)["Idempotency-Key"],
        "delivery-key",
      );
      const body = JSON.parse(options!.body as string);
      assert.deepEqual(body.to, ["recipient@example.test"]);
      assert.ok(body.html && body.text);
      return new Response(JSON.stringify({ id: "provider-id" }), {
        status: 200,
      });
    };
    const delivery = {
      id: "delivery-key",
      email: "recipient@example.test",
      message: {
        title: "Agreement proposed",
        body: "Review splits",
        href: "/account/agreements/demo",
      },
    };
    assert.equal(await deliverEmail(delivery), "provider-id");
    assert.equal(calls, 1);
    globalThis.fetch = async () =>
      new Response("provider failure", { status: 429 });
    await assert.rejects(deliverEmail(delivery), /HTTP 429/);
  } finally {
    globalThis.fetch = originalFetch;
    env.NOTIFICATION_EMAIL_PROVIDER = previous.provider;
    env.RESEND_API_KEY = previous.key;
    env.NOTIFICATION_EMAIL_FROM = previous.from;
    env.NODE_ENV = previous.node;
  }
});
