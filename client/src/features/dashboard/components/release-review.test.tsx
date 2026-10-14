import { useState } from "react";
import type { ReleaseDetail } from "@music-city/shared";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ReleaseReview } from "./release-review";
const sync = vi.hoisted(() => vi.fn());
vi.mock("@/features/music/lib/tracks-api", () => ({
  tracksApi: { syncTrackMedia: sync },
}));
const ready = {
  id: "ready",
  title: "Ready song",
  playbackReady: true,
  status: "uploaded",
};
const pending = {
  id: "pending",
  title: "Processing song",
  playbackReady: false,
  status: "processing",
};
const release = {
  id: "release",
  title: "My release",
  type: "ep",
  status: "draft",
  tracks: [ready, pending].map((track, index) => ({
    trackId: track.id,
    trackNumber: index + 1,
    discNumber: 1,
    isFocusTrack: false,
    track,
  })),
} as ReleaseDetail;
const publish = vi.fn(),
  resolve = vi.fn();
function Example({
  value = release,
  initialMode = "published",
}: {
  value?: ReleaseDetail;
  initialMode?: "draft" | "published" | "scheduled";
}) {
  const [current, setCurrent] = useState(value);
  const [mode, setMode] = useState(initialMode);
  return (
    <ReleaseReview
      release={current}
      mode={mode}
      date=""
      busy={false}
      issues={
        current.tracks.some((item) => !item.track.playbackReady)
          ? [
              {
                label: "Wait for every track to finish audio processing",
                targetId: "release-tracklist",
                kind: "audio",
              },
            ]
          : []
      }
      token="token"
      onMode={setMode}
      onDate={() => {}}
      onResolve={resolve}
      onPublish={publish}
      onAudioUpdated={(updated) =>
        setCurrent((previous) => ({
          ...previous,
          tracks: previous.tracks.map((item) => ({
            ...item,
            track:
              updated.find((track) => track.id === item.trackId) ?? item.track,
          })),
        }))
      }
    />
  );
}
beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("exposes all publication choices and shows date selection directly", async () => {
  const user = userEvent.setup();
  render(<Example value={{ ...release, tracks: [release.tracks[0]] }} />);
  expect(screen.getAllByRole("radio")).toHaveLength(3);
  expect(screen.queryByRole("combobox")).toBeNull();
  await user.click(screen.getByRole("radio", { name: "Schedule release" }));
  expect(screen.getByLabelText("Scheduled release time")).toBeTruthy();
});
it("visibly reports ready counts and blocks publication while retaining draft saving", async () => {
  const user = userEvent.setup();
  render(<Example />);
  expect(
    screen.getByRole("heading", { name: "Waiting for audio" }),
  ).toBeTruthy();
  expect(screen.getByText("1 of 2 recordings ready")).toBeTruthy();
  expect(
    screen
      .getByRole("progressbar", { name: "Recordings ready" })
      .getAttribute("aria-valuenow"),
  ).toBe("50");
  expect(
    screen
      .getByRole("button", { name: "Waiting for audio..." })
      .hasAttribute("disabled"),
  ).toBe(true);
  await user.click(screen.getByRole("radio", { name: "Keep as draft" }));
  await user.click(screen.getByRole("button", { name: "Save as draft" }));
  expect(publish).toHaveBeenCalledOnce();
});
it("automatically checks pending recordings and enables publication when ready", async () => {
  vi.useFakeTimers();
  sync.mockResolvedValue({
    ...pending,
    playbackReady: true,
    status: "uploaded",
  });
  render(<Example />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(sync).toHaveBeenCalledWith("token", "pending");
  expect(sync).toHaveBeenCalledOnce();
  expect(screen.queryByText("Processing audio")).toBeNull();
  expect(
    screen.getByRole("heading", { name: "Ready to publish" }),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: "Release now" })
      .hasAttribute("disabled"),
  ).toBe(false);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(sync).toHaveBeenCalledOnce();
});
it("makes a failed status check recoverable without enabling publication", async () => {
  vi.useFakeTimers();
  sync.mockRejectedValueOnce(new Error("Offline"));
  render(<Example />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000);
  });
  expect(screen.getByText("Status check interrupted")).toBeTruthy();
  expect(
    screen.getByRole("button", { name: "Retry status check" }),
  ).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: "Waiting for audio..." })
      .hasAttribute("disabled"),
  ).toBe(true);
});
it("shows failed audio as a failure instead of an endless waiting state", async () => {
  const user = userEvent.setup();
  render(
    <Example
      value={{
        ...release,
        tracks: [
          {
            ...release.tracks[1],
            track: { ...release.tracks[1].track, status: "failed" },
          },
        ],
      }}
    />,
  );
  expect(screen.getByText("Failed")).toBeTruthy();
  expect(screen.queryByText("Processing")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Fix audio" }));
  expect(resolve).toHaveBeenCalledWith("release-tracklist");
  expect(
    screen
      .getByRole("button", { name: "Fix audio before publishing" })
      .hasAttribute("disabled"),
  ).toBe(true);
});
