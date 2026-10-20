import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ReleaseManageOverview } from "./release-manage-overview";
const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  update: vi.fn(),
  metadata: vi.fn(),
  publish: vi.fn(),
  cancel: vi.fn(),
  complete: vi.fn(),
  upload: vi.fn(),
  revision: vi.fn(),
  delete: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: { token: "token" } }),
}));
vi.mock("@/features/music/lib/tracks-api", () => ({
  tracksApi: {
    listMyTracks: async () => [],
    updateTrackMetadata: mocks.metadata,
  },
}));
vi.mock("@/features/music/lib/releases-api", () => ({
  releasesApi: {
    getManageRelease: mocks.load,
    updateRelease: mocks.update,
    publish: mocks.publish,
    cancelPublication: mocks.cancel,
    beginRevision: mocks.revision,
    deleteRelease: mocks.delete,
  },
}));
vi.mock("@/features/uploads/lib/uploads-api", () => ({
  uploadsApi: {
    createSession: async () => ({ id: "cover" }),
    uploadFile: mocks.upload,
    completeSession: mocks.complete,
    cancelSession: vi.fn(),
  },
}));
vi.mock("@/features/users/lib/users-api", () => ({
  usersApi: { listArtists: async () => [] },
}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
const track = {
  id: "one",
  title: "One",
  artistName: "Artist",
  runtime: "1:00",
  playbackReady: true,
  credits: [],
  recordLabel: "",
  isrc: "",
};
const base = {
  id: "release",
  title: "Original",
  artistName: "Artist",
  type: "single",
  genre: "Pop",
  status: "draft",
  tracks: [
    {
      trackId: "one",
      trackNumber: 1,
      discNumber: 1,
      isFocusTrack: false,
      track,
    },
  ],
  coverImageUrl: "https://example.com/art.jpg",
};
const pending = {
  id: "request",
  state: "processing",
  mode: "published",
  releaseAt: null,
  error: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mocks.load.mockResolvedValue(base);
  mocks.update.mockImplementation(async (_t, _id, patch) => ({
    ...base,
    ...patch,
  }));
  mocks.metadata.mockImplementation(async (_t, _id, patch) => ({
    ...track,
    ...patch,
  }));
  mocks.upload.mockResolvedValue("etag");
  mocks.complete.mockResolvedValue({
    release: { ...base, coverImageUrl: "https://example.com/new.jpg" },
  });
  mocks.publish.mockResolvedValue({ ...base, publication: pending });
  mocks.cancel.mockResolvedValue({
    ...base,
    publication: { ...pending, state: "cancelled" },
  });
  URL.createObjectURL = vi.fn(() => "blob:cover");
  URL.revokeObjectURL = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);
function Location() {
  const l = useLocation();
  return <output aria-label="Destination">{l.pathname}</output>;
}
async function open(step = "basics") {
  render(
    <MemoryRouter initialEntries={[`/?step=${step}`]}>
      <ReleaseManageOverview releaseId="release" />
      <Location />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: "Original" });
}
it("starts with release setup and autosaves changed release details", async () => {
  const user = userEvent.setup();
  await open();
  expect(screen.getByRole("button", { name: "Release setup" })).toBeTruthy();
  await user.clear(screen.getByLabelText("Release name"));
  await user.type(screen.getByLabelText("Release name"), "New title");
  await waitFor(
    () =>
      expect(mocks.update).toHaveBeenCalledWith(
        "token",
        "release",
        expect.objectContaining({ title: "New title" }),
      ),
    { timeout: 4000 },
  );
});
it("uploads artwork immediately without a separate upload action", async () => {
  const user = userEvent.setup();
  await open("artwork");
  await user.upload(
    screen.getByLabelText("Artwork file"),
    new File(["image"], "cover.png", { type: "image/png" }),
  );
  await waitFor(() => expect(mocks.complete).toHaveBeenCalled());
  expect(screen.queryByRole("button", { name: "Upload cover" })).toBeNull();
});
it("accepts publication while audio processes and displays durable pending status", async () => {
  mocks.load.mockResolvedValue({
    ...base,
    tracks: [
      {
        ...base.tracks[0],
        track: { ...track, playbackReady: false, status: "processing" },
      },
    ],
  });
  const user = userEvent.setup();
  await open("review");
  await user.click(screen.getByRole("radio", { name: "Publish now" }));
  await user.click(screen.getByRole("button", { name: "Publish" }));
  await waitFor(() =>
    expect(mocks.publish).toHaveBeenCalledWith(
      "token",
      "release",
      "published",
      undefined,
    ),
  );
  expect(
    await screen.findByText("Processing · publishes automatically"),
  ).toBeTruthy();
});
it("save and exit preserves a pending request instead of cancelling it", async () => {
  mocks.load.mockResolvedValue({ ...base, publication: pending });
  const user = userEvent.setup();
  await open("review");
  await user.click(screen.getByRole("button", { name: "Save & exit" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Destination").textContent).toBe(
      "/dashboard/releases",
    ),
  );
  expect(mocks.update).not.toHaveBeenCalled();
  expect(mocks.cancel).not.toHaveBeenCalled();
});
it("requires explicit cancellation before editing a queued version", async () => {
  mocks.load.mockResolvedValue({ ...base, publication: pending });
  const user = userEvent.setup();
  await open();
  expect(
    (screen.getByLabelText("Release name") as HTMLInputElement).disabled,
  ).toBe(false);
  expect(
    screen.getByLabelText("Release name").closest("fieldset")?.disabled,
  ).toBe(true);
  await user.click(
    screen.getByRole("button", { name: "Cancel publication & edit" }),
  );
  await waitFor(() =>
    expect(mocks.cancel).toHaveBeenCalledWith("token", "release"),
  );
  await waitFor(() =>
    expect(
      screen.getByLabelText("Release name").closest("fieldset")?.disabled,
    ).toBe(false),
  );
});
it("failed autosave keeps the entered value and offers an explicit retry", async () => {
  mocks.update.mockRejectedValue(new Error("Offline"));
  const user = userEvent.setup();
  await open();
  await user.clear(screen.getByLabelText("Release name"));
  await user.type(screen.getByLabelText("Release name"), "Retained title");
  await waitFor(() => expect(mocks.update).toHaveBeenCalled(), {
    timeout: 4000,
  });
  expect(
    (screen.getByLabelText("Release name") as HTMLInputElement).value,
  ).toBe("Retained title");
  expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
});

it("a filled Single shows its song once without another picker or ordering fields", async () => {
  await open("music");
  expect(screen.getByText("1 of 1 song added")).toBeTruthy();
  expect(screen.getAllByText("One")).toHaveLength(1);
  expect(screen.queryByRole("combobox")).toBeNull();
  expect(
    screen.queryByRole("button", { name: "Choose from library" }),
  ).toBeNull();
  expect(screen.queryByRole("button", { name: /Move One/ })).toBeNull();
});
it("blocks an incomplete planned tracklist before song details", async () => {
  mocks.load.mockResolvedValue({ ...base, type: "ep", expectedTrackCount: 3 });
  const user = userEvent.setup();
  await open("music");
  expect(screen.getByText("1 of 3 songs added")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("alert").textContent).toContain("Add all your songs");
  expect(mocks.update).not.toHaveBeenCalled();
});

it.each(["draft", "published", "scheduled"])("exposes deletion for a %s release and cancellation sends no request", async (status) => {
  mocks.load.mockResolvedValue({...base, status});
  const user = userEvent.setup();
  await open();
  await user.click(screen.getByRole("button", {name:"Delete release"}));
  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent).toContain("Your tracks and audio stay in your library.");
  await user.click(screen.getByRole("button", {name:"Cancel"}));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(mocks.delete).not.toHaveBeenCalled();
});
it("requires confirmation before deleting and returns to the release library", async () => {
  mocks.delete.mockResolvedValue(undefined);
  const user = userEvent.setup();
  await open();
  await user.click(screen.getByRole("button", {name:"Delete release"}));
  expect(mocks.delete).not.toHaveBeenCalled();
  await user.click(within(screen.getByRole("dialog")).getByRole("button", {name:"Delete release"}));
  await waitFor(() => expect(mocks.delete).toHaveBeenCalledWith("token","release"));
  await waitFor(() => expect(screen.getByLabelText("Destination").textContent).toBe("/dashboard/releases"));
});
