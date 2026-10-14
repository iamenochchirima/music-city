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
let token;
async function request(path, method = "GET", body) {
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
const wallet = Keypair.random();
const challenge = await request(
  `/auth/challenge?account=${wallet.publicKey()}`,
);
const transaction = TransactionBuilder.fromXDR(
  challenge.transaction,
  challenge.networkPassphrase,
);
transaction.sign(wallet);
const { session } = await request("/auth/verify", "POST", {
  transaction: transaction.toXDR(),
});
token = session.token;
await request("/users/me/onboarding", "PUT", {
  step: "identity",
  displayName: "Community Artist With A Long Name For The Studio Layout Audit",
});
await request("/users/me/onboarding", "PUT", {
  step: "intent",
  primaryIntent: "both",
});
await request("/users/me/onboarding", "PUT", {
  step: "personalize",
  genres: ["Afrobeats", "Alternative", "Hip-hop", "House", "Indie"],
  favoriteArtistIds: [],
  interestedInLocalMusic: true,
  notificationPreferences: {
    releaseNotifications: true,
    artistUpdates: true,
    productUpdates: false,
  },
});
const { profile } = await request("/users/me/onboarding/complete", "POST", {
  step: "complete",
});
const auth = { ...session, ...profile, token };
const launch = { headless: true, args: ["--no-sandbox"] };
if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH)
  launch.executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
const browser = await chromium.launch(launch);
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
await context.addInitScript(
  (value) =>
    localStorage.setItem("music-city-auth-session", JSON.stringify(value)),
  auth,
);
const page = await context.newPage();
page.setDefaultTimeout(20000);
const errors = [],
  captures = [],
  checks = [],
  contrast = [];
