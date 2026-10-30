import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "playwright";
const require = createRequire(
  new URL("../server/package.json", import.meta.url),
);
const { Keypair, TransactionBuilder } = require("@stellar/stellar-sdk");
const api = process.env.TEST_API_URL;
const client = process.env.TEST_CLIENT_URL;
const output = process.env.TEST_EVIDENCE_DIR;
assert.ok(
  api && client && output,
  "Set TEST_API_URL, TEST_CLIENT_URL, and TEST_EVIDENCE_DIR",
);
for (const url of [api, client])
  assert.equal(
    new URL(url).hostname,
    "127.0.0.1",
    "Use an isolated local test server with zero-fee artist activation",
  );
await mkdir(output, { recursive: true });
async function request(path, token, method = "GET", body) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.ok(response.ok, `${path}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
async function account(name) {
  const wallet = Keypair.random();
  const challenge = await request(
    `/auth/challenge?account=${wallet.publicKey()}`,
  );
  const transaction = TransactionBuilder.fromXDR(
    challenge.transaction,
    challenge.networkPassphrase,
  );
  transaction.sign(wallet);
  const { session } = await request("/auth/verify", undefined, "POST", {
    transaction: transaction.toXDR(),
  });
  await request("/users/me/onboarding", session.token, "PUT", {
    step: "identity",
    displayName: name,
  });
  await request("/users/me/onboarding", session.token, "PUT", {
    step: "intent",
    primaryIntent: "artist",
  });
  const { profile } = await request(
    "/users/me/onboarding/complete",
    session.token,
    "POST",
    { step: "complete" },
  );
  assert.equal(
    profile.artistAccess,
    true,
    "Use a disposable zero-fee local environment",
  );
  await request("/users/me", session.token, "PUT", {
    email: `${name.toLowerCase().replaceAll(" ", "-")}@example.test`,
    notificationPreferences: {
      releaseNotifications: false,
      artistUpdates: false,
      productUpdates: false,
    },
  });
  return { ...session, ...profile, token: session.token };
}
const owner = await account("Notification Creator");
const contributor = await account("Notification Contributor");
const { track } = await request("/tracks", owner.token, "POST", {
  title: "Shared city",
  genre: "House",
});
const input = {
  trackId: track.id,
  submitForApproval: true,
  terms: "Master recording split",
  recipients: [
    { walletAddress: owner.walletAddress, role: "artist", shareBps: 7000 },
    {
      walletAddress: contributor.walletAddress,
      role: "producer",
      shareBps: 3000,
    },
  ],
};
const { version } = await request("/agreements", owner.token, "POST", input);
await request("/agreements", owner.token, "POST", input);
const inbox = await request("/notifications", contributor.token);
assert.equal(inbox.unreadCount, 1);
assert.equal(inbox.items.length, 1);
assert.equal(
  inbox.items[0].href,
  `/account/agreements/${version.proposal.agreementId}`,
);
assert.equal((await request("/notifications", owner.token)).items.length, 0);
const launch = { headless: true, args: ["--no-sandbox"] };
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
  launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch(launch);
try {
  for (const [name, viewport] of [
    ["desktop", { width: 1440, height: 1000 }],
    ["mobile", { width: 390, height: 844 }],
  ]) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(
      (value) =>
        localStorage.setItem("music-city-auth-session", JSON.stringify(value)),
      contributor,
    );
    // The local fallback has no Dynamic client. Keep wallet signing outside this inbox check.
    await context.route(
      "**/node_modules/.vite/deps/@dynamic-labs_sdk-react-core.js*",
      async (route) => {
        const url = new URL(route.request().url());
        if (url.searchParams.has("notification-original"))
          return route.continue();
        url.searchParams.set("notification-original", "true");
        await route.fulfill({
          contentType: "application/javascript",
          body: `export * from ${JSON.stringify(url.toString())};
        export function useDynamicContext() { return { primaryWallet: null, user: null }; }
        export function useUserWallets() { return []; }
        export function useStepUpAuthentication() {
          const unavailable = async () => { throw new Error("Wallet signing is outside the notification browser check"); };
          return { isStepUpRequired: unavailable, promptStepUpAuth: unavailable };
        }`,
        });
      },
    );
    const page = await context.newPage();
    page.on("pageerror", (error) =>
      console.error("Browser error:", error.message),
    );
    await page.goto(`${client}/account`, { waitUntil: "networkidle" });
    const bell = page.getByRole("button", { name: /Notifications/ });
    await bell.waitFor();
    await bell.click();
    const notice = page.getByRole("menuitem", {
      name: /Agreement ready for your approval/,
    });
    await notice.waitFor();
    const box = await page.getByRole("menu").boundingBox();
    assert.ok(
      box && box.x >= 0 && box.x + box.width <= viewport.width + 1,
      `${name} inbox fits the viewport`,
    );
    await page.screenshot({
      path: `${output}/inbox-${name}.png`,
      fullPage: false,
      animations: "disabled",
    });
    await notice.click();
    await page.waitForURL(
      `**/account/agreements/${version.proposal.agreementId}`,
    );
    await page.getByRole("menu").waitFor({ state: "hidden" });
    await page
      .getByRole("heading", { name: "Shared city", exact: true })
      .waitFor();
    await page.screenshot({
      path: `${output}/agreement-${name}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.goto(`${client}/account`, { waitUntil: "networkidle" });
    const email = page.getByRole("textbox", { name: "Email address" });
    await email.fill("notification-settings@example.test");
    await page.getByRole("checkbox", { name: "Music City news" }).check();
    await page.getByRole("button", { name: "Save preferences" }).click();
    await page.getByText("Notification preferences saved.").waitFor();
    const { profile } = await request("/users/me", contributor.token);
    assert.equal(profile.email, "notification-settings@example.test");
    assert.equal(profile.notificationPreferences.productUpdates, true);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      `${name} account has no horizontal overflow`,
    );
    await context.close();
  }
  assert.equal(
    (await request("/notifications", contributor.token)).unreadCount,
    0,
  );
  console.log(
    "Passed: send agreement, idempotent inbox, desktop/mobile links and read state, profile email and preferences.",
  );
} finally {
  await browser.close();
}
