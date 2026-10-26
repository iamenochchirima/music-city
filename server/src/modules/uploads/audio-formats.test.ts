import assert from "node:assert/strict";
import test from "node:test";
import {
  audioContentTypeForFileName,
  validateAudioFile,
  type UploadSession,
} from "@music-city/shared";
const { uploadsService } = await import("./uploads.service.js");

for (const [fileName, header, type] of [
  ["song.mp3", Buffer.from("ID3audio"), "audio/mpeg"],
  ["song.WAV", Buffer.from("RIFFxxxxWAVEfmt "), "audio/wav"],
  ["song.wav", Buffer.from("RF64xxxxWAVEds64"), "audio/wav"],
  ["song.flac", Buffer.from("fLaCaudio"), "audio/flac"],
  ["song.m4a", Buffer.from("xxxxftypM4A "), "audio/mp4"],
  [
    "song.aac",
    Buffer.from([0xff, 0xf1, 0x50, 0x80, 0x01, 0x7f, 0xfc]),
    "audio/aac",
  ],
  ["song.ogg", Buffer.from("OggSaudio"), "audio/ogg"],
] as const) {
  test(`normalizes and validates ${fileName} as ${type}`, () => {
    assert.equal(audioContentTypeForFileName(fileName), type);
    const session = {
      purpose: "audio",
      fileName,
      contentType: type,
      sizeBytes: header.length,
    } as UploadSession;
    assert.doesNotThrow(() =>
      uploadsService.validatePayload(session, {
        sizeBytes: header.length,
        sample: header,
      }),
    );
    assert.equal(
      validateAudioFile({ name: fileName, size: header.length }),
      null,
    );
  });
}

test("does not accept an image renamed as audio or an empty recording", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.throws(
    () =>
      uploadsService.validatePayload(
        {
          purpose: "audio",
          sizeBytes: png.length,
          contentType: "audio/mpeg",
        } as UploadSession,
        { sizeBytes: png.length, sample: png },
      ),
    /file type/,
  );
  assert.ok(validateAudioFile({ name: "song.wav", size: 0 }));
  assert.ok(validateAudioFile({ name: "picture.jpg", size: 100 }));
  assert.ok(validateAudioFile({ name: "song.wav", size: 501 * 1024 * 1024 }));
});
