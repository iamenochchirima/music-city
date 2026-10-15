import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReleaseDetail } from "@music-city/shared";
import { ReleaseAudioUploader } from "./release-audio-uploader";
const mocks = vi.hoisted(() => ({ create: vi.fn(), add: vi.fn() }));
vi.mock("@/features/music/lib/tracks-api", () => ({
  tracksApi: { createTrack: mocks.create, deleteTrack: vi.fn() },
}));
vi.mock("@/features/music/lib/releases-api", () => ({
  releasesApi: { addTrackToRelease: mocks.add },
}));
vi.mock("@/features/uploads/lib/uploads-api", () => ({
  uploadsApi: {
    createSession: async () => ({ id: "upload" }),
    uploadFile: async () => "etag",
    completeSession: async () => ({
      track: { id: "song", title: "Morning Light" },
    }),
    cancelSession: vi.fn(),
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const release = {
  id: "release",
  artistName: "Artist",
  genre: "",
  tracks: [],
} as unknown as ReleaseDetail;
it("removes completed files from the queue once the song is added to the release", async () => {
  const user = userEvent.setup();
  const added = vi.fn();
  const busy = vi.fn();
  mocks.create.mockResolvedValue({ id: "song" });
  mocks.add.mockResolvedValue({ ...release, tracks: [{ trackId: "song" }] });
  render(
    <ReleaseAudioUploader
      release={release}
      token="token"
      maxFiles={1}
      onAdded={added}
      onSaved={vi.fn()}
      onBusy={busy}
      onClose={vi.fn()}
    />,
  );
  expect(
    (screen.getByLabelText("Audio files") as HTMLInputElement).multiple,
  ).toBe(false);
  await user.upload(
    screen.getByLabelText("Audio files"),
    new File(["audio"], "Morning Light.wav", { type: "audio/wav" }),
  );
  await waitFor(() => expect(added).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.queryByText("Morning Light.wav")).toBeNull(),
  );
  expect(busy).toHaveBeenLastCalledWith(false);
});
it("rejects excess files before creating or uploading any song", async () => {
  const user = userEvent.setup();
  render(
    <ReleaseAudioUploader
      release={release}
      token="token"
      maxFiles={2}
      onAdded={vi.fn()}
      onSaved={vi.fn()}
      onBusy={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  await user.upload(
    screen.getByLabelText("Audio files"),
    ["One", "Two", "Three"].map(
      (name) => new File(["audio"], `${name}.wav`, { type: "audio/wav" }),
    ),
  );
  expect(screen.getByRole("alert").textContent).toContain(
    "Choose up to 2 songs",
  );
  expect(mocks.create).not.toHaveBeenCalled();
});