page.on("pageerror", (error) => errors.push(error.message));
async function capture(name, state, target = page, fullPage = true) {
  if (fullPage && (await target.locator("dialog[open]").count()) === 0)
    await target.evaluate(() => window.scrollTo(0, 0));
  await target.screenshot({
    path: `${output}/${name}.png`,
    fullPage: fullPage && (await target.locator("dialog[open]").count()) === 0,
  });
  captures.push({
    file: `${name}.png`,
    route: new URL(target.url()).pathname,
    viewport: target.viewportSize(),
    deviceScale: await target.evaluate(() => devicePixelRatio),
    state,
    result: "passed",
  });
}
async function overflow(label, target = page) {
  assert.ok(
    await target.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
    `${label} overflows`,
  );
}
const wav = Buffer.alloc(44 + 16000);
wav.write("RIFF", 0);
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(1, 22);
wav.writeUInt32LE(8000, 24);
wav.writeUInt32LE(16000, 28);
wav.writeUInt16LE(2, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(16000, 40);

try {
  await page.goto(`${client}/dashboard/releases/new`);
  await page.getByLabel("Title", { exact: true }).fill("Community single");
  await page.getByLabel("Genre", { exact: true }).click();
  await page.getByRole("option", { name: "Afrobeats", exact: true }).click();
  await capture("01-basics", "Release basics before draft creation");
  await page
    .getByRole("button", { name: "Save draft & continue", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Upload a new track", exact: true })
    .waitFor();
  const releaseId = new URL(page.url()).pathname.split("/").at(-1);
  const addAudio = async (title) => {
    await page
      .getByRole("button", { name: "Upload a new track", exact: true })
      .click();
    await page.getByLabel("Track title", { exact: true }).fill(title);
    await page.getByLabel("Audio file", { exact: true }).setInputFiles({
      name: "recording.wav",
      mimeType: "audio/wav",
      buffer: wav,
    });
    await page
      .getByRole("button", { name: "Upload & add recording", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Upload & add recording", exact: true })
      .waitFor({ state: "hidden" });
    await page.getByText(title, { exact: true }).first().waitFor();
  };
  await addAudio("Local song");
  assert.equal(
    (await request(`/releases/${releaseId}/manage`)).release.tracks.length,
    1,
  );
  await capture("02-music", "Audio uploaded and automatically attached");
  await page
    .getByRole("button", { name: "Save & continue", exact: true })
    .click();
  await page
    .getByLabel("Track title", { exact: true })
    .fill("Local song with credits");
  await page
    .getByRole("button", { name: "Add contributor", exact: true })
    .click();
  await page
    .getByLabel("Contributor name 1", { exact: true })
    .fill("Community Composer");
  await page.getByLabel("Existing ISRC", { exact: true }).fill("ZAABC2600001");
  await page
    .getByLabel("Record label", { exact: true })
    .fill("Independent local label");
  await capture("03-information", "Per-song title, credits, ISRC, and label");
  await page
    .getByRole("button", { name: "Save & continue", exact: true })
    .click();
  const image = Buffer.from(
    await page.evaluate(() => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const x = c.getContext("2d");
      x.fillStyle = "#159d68";
      x.fillRect(0, 0, 64, 64);
      return c.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
  await page
    .getByLabel("Description", { exact: true })
    .fill("A release from our local community.");
  await page
    .getByLabel("Artwork file", { exact: true })
    .setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: image });
  await page.getByRole("button", { name: "Upload cover", exact: true }).click();
  await page.getByText("Release cover updated.", { exact: true }).waitFor();
  await capture("04-artwork", "Artwork and release description");
  await page
    .getByRole("button", { name: "Save & continue", exact: true })
    .click();
  let showPending = true;
  let finishProcessing;
  const processingGate = new Promise((resolve) => {
    finishProcessing = resolve;
  });
  await page.route(`**/api/v1/releases/${releaseId}/manage`, async (route) => {
    const response = await route.fetch();
    const data = await response.json();
    if (showPending) {
      showPending = false;
      data.release.tracks[0].track.playbackReady = false;
      data.release.tracks[0].track.status = "processing";
    }
    await route.fulfill({ response, json: data });
  });
  await page.route("**/api/v1/tracks/*/sync-media", async (route) => {
    await processingGate;
    await route.continue();
  });
  await page.goto(`${client}/dashboard/releases/${releaseId}?step=review`);
  await page
    .getByRole("heading", { name: "Waiting for audio", exact: true })
    .waitFor();
  await page.getByRole("radio", { name: "Publish now", exact: true }).check();
  assert.equal(await page.getByRole("radio").count(), 3);
  assert.equal(
    await page
      .getByRole("button", { name: "Waiting for audio...", exact: true })
      .isDisabled(),
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await capture(
    "05-processing",
    "Visible processing status and open publication choices",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await overflow("Mobile processing review");
  await capture(
    "05-processing-mobile",
    "Mobile processing status and three publication choices",
  );
  finishProcessing();
  await page
    .getByRole("heading", { name: "Ready to publish", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Release now", exact: true })
      .isEnabled(),
    true,
  );
  await page.unroute(`**/api/v1/releases/${releaseId}/manage`);
  await page.unroute("**/api/v1/tracks/*/sync-media");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await capture(
    "05-review",
    "Single ready for publication with visible plan choices",
  );
  checks.push(
    "Visible audio waiting state blocks publication and automatically becomes ready; all publication choices remain exposed on desktop and mobile",
  );
  await page.getByRole("button", { name: "Release now", exact: true }).click();
  await page
    .getByRole("button", { name: "Start revision", exact: true })
    .waitFor();
  const original = (await request(`/releases/${releaseId}`)).release;
  assert.equal(original.tracks[0].track.credits[0].name, "Community Composer");
  assert.equal(original.tracks[0].track.isrc, "ZAABC2600001");
  checks.push(
    "Five-step Single flow uploads, attaches, saves credits and artwork, and publishes through the real API",
  );
  await page
    .getByRole("button", { name: "Start revision", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Release basics", exact: true })
    .click();
  await page.getByLabel("Title", { exact: true }).fill("Community EP revision");
  await page
    .getByRole("button", { name: "Save & continue", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Upload a new track", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Change release type", exact: true })
    .waitFor();
  await capture(
    "06-type-change",
    "Single prompts for EP before a second recording",
  );
  await page
    .getByRole("button", { name: "Change type & upload", exact: true })
    .click();
  await page
    .getByLabel("Track title", { exact: true })
    .fill("Second local song");
  await page
    .getByLabel("Audio file", { exact: true })
    .setInputFiles({ name: "second.wav", mimeType: "audio/wav", buffer: wav });
  let failAttach = true;
  await page.route(`**/api/v1/releases/${releaseId}/tracks`, async (route) => {
    if (route.request().method() === "POST" && failAttach) {
      failAttach = false;
      await route.abort("failed");
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Upload & add recording", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Retry adding recording", exact: true })
    .waitFor();
  assert.equal((await request("/tracks/mine")).items.length, 2);
  await capture(
    "07-upload-retry",
    "Attachment failure retains completed audio for retry",
  );
  await page
    .getByRole("button", { name: "Retry adding recording", exact: true })
    .click();
  await page.getByText("Second local song", { exact: true }).first().waitFor();
  await page.unroute(`**/api/v1/releases/${releaseId}/tracks`);
  await page
    .getByRole("button", { name: "Save & continue", exact: true })
    .click();
  await page
    .getByLabel("Track title", { exact: true })
    .fill("Revised first song");
  await page.getByRole("button", { name: "Save & exit", exact: true }).click();
  await page.waitForURL("**/dashboard/releases");
  await page
    .getByRole("link", { name: "Community EP revision", exact: true })
    .click();
  await page.getByRole("button", { name: "Add music", exact: true }).click();
  assert.equal(
    (await request(`/releases/${releaseId}/manage`)).release.tracks.length,
    2,
  );
  const beforeApply = (await request(`/releases/${releaseId}`)).release;
  assert.equal(beforeApply.title, "Community single");
  assert.equal(beforeApply.tracks.length, 1);
  assert.equal(beforeApply.tracks[0].track.title, "Local song with credits");
  assert.equal((await request("/tracks")).items.length, 1);
  assert.equal(
    (await request(`/tracks/${original.tracks[0].trackId}`)).track.title,
    "Local song with credits",
  );
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await overflow(`Release at ${width}`);
    await capture(`08-music-${width}`, "Saved two-song revision after resume");
  }
  await page
    .getByRole("button", { name: "Review & publish", exact: true })
    .click();
  await capture(
    "09-revision-review",
    "Apply revision while the old Single remains public",
  );
  await page
    .getByRole("button", { name: "Apply release update", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start revision", exact: true })
    .waitFor();
  const afterApply = (await request(`/releases/${releaseId}`)).release;
  assert.equal(afterApply.title, "Community EP revision");
  assert.equal(afterApply.type, "ep");
  assert.equal(afterApply.tracks.length, 2);
  assert.equal(afterApply.tracks[0].track.title, "Revised first song");
  assert.equal((await request("/tracks")).items.length, 2);
  checks.push(
    "Saved published revisions preserve the public release and recording metadata until explicit application",
  );
  checks.push(
    "Single-to-EP prompt, completed-audio attachment retry, save and exit, resume, and five responsive widths",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/verification.json`,
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        browser: browser.version(),
        checks,
        captures,
        pageErrors: errors,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ checks, captures: captures.length, pageErrors: errors }),
  );
} catch (error) {
  await page
    .screenshot({ path: `${output}/failure.png`, fullPage: true })
    .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
