import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const require = createRequire(
  new URL("../server/package.json", import.meta.url),
);
const { Keypair, TransactionBuilder } = require("@stellar/stellar-sdk");
const api = process.env.TEST_API_URL,
  client = process.env.TEST_CLIENT_URL,
  output = process.env.TEST_EVIDENCE_DIR;
if (!api || !client || !output)
  throw new Error("Set local test URLs and evidence directory");
for (const url of [api, client])
  assert.equal(new URL(url).hostname, "127.0.0.1");
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
async function signIn() {
  const wallet = Keypair.random();
  const challenge = await request(
    `/auth/challenge?account=${wallet.publicKey()}`,
  );
  const transaction = TransactionBuilder.fromXDR(
    challenge.transaction,
    challenge.networkPassphrase,
  );
  transaction.sign(wallet);
  return (
    await request("/auth/verify", undefined, "POST", {
      transaction: transaction.toXDR(),
    })
  ).session;
}
const launch = { headless: true, args: ["--no-sandbox"] };
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
  launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch(launch);
const captures = [],
  errors = [],
  checks = [];
let currentPage;
async function capture(page, name) {
  await page.screenshot({
    path: `${output}/${name}.png`,
    fullPage: (await page.locator("dialog[open]").count()) === 0,
  });
  captures.push({
    file: `${name}.png`,
    route: new URL(page.url()).pathname,
    viewport: page.viewportSize(),
    state: name.replaceAll("-", " "),
    result: "passed",
  });
}
async function overflow(page, label) {
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${label} overflows`,
  );
}
async function registration(intent, mode, invitation) {
  const session = await signIn();
  const context = await browser.newContext({
    viewport: {
      width: mode === "modal" ? 390 : 1360,
      height: mode === "modal" ? 844 : 1000,
    },
  });
  await context.addInitScript(
    (value) =>
      localStorage.setItem("music-city-auth-session", JSON.stringify(value)),
    session,
  );
  const page = await context.newPage();
  currentPage = page;
  page.setDefaultTimeout(20000);
  page.on("pageerror", (error) => errors.push(error.message));
  const calls = [];
  page.on("request", (request) => {
    if (
      request.url().includes("/wallet/me") ||
      request.url().includes("/payments/intents/artist-onboarding-fee")
    )
      calls.push(request.url());
  });
  if (invitation) {
    await page.goto(
      `${client}/join?ref=${encodeURIComponent(invitation.code)}`,
    );
    await page.getByText(/Your invitation is saved for registration/).waitFor();
  }
  if (intent === "listener" && mode === "page") {
    let failed = false;
    await page.route(`${api}/users/me/onboarding`, (route) => {
      if (!failed && route.request().method() === "GET") {
        failed = true;
        return route.abort("failed");
      }
      return route.continue();
    });
  }
  await page.goto(`${client}${mode === "modal" ? "/discover" : "/onboarding"}`);
  if (intent === "listener" && mode === "page") {
    await page.getByRole("button", { name: "Retry profile load" }).waitFor();
    await capture(page, "onboarding-profile-load-error");
    await page.getByRole("button", { name: "Retry profile load" }).click();
  }
  await page.getByLabel("Display name", { exact: true }).waitFor();
  await page.getByLabel("Display name", { exact: true }).fill("");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByText("Enter a display name to continue.", { exact: true })
    .waitFor();
  await page.waitForFunction(
    () => document.activeElement?.id === "displayName",
  );
  if (intent === "listener" && mode === "page")
    await capture(page, "onboarding-identity-error");
  const name = `Community ${intent} ${mode} artist with a longer name from Zimbabwe`;
  await page.getByLabel("Display name", { exact: true }).fill(name);
  await page.getByLabel("Country", { exact: true }).click();
  await page.getByLabel("Search countries", { exact: true }).fill("Zimbabwe");
  await page.getByRole("option", { name: "Zimbabwe", exact: true }).click();
  if (invitation) await page.getByText(/Invited by .*registration/).waitFor();
  await capture(page, `onboarding-${intent}-${mode}-identity`);
  if (mode === "page") {
    await page.setViewportSize({ width: 390, height: 844 });
    await overflow(page, `${intent} page identity on mobile`);
    await capture(page, `onboarding-${intent}-page-identity-mobile`);
    await page.setViewportSize({ width: 1360, height: 1000 });
  }
  if (mode === "modal") {
    const modal = page.getByRole("dialog", {
      name: "Music City onboarding",
      exact: true,
    });
    await modal.getByRole("button", { name: "Sign out", exact: true }).focus();
    await page.keyboard.press("Tab");
    assert.equal(
      await page
        .getByLabel("Display name", { exact: true })
        .evaluate((el) => el === document.activeElement),
      true,
      "Onboarding must contain keyboard focus",
    );
    await page.keyboard.press("Escape");
    assert.equal(
      await modal.isVisible(),
      true,
      "Required onboarding must remain open on Escape",
    );
  }
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("heading", { name: "How will you use Music City?", exact: true })
    .waitFor();
  await page
    .getByRole("radio")
    .nth(intent === "listener" ? 0 : intent === "artist" ? 1 : 2)
    .check();
  await capture(page, `onboarding-${intent}-${mode}-intent`);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  if (intent !== "listener") {
    await page
      .getByRole("heading", {
        name: "Your early-user discount is applied",
        exact: true,
      })
      .waitFor();
    const quote = await page
      .getByRole("region", { name: "Artist activation", exact: true })
      .innerText();
    assert.ok(quote.includes("EARLYUSER") && quote.includes("$0.00"));
    await capture(page, `onboarding-${intent}-${mode}-activation`);
    await page
      .getByRole("button", {
        name:
          intent === "artist"
            ? "Continue to artist profile"
            : "Continue to listening setup",
        exact: true,
      })
      .click();
  }
  if (intent !== "artist") {
    await page
      .getByRole("heading", { name: "Help us find your sound.", exact: true })
      .waitFor();
    for (const genre of intent === "both"
      ? ["Afrobeats", "Alternative", "Hip-hop", "House", "Indie"]
      : ["Afrobeats"])
      await page.getByRole("button", { name: genre, exact: true }).click();
    if (intent === "both")
      assert.equal(
        await page
          .getByRole("button", { name: "Jazz", exact: true })
          .isDisabled(),
        true,
      );
    await page
      .getByLabel("Show me more artists and releases from my area.")
      .check();
    await capture(page, `onboarding-${intent}-${mode}-preferences`);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
  if (intent !== "listener") {
    await page
      .getByLabel("Short biography", { exact: true })
      .fill(
        "An artist from the local community. This biography must survive reload and completion.",
      );
    await page
      .getByLabel("Website", { exact: true })
      .fill("https://example.com/community");
    await capture(page, `onboarding-${intent}-${mode}-artist-profile`);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
  }
  await page.getByLabel("Profile image", { exact: true }).waitFor();
  await page.reload();
  await page.getByLabel("Profile image", { exact: true }).waitFor();
  if (intent === "both" && mode === "page") {
    const image = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 32;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#159d68";
      ctx.fillRect(0, 0, 32, 32);
      return canvas.toDataURL("image/png").split(",")[1];
    });
    await page
      .getByLabel("Profile image", { exact: true })
      .setInputFiles({
        name: "community.png",
        mimeType: "image/png",
        buffer: Buffer.from(image, "base64"),
      });
    await page.getByAltText("Profile preview").waitFor();
    await page
      .getByLabel("Header image", { exact: true })
      .setInputFiles({
        name: "community-header.png",
        mimeType: "image/png",
        buffer: Buffer.from(image, "base64"),
      });
    await page.getByAltText("Header preview").waitFor();
  }
  await capture(page, `onboarding-${intent}-${mode}-visuals`);
  await overflow(page, `${intent} ${mode}`);
  if (mode === "modal") {
    await page.setViewportSize({ width: 390, height: 360 });
    await page
      .getByRole("button", { name: "Finish setup", exact: true })
      .focus();
    await page.waitForFunction(() => {
      const el = document.activeElement;
      const rect = el?.getBoundingClientRect();
      return rect && rect.top >= 0 && rect.bottom <= innerHeight;
    });
    await capture(page, `onboarding-${intent}-reduced-height`);
    await page.setViewportSize({ width: 390, height: 844 });
  }
  await page
    .getByRole("button", {
      name:
        intent === "both" && mode === "page" ? "Finish setup" : "Skip for now",
      exact: true,
    })
    .click();
  await page
    .getByText(
      intent === "listener"
        ? "Your listening space is ready."
        : "Your artist workspace is ready.",
      { exact: true },
    )
    .waitFor();
  await capture(page, `onboarding-${intent}-${mode}-ready`);
  assert.equal(
    calls.length,
    0,
    "Sponsored or listener onboarding must not request payment or balances",
  );
  const { profile } = await request("/users/me", session.token);
  assert.equal(profile.primaryIntent, intent);
  assert.equal(profile.location, "Zimbabwe");
  assert.equal(profile.onboardingStatus, "complete");
  if (intent !== "artist")
    assert.ok(
      profile.genres.includes("Afrobeats") && profile.interestedInLocalMusic,
    );
  if (intent !== "listener")
    assert.ok(
      profile.bio.includes("must survive reload") &&
        profile.socialLinks.website === "https://example.com/community" &&
        profile.artistAccess,
    );
  if (intent === "both" && mode === "page")
    assert.ok(
      profile.profileImageStorageKey && profile.headerImageStorageKey,
      "Prepared media must persist",
    );
  await page
    .getByRole("button", {
      name: intent === "artist" ? "Create your first release" : "Explore music",
      exact: true,
    })
    .click();
  await page.waitForURL(
    `${client}${intent === "artist" ? "/dashboard/create" : "/discover"}`,
  );
  if (mode === "modal") {
    await page
      .getByRole("dialog", { name: "Music City onboarding", exact: true })
      .waitFor({ state: "hidden" });
    assert.equal(
      await page
        .getByRole("dialog", { name: "Music City onboarding", exact: true })
        .count(),
      0,
    );
  }
  checks.push(
    `${intent} ${mode}: persisted profile, optional fields, activation, reload, completion destination`,
  );
  await context.close();
  return session;
}
try {
  const inviter = await registration("artist", "page");
  const referral = await request("/referrals/me", inviter.token);
  assert.ok(referral.code && referral.enabled);
  await registration("listener", "page");
  await registration("both", "page");
  await registration("artist", "modal", referral);
  await registration("listener", "modal");
  await registration("both", "modal");
  const after = await request("/referrals/me", inviter.token);
  assert.equal(
    after.totals.artists,
    referral.totals.artists + 1,
    "Referral must count the completed artist once",
  );
  checks.push(
    "Artist invitation survives identity save and credits its inviter once",
  );
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  currentPage = page;
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${client}/dev/studio-components`);
  await page
    .getByRole("heading", { name: "Studio component preview", exact: true })
    .waitFor();
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await overflow(page, `Component preview at ${width}`);
    await capture(page, `components-${width}`);
  }
  await page
    .getByRole("button", { name: "Open example dialog", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(
    await page
      .getByRole("button", { name: "Open example dialog", exact: true })
      .evaluate((el) => el === document.activeElement),
    true,
  );
  checks.push(
    "Development preview uses real shared controls across five widths",
  );
  await context.close();
  assert.deepEqual(errors, []);
  const result = {
    recordedAt: new Date().toISOString(),
    browser: await browser.version(),
    storage: "isolated PostgreSQL and local media",
    checks,
    captures,
    pageErrors: errors,
  };
  await writeFile(
    `${output}/onboarding-verification.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({ checks, captures: captures.length, pageErrors: errors }),
  );
} catch (error) {
  if (currentPage && !currentPage.isClosed()) {
    await capture(currentPage, "onboarding-browser-failure");
    await writeFile(
      `${output}/onboarding-browser-failure.txt`,
      `${currentPage.url()}\n${await currentPage.locator("body").innerText()}`,
    );
  }
  throw error;
} finally {
  await browser.close();
}
