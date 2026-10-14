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
  if (fullPage && (await target.locator("dialog[open]").count()) === 0) await target.evaluate(() => window.scrollTo(0, 0));
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
const roles = [
  "composer",
  "lyricist",
  "producer",
  "engineer",
  "publisher",
  "songwriter",
  "remixer",
];
const credits = Array.from({ length: 32 }, (_, index) => ({
  role: roles[index % roles.length],
  name:
    index === 31
      ? "LongContributor" + "x".repeat(100)
      : `Contributor ${index + 1} from the local community and independent publishing collective`,
}));
async function upload(trackId, releaseId) {
  const { uploadSession } = await request("/uploads/sessions", "POST", {
    ...(trackId
      ? {
          trackId,
          purpose: "audio",
          fileName: "audit.wav",
          contentType: "audio/wav",
          sizeBytes: wav.length,
        }
      : {
          releaseId,
          purpose: "cover",
          fileName: "cover.png",
          contentType: "image/png",
          sizeBytes: image.length,
        }),
  });
  const response = await fetch(uploadSession.uploadUrl, {
    method: uploadSession.method,
    headers: { ...uploadSession.headers, Authorization: `Bearer ${token}` },
    body: trackId ? wav : image,
  });
  assert.ok(response.ok);
  return request(`/uploads/sessions/${uploadSession.id}/complete`, "POST", {
    uploadSessionId: uploadSession.id,
    eTag: response.headers.get("etag") ?? undefined,
  });
}
let image;
try {
  await page.goto(`${client}/dashboard/create`);
  await page.getByRole("button", { name: /Upload to recordings library/ }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  assert.equal(
    await page
      .getByLabel("Track title", { exact: true })
      .getAttribute("aria-invalid"),
    "true",
  );
  await capture(
    "audit-upload-missing-details",
    "validation error with focused title",
  );
  await page
    .getByLabel("Track title", { exact: true })
    .fill(
      "A recording with a long title from our local community and independent artist collective",
    );
  await page.getByLabel("Primary genre").click();
  await page.getByRole("option", { name: "Afrobeats", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  assert.equal(
    await page.getByLabel("Master audio file").getAttribute("aria-invalid"),
    "true",
  );
  await capture(
    "audit-upload-missing-audio",
    "audio selection required before continuing",
  );
  await page
    .getByLabel("Master audio file")
    .setInputFiles({
      name: "CommunityAudio" + "x".repeat(140) + ".wav",
      mimeType: "audio/wav",
      buffer: wav,
    });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  for (const [index, credit] of credits.entries()) {
    await page
      .getByRole("button", { name: "Add contributor", exact: true })
      .click();
    await page
      .getByLabel(`Role ${index + 1}`, { exact: true })
      .selectOption(credit.role);
    await page
      .getByLabel(`Contributor name ${index + 1}`, { exact: true })
      .fill(credit.name);
  }
  assert.equal(
    await page
      .getByRole("button", { name: "Add contributor", exact: true })
      .isDisabled(),
    true,
  );
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await overflow(`32 contributors at ${width}`);
    await capture(
      `audit-upload-32-${width}`,
      "32 populated contributor rows with long names",
    );
  }
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  let failOnce = true;
  await page.route(`${api}/uploads/sessions`, (route) => {
    if (failOnce) {
      failOnce = false;
      return route.abort("failed");
    }
    return route.continue();
  });
  await page
    .getByRole("button", { name: "Save track draft", exact: true })
    .click();
  await page
    .getByText(/Your details are still here. Try saving again/)
    .waitFor();
  await capture(
    "audit-upload-failed-save",
    "failed upload preserves review and retry",
  );
  let finishUpload;
  const heldUpload = new Promise((resolve) => {
    finishUpload = resolve;
  });
  await page.route(`${api}/uploads/sessions`, async (route) => {
    await heldUpload;
    return route.continue();
  });
  await page
    .getByRole("button", { name: "Save track draft", exact: true })
    .click();
  await page
    .getByRole("status")
    .filter({ hasText: "Preparing audio upload" })
    .waitFor();
  await capture(
    "audit-upload-progress",
    "audio upload in progress with disabled actions",
  );
  finishUpload();
  await page.getByText(/is ready for a release/).waitFor();
  await capture("audit-upload-success", "saved recording with next actions");
  const mine = (await request("/tracks/mine")).items;
  assert.equal(mine.length, 1, "Failed upload must clean up its draft");
  assert.equal(
    mine[0].credits.length,
    32,
    "All credits must survive retry and persist",
  );
  checks.push(
    "32 contributors, long names, inline validation, upload failure, cleanup, progress, successful retry",
  );
  image = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 32;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#159d68";
      ctx.fillRect(0, 0, 32, 32);
      return canvas.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
  const { release } = await request("/releases", "POST", {
    title:
      "A community album with a long title and twelve independently credited recordings",
    type: "album",
    genre: "Afrobeats",
  });
  for (let index = 0; index < 12; index++) {
    const track =
      index === 0
        ? mine[0]
        : (
            await request("/tracks", "POST", {
              title: `Recording ${index + 1} with a long community title that must wrap on mobile`,
              artistName: profile.displayName,
              genre: "Afrobeats",
              credits: [],
            })
          ).track;
    if (index !== 0) await upload(track.id);
    await request(`/releases/${release.id}/tracks`, "POST", {
      trackId: track.id,
      trackNumber: index + 1,
    });
  }
  await upload(undefined, release.id);
  await page.goto(`${client}/dashboard/releases/${release.id}`);
  await page.getByRole("button", { name: "Add music", exact: true }).click();
  await page.getByRole("button", { name: `Move ${mine[0].title} down`, exact: true }).click();
  await page.getByRole("button", { name: "Save order", exact: true }).click();
  await page.getByText("Track order saved.", { exact: true }).waitFor();
  assert.notEqual((await request(`/releases/${release.id}/manage`)).release.tracks[0].trackId, mine[0].id, "Ordering must persist through the real API");
  for (const width of [360, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await overflow(`12 tracks at ${width}`);
    await capture(
      `audit-release-12-${width}`,
      "12 tracks with long titles and ordering controls",
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("audit-release-mobile-viewport-top", "top of the long release workspace", page, false);
  await page.getByRole("button", { name: "Save order", exact: true }).scrollIntoViewIfNeeded();
  await capture("audit-release-mobile-viewport-bottom", "ordering action and lower tracks in the long release workspace", page, false);
  await page.getByRole("button", { name: "Review & publish", exact: true }).click();
  await page
    .getByRole("heading", { name: "Ready to publish", exact: true })
    .waitFor();
  await page.getByRole("radio", {name:"Schedule release",exact:true}).check();
  await page.getByLabel("Scheduled release time").fill("2030-12-01T13:00");
  await page
    .getByRole("button", { name: "Schedule release", exact: true })
    .click();
  await page.getByText("Release scheduled.", { exact: true }).waitFor();
  assert.equal(
    (await request(`/releases/${release.id}/manage`)).release.status,
    "scheduled",
  );
  await capture(
    "audit-release-scheduled",
    "scheduled release with saved status and explicit timezone",
  );
  await page.getByRole("button", { name: "Start revision", exact: true }).click();
  await page.getByRole("button",{name:"Review & publish",exact:true}).click();
  await page.getByRole("radio", {name:"Publish now",exact:true}).check();
  await page.getByRole("button", { name: "Apply release update", exact: true }).click();
  await page.getByText("Release published.", { exact: true }).waitFor();
  assert.equal(
    (await request(`/releases/${release.id}/manage`)).release.status,
    "published",
  );
  await capture(
    "audit-release-published",
    "published release after explicit confirmation",
  );
  checks.push(
    "12-track album with artwork, mobile ordering, real scheduling, and real publication",
  );
  const zoom = await browser.newContext({
    viewport: { width: 720, height: 500 },
    deviceScaleFactor: 2,
  });
  await zoom.addInitScript(
    (value) =>
      localStorage.setItem("music-city-auth-session", JSON.stringify(value)),
    auth,
  );
  const zoomPage = await zoom.newPage();
  zoomPage.on("pageerror", (error) => errors.push(error.message));
  for (const [path, heading, name] of [
    [`/dashboard/tracks/${mine[0].id}`, "Track details", "track"],
    [`/dashboard/releases/${release.id}`, "Edit this release", "release"],
    ["/onboarding", "Your artist workspace is ready.", "onboarding"],
  ]) {
    await zoomPage.goto(`${client}${path}`);
    await zoomPage.getByText(heading, { exact: true }).first().waitFor();
    await overflow(`200% desktop zoom layout for ${name}`, zoomPage);
    await capture(
      `audit-${name}-zoom-200`,
      "200% desktop zoom layout: 720 CSS pixels at 2x device scale for a 1440-pixel display",
      zoomPage,
    );
  }
  await zoom.close();
  checks.push("200% desktop zoom layout for track, release, and onboarding");
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/discover",
    "/artists",
    "/playlists",
    `/releases/${release.id}`,
    "/dashboard/analytics",
    "/dashboard/revenue",
  ]) {
    await page.goto(`${client}${path}`);
    await page.getByRole("heading").first().waitFor();
    await overflow(`Shared control regression on ${path}`);
    await capture(
      `audit-page-${path.replaceAll("/", "-")}`,
      "shared control and header regression on mobile",
    );
  }
  checks.push(
    "Listener pages, published release page, analytics and revenue entry points remain usable",
  );
  await page.goto(`${client}/dev/studio-components`);
  await page
    .getByRole("heading", { name: "Studio component preview", exact: true })
    .waitFor();
  const processingExample = page.getByRole("region", { name: "Audio processing result", exact: true });
  await processingExample.screenshot({ path: `${output}/audit-upload-processing-example.png` });
  captures.push({ file: "audit-upload-processing-example.png", route: "/dev/studio-components", viewport: page.viewportSize(), state: "passive preview of the actual processing result component; behavior verified by the upload completion test", result: "passed" });
  const colors = await page.evaluate(() => {
    const root = document.querySelector(".studio-theme"),
      input = document.querySelector("#preview-name"),
      primary = [...document.querySelectorAll("button")].find(
        (el) => el.textContent === "Primary action",
      ),
      muted = document.querySelector(".studio-theme .text-muted-foreground");
    return {
      background: getComputedStyle(root).backgroundColor,
      input: getComputedStyle(input).backgroundColor,
      border: getComputedStyle(input).borderColor,
      text: getComputedStyle(input).color,
      muted: getComputedStyle(muted).color,
      button: getComputedStyle(primary).backgroundColor,
      buttonText: getComputedStyle(primary).color,
    };
  });
  const luminance = (value) =>
    value
      .match(/[\d.]+/g)
      .slice(0, 3)
      .map(Number)
      .map((n) => n / 255)
      .map((n) => (n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4))
      .reduce((sum, n, i) => sum + n * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (first, second) =>
    (Math.max(luminance(first), luminance(second)) + 0.05) /
    (Math.min(luminance(first), luminance(second)) + 0.05);
  for (const [label, first, second, minimum] of [
    ["Input text", colors.text, colors.input, 4.5],
    ["Muted text", colors.muted, colors.background, 4.5],
    ["Input boundary", colors.border, colors.input, 3],
    ["Primary action", colors.buttonText, colors.button, 4.5],
  ]) {
    const value = ratio(first, second);
    assert.ok(value >= minimum, `${label} contrast ${value}`);
    contrast.push({ label, ratio: value, minimum });
  }
  const input = page.getByLabel("Contributor name with a longer label");
  await input.focus();
  assert.notEqual(
    await input.evaluate((el) => getComputedStyle(el).boxShadow),
    "none",
  );
  checks.push(
    "Computed text, control-boundary, action contrast, and visible focus ring",
  );
  assert.deepEqual(errors, []);
  const result = {
    recordedAt: new Date().toISOString(),
    browser: await browser.version(),
    checks,
    contrast,
    captures,
    pageErrors: errors,
  };
  await writeFile(
    `${output}/audit-verification.json`,
    JSON.stringify(result, null, 2),
  );
  console.log(
    JSON.stringify({
      checks,
      contrast,
      captures: captures.length,
      pageErrors: errors,
    }),
  );
} catch (error) {
  await capture("audit-browser-failure", "failed check");
  await writeFile(
    `${output}/audit-browser-failure.txt`,
    `${page.url()}\n${await page.locator("body").innerText()}`,
  );
  throw error;
} finally {
  await context.close();
  await browser.close();
}
