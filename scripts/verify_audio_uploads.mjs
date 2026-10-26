// Generate samples with scripts/generate_audio_fixtures.py first.
// Required: AUDIO_VERIFY_SESSION_FILE (private local artist session JSON), AUDIO_FIXTURES_DIR.
// Optional: AUDIO_VERIFY_API, AUDIO_VERIFY_FFMPEG, AUDIO_VERIFY_EVIDENCE,
// AUDIO_VERIFY_RELEASE_ID (resume processing/playback checks for a previous run).
// Use an isolated database. This creates real provider assets; remove only this run's assets afterward.
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { audioContentTypeForFileName } from "../packages/shared/dist/index.js";

const api = new URL(
  process.env.AUDIO_VERIFY_API ?? "http://127.0.0.1:4349/api/v1/",
);
if (!["127.0.0.1", "localhost"].includes(api.hostname))
  throw new Error("Use an isolated local API and database");
if (!api.pathname.endsWith("/")) api.pathname += "/";
const session = JSON.parse(
  await readFile(process.env.AUDIO_VERIFY_SESSION_FILE, "utf8"),
);
const directory = process.env.AUDIO_FIXTURES_DIR;
const ffmpeg = process.env.AUDIO_VERIFY_FFMPEG ?? "ffmpeg";
const evidence = {
  environment: "local API, real configured storage and media providers",
  createdAt: new Date().toISOString(),
  releaseId: "",
  files: [],
};
async function request(path, method = "GET", body) {
  const response = await fetch(new URL(path, api), {
    method,
    headers: {
      Authorization: `Bearer ${session.token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(`${path}: ${response.status} ${JSON.stringify(result)}`);
  return result;
}
const files = (await readdir(directory)).filter((file) =>
  audioContentTypeForFileName(file),
);
if (!files.length) throw new Error("Generate audio fixtures first");
if (process.env.AUDIO_VERIFY_RELEASE_ID) {
  const { release } = await request(
    `releases/${process.env.AUDIO_VERIFY_RELEASE_ID}/manage`,
  );
  evidence.releaseId = release.id;
  for (const item of release.tracks) {
    const file = item.track.title.replace(/^Audio verification /, "");
    evidence.files.push({
      file,
      bytes: (await readFile(join(directory, file))).length,
      contentType: audioContentTypeForFileName(file),
      trackId: item.trackId,
      uploadAccepted: true,
      ready: false,
      playbackDecoded: false,
    });
  }
} else {
  const { release } = await request("releases", "POST", {
    title: "Audio format verification",
    type: files.length === 1 ? "single" : files.length <= 6 ? "ep" : "album",
    expectedTrackCount: files.length,
    artistName: session.displayName,
    genre: "Instrumental",
  });
  evidence.releaseId = release.id;
  for (const file of files) {
    const bytes = await readFile(join(directory, file));
    const contentType = audioContentTypeForFileName(file);
    const { track } = await request("tracks", "POST", {
      title: `Audio verification ${file}`,
      artistName: session.displayName,
      genre: "Instrumental",
      isExplicit: false,
      featuredArtists: [],
      credits: [],
    });
    const { uploadSession: upload } = await request(
      "uploads/sessions",
      "POST",
      {
        trackId: track.id,
        purpose: "audio",
        fileName: file,
        contentType,
        sizeBytes: bytes.length,
      },
    );
    if (new URL(upload.uploadUrl).origin !== api.origin)
      throw new Error("Expected the local upload relay");
    const result = await fetch(upload.uploadUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${session.token}`,
        "Content-Type": contentType,
      },
      body: bytes,
      signal: AbortSignal.timeout(60_000),
    });
    if (!result.ok)
      throw new Error(
        `${file}: upload ${result.status} ${await result.text()}`,
      );
    await request(`uploads/sessions/${upload.id}/complete`, "POST", {
      uploadSessionId: upload.id,
      eTag: result.headers.get("etag") ?? undefined,
    });
    await request(`releases/${release.id}/tracks`, "POST", {
      trackId: track.id,
      discNumber: 1,
      isFocusTrack: false,
    });
    evidence.files.push({
      file,
      bytes: bytes.length,
      contentType,
      trackId: track.id,
      uploadAccepted: true,
      ready: false,
      playbackDecoded: false,
    });
    console.log(JSON.stringify({ file, uploaded: true }));
  }
}
const deadline = Date.now() + 240_000;
while (evidence.files.some((file) => !file.ready) && Date.now() < deadline) {
  for (const file of evidence.files.filter((file) => !file.ready)) {
    const { track } = await request(`tracks/${file.trackId}/manage`);
    if (track.status === "failed" || track.muxAssetStatus === "errored")
      throw new Error(`${file.file}: media processing failed`);
    if (track.playbackReady) {
      file.ready = true;
      file.runtime = track.runtime;
      console.log(
        JSON.stringify({
          file: file.file,
          ready: true,
          runtime: track.runtime,
        }),
      );
    }
  }
  if (evidence.files.some((file) => !file.ready))
    await new Promise((done) => setTimeout(done, 5000));
}
for (const file of evidence.files) {
  if (!file.ready) throw new Error(`${file.file}: processing did not finish`);
  const { playbackSession } = await request("playback/sessions", "POST", {
    trackId: file.trackId,
  });
  // Fetch HLS through Node so the decoder does not depend on a bundled binary's TLS stack.
  let playlistUrl = playbackSession.streamUrl;
  let playlist = await (
    await fetch(playlistUrl, { signal: AbortSignal.timeout(20_000) })
  ).text();
  if (playlist.includes("#EXT-X-STREAM-INF")) {
    playlistUrl = new URL(
      playlist.split("\n").find((line) => line && !line.startsWith("#")),
      playlistUrl,
    ).href;
    playlist = await (
      await fetch(playlistUrl, { signal: AbortSignal.timeout(20_000) })
    ).text();
  }
  if (!playlist.includes("#EXTINF") || playlist.includes("#EXT-X-KEY"))
    throw new Error(`${file.file}: unexpected HLS playlist`);
  const chunks = [];
  for (const line of playlist
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))) {
    const response = await fetch(new URL(line, playlistUrl), {
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok)
      throw new Error(`${file.file}: HLS segment returned ${response.status}`);
    chunks.push(Buffer.from(await response.arrayBuffer()));
  }
  const result = spawnSync(
    ffmpeg,
    ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "null", "-"],
    { input: Buffer.concat(chunks), timeout: 20_000, encoding: "utf8" },
  );
  if (result.status !== 0)
    throw new Error(
      `${file.file}: HLS decode failed: ${(result.stderr ?? "").replace(/https?:\/\/[^\s]+/g, "[media URL]")}`,
    );
  file.playbackDecoded = true;
  console.log(JSON.stringify({ file: file.file, playbackDecoded: true }));
}
await writeFile(
  process.env.AUDIO_VERIFY_EVIDENCE ??
    "/tmp/music-city-audio-formats-evidence.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
