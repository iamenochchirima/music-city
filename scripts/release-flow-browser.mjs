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
assert.equal(profile.artistAccess, true, "The zero-fee local artist must be activated");
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
let activePage = page;
const errors = [],
  captures = [],
  checks = [];
page.on("pageerror", (error) => errors.push(error.message));

async function capture(name, state, target = page) {
  await target
    .locator("[data-sonner-toast]")
    .first()
    .waitFor({ state: "hidden", timeout: 6000 })
    .catch(() => undefined);
  if ((await target.locator("dialog[open]").count()) === 0)
    await target.evaluate(() => window.scrollTo(0, 0));
  await target.screenshot({
    path: `${output}/${name}.png`,
    fullPage: (await target.locator("dialog[open]").count()) === 0,
  });
  captures.push({
    file: `${name}.png`,
    route: new URL(target.url()).pathname + new URL(target.url()).search,
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
    `${label} overflows horizontally`,
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
    const release = (await request(`/releases/${id}/manage`)).release;
    if (predicate(release)) return release;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for release ${id}`);
}

const coverBytes = await require("sharp")({
  create: {
    width: 160,
    height: 160,
    channels: 3,
    background: { r: 9, g: 22, b: 38 },
  },
})
  .composite([
    {
      input: Buffer.from(
        '<svg width="160" height="160"><circle cx="80" cy="76" r="46" fill="#19c784"/><path d="M0 122h160v38H0z" fill="#080d1a"/></svg>',
      ),
    },
  ])
  .png()
  .toBuffer();
const cover = {
  name: "cover.png",
  mimeType: "image/png",
  buffer: coverBytes,
};

async function beginRelease(title, type, songCount, target = page) {
  await target.goto(`${client}/dashboard/releases/new`);
  await target.getByLabel("Release name", { exact: true }).fill(title);
  await target.getByRole("radio", { name: new RegExp(`^${type}`) }).check();
  if (songCount > 1)
    await target.getByLabel("How many songs?", { exact: true }).fill(String(songCount));
  return target;
}

async function uploadSongs(files, target = page) {
  const picker = target.getByLabel("Choose audio files to upload", { exact: true });
  await picker.setInputFiles(
    files.map((name) => ({
      name: `${name}.wav`,
      mimeType: "audio/wav",
      buffer: wav,
    })),
  );
  await target
    .getByText(`${files.length} of ${files.length} ${files.length === 1 ? "song" : "songs"} added`, { exact: true })
    .waitFor();
}

try {
  await beginRelease("Community single", "Single", 1);
  assert.equal(await page.getByLabel("How many songs?").count(), 0);
  await capture("01-release-setup", "Release name and format come before song upload");
  await page.getByRole("button", { name: "Continue to songs", exact: true }).click();
  await page.getByRole("heading", { name: "Your song", exact: true }).waitFor();
  const singleId = new URL(page.url()).pathname.split("/").at(-1);
  await uploadSongs(["Community single"]);
  let single = await checkRelease(singleId, (release) => release.tracks.length === 1);
  assert.equal(single.type, "single");
  await capture("02-add-music", "Single accepts its audio and shows the selected song on the release card");

  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Song title", { exact: true }).waitFor();
  await page.getByLabel("Song title", { exact: true }).fill("Community single");
  await page.getByRole("button", { name: "Add contributor", exact: true }).click();
  await page.getByLabel("Contributor name 1", { exact: true }).fill("Community Composer");
  await page.getByLabel("Existing ISRC", { exact: true }).fill("ZAABC2600001");
  await page.getByLabel("Record label", { exact: true }).fill("Independent label");
  await capture("03-song-details", "Song credits and identifiers save within the release");

  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByLabel("Genre", { exact: true }).click();
  await page.getByRole("option", { name: "Afrobeats", exact: true }).click();
  await page.getByLabel("Description", { exact: true }).fill("A local end-to-end release rehearsal.");
  await page.getByLabel("Artwork file", { exact: true }).setInputFiles(cover);
  await page.getByText("Artwork saved", { exact: true }).waitFor();
  await page.waitForFunction(() => {
    const image = [...document.images].find(
      (item) => item.alt === "Saved release artwork",
    );
    return image?.complete && image.naturalWidth > 0;
  });
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("radio", { name: "Publish now", exact: true }).waitFor();
  await page.waitForFunction(() => {
    const image = [...document.images].find(
      (item) => item.alt === "Release artwork",
    );
    return image?.complete && image.naturalWidth > 0;
  });
  await capture("04-artwork-review", "Genre and artwork are saved before publication review");

  single = await checkRelease(singleId, (release) => release.tracks[0].track.isrc === "ZAABC2600001");
  const singleTrackId = single.tracks[0].trackId;
  await pool.query(
    'UPDATE tracks SET payload=payload || \'{"playbackReady":false,"status":"processing"}\'::jsonb WHERE id=$1',
    [singleTrackId],
  );
  await page.reload();
  await page.getByRole("radio", { name: "Publish now", exact: true }).check();
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await page.getByText("Processing · publishes automatically", { exact: true }).waitFor();
  assert.equal((await request(`/releases/${singleId}`)).release, null);
  await capture("05-processing", "Publication request persists while audio finishes processing");
  await page.setViewportSize({ width: 390, height: 844 });
  await overflow("Single processing mobile");
  await capture("05-processing-mobile", "Mobile processing state fits without horizontal scrolling");
  await page.close();
  await pool.query(
    'UPDATE tracks SET payload=payload || \'{"playbackReady":true,"status":"published"}\'::jsonb WHERE id=$1',
    [singleTrackId],
  );
  single = await checkRelease(singleId, (release) => release.status === "published");
  assert.equal((await request(`/releases/${singleId}`)).release.title, "Community single");
  checks.push("Single release was created from the new setup-first flow, uploaded, credited, given artwork, requested for publication, and published by the worker after the browser closed");

  const collection = await context.newPage();
  activePage = collection;
  collection.on("pageerror", (error) => errors.push(error.message));
  collection.setDefaultTimeout(20000);
  await beginRelease("Community EP", "EP", 3, collection);
  await collection.getByRole("button", { name: "Continue to songs", exact: true }).click();
  await collection.getByRole("heading", { name: "Your songs", exact: true }).waitFor();
  const collectionId = new URL(collection.url()).pathname.split("/").at(-1);
  await uploadSongs(["One", "Two", "Three"], collection);
  let release = await checkRelease(collectionId, (item) => item.tracks.length === 3);
  assert.equal(release.type, "ep");
  assert.equal(release.expectedTrackCount, 3);
  await capture("06-ep-tracklist", "EP count controls a three-song upload on the same release card", collection);

  await collection.getByRole("button", { name: "Continue", exact: true }).click();
  await collection.getByRole("button", { name: "Apply shared credits & label", exact: true }).click();
  await collection.getByLabel("Record label", { exact: true }).first().fill("Shared label");
  await collection.getByRole("button", { name: "Apply to selected songs", exact: true }).click();
  await collection.getByRole("button", { name: "2. Two", exact: true }).click();
  await collection.locator("#release-track-information").getByLabel("Record label", { exact: true }).fill("Different label");
  await collection.getByRole("button", { name: "Continue", exact: true }).click();
  await checkRelease(
    collectionId,
    (item) =>
      item.tracks[0].track.recordLabel === "Shared label" &&
      item.tracks[1].track.recordLabel === "Different label" &&
      item.tracks[2].track.recordLabel === "Shared label",
  );
  await collection.getByRole("button", { name: "Save & exit", exact: true }).click();
  await collection.goto(`${client}/dashboard/releases/${collectionId}?step=information`);
  await collection.getByRole("button", { name: "2. Two", exact: true }).click();
  assert.equal(await collection.locator("#release-track-information").getByLabel("Record label", { exact: true }).inputValue(), "Different label");
  for (const width of [360, 390, 768, 1024, 1440]) {
    await collection.setViewportSize({ width, height: 900 });
    await overflow(`EP metadata ${width}px`, collection);
    await capture(`07-ep-details-${width}`, "Saved EP metadata reopens with its individual label and responsive layout", collection);
  }
  checks.push("EP setup requires its planned song count; three songs upload to one release; shared label and individual song override survive save and reopen at five viewport widths");

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
        environment: "Disposable PostgreSQL, local API/client/worker and local media storage; no provider payments or chain transactions.",
        processingBoundary:
          "Local audio readiness was controlled in the disposable PostgreSQL database to reproduce processing. Publication and browser-close completion used the actual API and worker.",
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ checks, captures: captures.length, pageErrors: errors }));
} catch (error) {
  if (activePage.isClosed() === false) {
    await capture("browser-failure", "Failed local browser run", activePage).catch(() => undefined);
    await writeFile(
      `${output}/browser-failure.txt`,
      `${activePage.url()}\n${errors.join("\n")}\n${await activePage.locator("body").innerText().catch(() => "<page unavailable>")}`,
    );
  }
  console.error(`Browser failure at ${activePage.url()}. Page errors: ${errors.join("; ")}`);
  throw error;
} finally {
  await pool.end();
  await context.close();
  await browser.close();
}
