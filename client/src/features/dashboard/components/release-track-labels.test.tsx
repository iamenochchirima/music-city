import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TrackSummary } from "@music-city/shared";
import { ReleaseTrackLabels } from "./release-track-labels";
const mocks = vi.hoisted(() => ({ apply: vi.fn(), refresh: vi.fn() }));
vi.mock("@/features/music/lib/releases-api", () => ({ releasesApi: { applyTrackMetadata: mocks.apply, getManageRelease: mocks.refresh } }));
const tracks = [{ id: "one", title: "One" }, { id: "two", title: "Two", recordLabel: "Own Label" }] as TrackSummary[];
const applied = vi.fn();
beforeEach(() => { vi.clearAllMocks(); mocks.apply.mockResolvedValue([{ ...tracks[0], recordLabel: "Release Label" }]); });
afterEach(cleanup);
function open() { render(<ReleaseTrackLabels releaseId="release" token="token" label=" Release Label " tracks={tracks} onApplied={applied} />); }
it("previews blank targets by default and requires explicit overwrite for existing labels", async () => {
  const user = userEvent.setup(); open();
  await user.click(screen.getByRole("button", { name: "Apply record label to tracks" }));
  const boxes = screen.getAllByRole("checkbox");
  expect((boxes[1] as HTMLInputElement).checked).toBe(true);
  expect((boxes[2] as HTMLInputElement).disabled).toBe(true);
  expect(mocks.apply).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Confirm label changes" }));
  await waitFor(() => expect(mocks.apply).toHaveBeenCalledWith("token", "release", { recordLabel: "Release Label", trackIds: ["one"], expectedLabels: { one: "" }, overwrite: false }));
  expect(applied).toHaveBeenCalled();
});
it("keeps the preview on a stale error and refreshes expected labels before retry", async () => {
  mocks.apply.mockRejectedValueOnce(new Error("A track label changed. Refresh the preview before applying it."));
  const user = userEvent.setup(); open();
  await user.click(screen.getByRole("button", { name: "Apply record label to tracks" }));
  await user.click(screen.getByRole("checkbox", { name: "Allow replacing existing track labels" }));
  await user.click(screen.getAllByRole("checkbox")[2]!);
  await user.click(screen.getByRole("button", { name: "Confirm label changes" }));
  expect((await screen.findByRole("alert")).textContent).toContain("changed");
  expect(applied).not.toHaveBeenCalled();
  mocks.refresh.mockResolvedValue({ tracks: [{ track: { ...tracks[0], recordLabel: "Newer Label" } }, { track: tracks[1] }] });
  await user.click(screen.getByRole("button", { name: "Refresh preview" }));
  await screen.findByText(/Current label: Newer Label/);
  expect((screen.getAllByRole("checkbox")[1] as HTMLInputElement).checked).toBe(false);
});
