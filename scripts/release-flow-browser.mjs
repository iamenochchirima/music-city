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

const { Pool } = require("pg");
const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
async function checkRelease(id, predicate) {
  for (let i = 0; i < 80; i++) {
    const r = (await request(`/releases/${id}/manage`)).release;
    if (predicate(r)) return r;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Timed out waiting for release state");
}
const cover = {
  name: "cover.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
    "base64",
  ),
};
async function details() {
  await page
    .getByRole("button", { name: "Release details", exact: true })
    .click();
  await page.getByLabel("Genre", { exact: true }).click();
  await page.getByRole("option", { name: "Afrobeats", exact: true }).click();
  await page.getByLabel("Artwork file").setInputFiles(cover);
  await page.getByText("Artwork saved", { exact: true }).waitFor();
}
try {
  await page.goto(`${client}/dashboard/releases/new`);
  assert.equal(await page.getByLabel("Title", { exact: true }).count(), 0);
  await capture("01-add-music", "Music-first release creation");
  await page
    .getByLabel("Audio files", { exact: true })
    .setInputFiles({
      name: "Community single.wav",
      mimeType: "audio/wav",
      buffer: wav,
    });
  await page.getByRole("heading", { name: "Tracklist", exact: true }).waitFor();
  const id = new URL(page.url()).pathname.split("/").at(-1);
  let release = await checkRelease(id, (r) => r.tracks.length === 1);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Track title", { exact: true }).waitFor();
  assert.equal(
    await page.getByLabel("Track title", { exact: true }).inputValue(),
    "Community single",
  );
  await page
    .getByRole("button", { name: "Add contributor", exact: true })
    .click();
  await page.getByLabel("Contributor name 1").fill("Community Composer");
  await page.getByLabel("Existing ISRC").fill("ZAABC2600001");
  await page
    .getByLabel("Record label", { exact: true })
    .fill("Independent label");
  await capture("02-song-details", "Song metadata collected once");
  await details();
  assert.equal(await page.getByLabel("Title", { exact: true }).count(), 0);
  await capture(
    "03-release-details",
    "Single reuses title and artwork uploads on selection",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("radio", { name: "Publish now", exact: true }).check();
  await capture("04-review", "Compact review and open publication choices");
  release = await checkRelease(
    id,
    (r) => r.tracks[0].track.isrc === "ZAABC2600001",
  );
  const trackId = release.tracks[0].trackId;
  await pool.query(
    'UPDATE tracks SET payload=payload || \'{"playbackReady":false,"status":"processing"}\'::jsonb WHERE id=$1',
    [trackId],
  );
  await page.reload();
  await page.getByRole("radio", { name: "Publish now", exact: true }).check();
  assert.equal(
    await page
      .getByRole("button", { name: "Publish", exact: true })
      .isEnabled(),
    true,
  );
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page
    .getByText("Processing · publishes automatically", { exact: true })
    .waitFor();
  assert.equal((await request(`/releases/${id}`)).release, null);
  await capture(
    "05-processing",
    "Durable publication accepted before readiness",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await overflow("Processing mobile");
  await capture(
    "05-processing-mobile",
    "Mobile processing and accepted publication",
  );
  await page.close();
  await pool.query(
    'UPDATE tracks SET payload=payload || \'{"playbackReady":true,"status":"published"}\'::jsonb WHERE id=$1',
    [trackId],
  );
  await checkRelease(id, (r) => r.status === "published");
  assert.equal(
    (await request(`/releases/${id}`)).release.title,
    "Community single",
  );
  checks.push(
    "Single title and metadata entered once; artwork uploads automatically; publication finishes in the real worker after the browser closes",
  );
  const collection = await context.newPage();
  collection.on("pageerror", (error) => errors.push(error.message));
  await collection.goto(`${client}/dashboard/releases/new`);
  await collection
    .getByLabel("Audio files", { exact: true })
    .setInputFiles(
      ["One", "Two", "Three"].map((name) => ({
        name: `${name}.wav`,
        mimeType: "audio/wav",
        buffer: wav,
      })),
    );
  await collection
    .getByRole("heading", { name: "Tracklist", exact: true })
    .waitFor();
  const collectionId = new URL(collection.url()).pathname.split("/").at(-1);
  await checkRelease(
    collectionId,
    (r) => r.tracks.length === 3 && r.type === "ep",
  );
  await collection.getByRole("button", { name: "Done", exact: true }).click();
  await collection
    .getByRole("button", { name: "Continue", exact: true })
    .click();
  await collection
    .getByRole("button", { name: "Apply shared credits & label", exact: true })
    .click();
  await collection
    .getByLabel("Record label", { exact: true })
    .first()
    .fill("Shared label");
  await collection
    .getByRole("button", { name: "Apply to selected songs", exact: true })
    .click();
  await checkRelease(collectionId, (r) =>
    r.tracks.every((t) => t.track.recordLabel === "Shared label"),
  );
  await collection
    .getByRole("button", { name: "3. Three", exact: true })
    .click();
  await collection
    .getByLabel("Record label", { exact: true })
    .fill("Different label");
  await checkRelease(
    collectionId,
    (r) => r.tracks[2].track.recordLabel === "Different label",
  );
  await collection
    .getByRole("button", { name: "Save & exit", exact: true })
    .click();
  await collection.goto(
    `${client}/dashboard/releases/${collectionId}?step=information`,
  );
  await collection
    .getByRole("button", { name: "3. Three", exact: true })
    .click();
  assert.equal(
    await collection.getByLabel("Record label", { exact: true }).inputValue(),
    "Different label",
  );
  for (const width of [360, 390, 768, 1024, 1440]) {
    await collection.setViewportSize({ width, height: 900 });
    await overflow(`Collection ${width}`, collection);
    await capture(
      `06-collection-${width}`,
      "Reopened collection with an individual metadata override",
      collection,
    );
  }
  checks.push(
    "Three-file upload suggests EP without interruption; shared label applies once; song exception and saved draft survive reopening at five widths",
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
        processingBoundary:
          "Local audio readiness was controlled in PostgreSQL; publication and browser-close completion use the actual API, durable requests, and worker.",
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({ checks, captures: captures.length, pageErrors: errors }),
  );
} finally {
  await pool.end();
  await browser.close();
}
