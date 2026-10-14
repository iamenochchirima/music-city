import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { TrackManageOverview } from "./track-manage-overview";

const mocks = vi.hoisted(() => ({ load: vi.fn(), update: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: { token: "token" } }) }));
vi.mock("@/features/users/lib/users-api", () => ({ usersApi: { listArtists: async () => [] } }));
vi.mock("@/features/music/lib/tracks-api", () => ({ tracksApi: { getManageTrack: mocks.load, updateTrackMetadata: mocks.update } }));
const track = { id: "track-1", title: "Original", artistName: "Artist", genre: "Pop", runtime: "0:30", status: "draft", credits: [], isExplicit: false, featuredArtists: [], playbackReady: true };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue(track);
  mocks.update.mockImplementation(async (_token, _id, fields) => ({ ...track, ...fields }));
});
afterEach(cleanup);
function open() { render(<MemoryRouter><TrackManageOverview trackId="track-1" /></MemoryRouter>); }
it("saves track details and identifiers together through one action", async () => {
  const user = userEvent.setup(); open();
  await screen.findByLabelText("Track title");
  await user.clear(screen.getByLabelText("Track title"));
  await user.type(screen.getByLabelText("Track title"), "Updated");
  await user.type(screen.getByLabelText("Record label"), "Track Label");
  expect(screen.getByRole("status").textContent).toBe("Unsaved changes");
  await user.click(screen.getByRole("button", { name: "Save metadata" }));
  await screen.findByText("All changes saved");
  expect(mocks.update).toHaveBeenCalledOnce();
  expect(mocks.update).toHaveBeenCalledWith("token", "track-1", expect.objectContaining({ title: "Updated", recordLabel: "Track Label", credits: [] }));
});
it("retains unsaved values after a failed save and permits retry", async () => {
  const user = userEvent.setup(); open();
  await screen.findByLabelText("Record label");
  await user.type(screen.getByLabelText("Record label"), "Retained");
  mocks.update.mockRejectedValueOnce(new Error("Connection interrupted"));
  await user.click(screen.getByRole("button", { name: "Save metadata" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Your changes are still here");
  expect((screen.getByLabelText("Record label") as HTMLInputElement).value).toBe("Retained");
  await user.click(screen.getByRole("button", { name: "Save metadata" }));
  await screen.findByText("All changes saved");
});
