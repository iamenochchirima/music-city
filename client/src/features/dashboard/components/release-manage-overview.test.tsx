import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ReleaseManageOverview } from "./release-manage-overview";
import { ApiClientError } from "@/lib/api/http-client";

const mocks = vi.hoisted(() => ({ load: vi.fn(), update: vi.fn(), reorder: vi.fn(), add: vi.fn(), upload: vi.fn(), complete: vi.fn(), metadata: vi.fn(), revision: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: { token: "token" } }) }));
vi.mock("@/features/music/lib/tracks-api", () => ({ tracksApi: { listMyTracks: async () => [], updateTrackMetadata: mocks.metadata } }));
vi.mock("@/features/music/lib/releases-api", () => ({ releasesApi: { getManageRelease: mocks.load, updateRelease: mocks.update, reorderReleaseTracks: mocks.reorder, addTrackToRelease: mocks.add, beginRevision: mocks.revision } }));
vi.mock("@/features/uploads/lib/uploads-api", () => ({ uploadsApi: { createSession: async () => ({ id: "cover-session" }), uploadFile: mocks.upload, completeSession: mocks.complete, cancelSession: vi.fn() } }));
vi.mock("@/features/users/lib/users-api", () => ({usersApi:{listArtists:async () => []}}));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
const recording = { id: "one", title: "One", artistName: "Artist", runtime: "1:00", playbackReady: true };
const base = { id: "release", title: "Original", artistName: "Artist", type: "single", genre: "Pop", status: "draft", tracks: [{ trackId: "one", trackNumber: 1, discNumber: 1, isFocusTrack: false, track: recording }], coverImageUrl: "https://example.com/art.jpg" };
beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  mocks.load.mockResolvedValue(base);
  mocks.metadata.mockImplementation(async (_token,_id,patch) => ({...recording,...patch}));
  mocks.update.mockImplementation(async (_token, _id, fields) => ({ ...base, ...fields }));
  mocks.reorder.mockImplementation(async (_token, _id, { items }) => ({ ...base, tracks: items.map((item: object) => ({ ...item, track: recording })) }));
  mocks.upload.mockResolvedValue("etag");
  mocks.complete.mockResolvedValue({ release: { ...base, coverImageUrl: "https://example.com/new.jpg" } });
  URL.createObjectURL = vi.fn(() => "blob:artwork-preview");
  URL.revokeObjectURL = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);
function Location() { return <output aria-label="Destination">{useLocation().pathname + useLocation().search}</output>; }
async function open() {
  render(<MemoryRouter><ReleaseManageOverview releaseId="release" /><Location /></MemoryRouter>);
  await screen.findByLabelText("Title");
}
it("retains unsaved details across sections and an artwork response", async () => {
  const user = userEvent.setup(); await open();
  await user.clear(screen.getByLabelText("Title")); await user.type(screen.getByLabelText("Title"), "Unsaved title");
  await user.click(screen.getByRole("button", { name: "Artwork & release details" }));
  await user.upload(screen.getByLabelText("Artwork file"), new File(["image"], "cover.png", { type: "image/png" }));
  await user.click(screen.getByRole("button", { name: "Upload cover" }));
  await waitFor(() => expect(mocks.complete).toHaveBeenCalled());
  await user.click(screen.getByRole("button", { name: "Release basics" }));
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Unsaved title");
  expect(mocks.update).not.toHaveBeenCalled();
});
it("opens the section and focuses the control for an unresolved publication requirement", async () => {
  mocks.load.mockResolvedValue({ ...base, coverImageUrl: undefined });
  const user = userEvent.setup(); await open();
  await user.click(screen.getByRole("button", { name: "Review & publish" }));
  await user.click(screen.getByRole("button", { name: "Upload release artwork" }));
  expect(screen.getByRole("button", { name: "Artwork & release details" }).getAttribute("aria-current")).toBe("step");
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Artwork file")));
  expect(mocks.update).not.toHaveBeenCalled();
});
it("keeps a selected schedule across section changes without changing publication on a details save", async () => {
  const user = userEvent.setup(); await open();
  await user.click(screen.getByRole("button", { name: "Review & publish" }));
  await user.selectOptions(screen.getByLabelText("Release plan"), "scheduled");
  await user.type(screen.getByLabelText("Scheduled release time"), "2030-12-01T13:00");
  await user.click(screen.getByRole("button", { name: "Release basics" }));
  await user.type(screen.getByLabelText("Title"), " updated");
  await user.click(screen.getByRole("button", { name: "Save & continue" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
  expect(mocks.update.mock.calls[0][2]).not.toHaveProperty("status");
  await user.click(screen.getByRole("button", { name: "Review & publish" }));
  expect((screen.getByLabelText("Release plan") as HTMLSelectElement).value).toBe("scheduled");
  expect((screen.getByLabelText("Scheduled release time") as HTMLInputElement).value).toBe("2030-12-01T13:00");
});
it("saves current details and track order before publication", async () => {
  const user = userEvent.setup(); await open();
  await user.type(screen.getByLabelText("Title"), " current");
  await user.click(screen.getByRole("button", { name: "Add music" }));
  await user.click(screen.getByLabelText("Set One as focus track"));
  await user.click(screen.getByRole("button", { name: "Review & publish" }));
  await user.selectOptions(screen.getByLabelText("Release plan"), "published");
  await user.click(screen.getByRole("button", { name: "Release now" }));
  await waitFor(() => expect(mocks.update).toHaveBeenCalledOnce());
  expect(mocks.reorder).toHaveBeenCalledWith("token", "release", { items: [{ trackId: "one", trackNumber: 1, discNumber: 1, isFocusTrack: true }] });
  expect(mocks.update).toHaveBeenCalledWith("token", "release", expect.objectContaining({ title: "Original current", status: "published" }));
  expect(mocks.reorder.mock.invocationCallOrder[0]).toBeLessThan(mocks.update.mock.invocationCallOrder[0]);
});
it("retains form values and stays in the workspace if saving before upload fails", async () => {
  const user = userEvent.setup(); await open();
  await user.type(screen.getByLabelText("Title"), " retained");
  mocks.update.mockRejectedValueOnce(new Error("Save interrupted"));
  await user.click(screen.getByRole("button", { name: "Add music" }));
  await user.click(screen.getByRole("button", { name: "Save & continue" }));
  expect((await screen.findByRole("alert")).textContent).toContain("Save interrupted");
  expect(screen.getByLabelText("Destination").textContent).toContain("step=music");
  await user.click(screen.getByRole("button", { name: "Release basics" }));
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Original retained");
});
it("keeps scheduling errors in Review beside the date without discarding its value", async () => {
  const user = userEvent.setup(); await open();
  await user.click(screen.getByRole("button", { name: "Review & publish" }));
  await user.selectOptions(screen.getByLabelText("Release plan"), "scheduled");
  await user.type(screen.getByLabelText("Scheduled release time"), "2030-12-01T13:00");
  mocks.update.mockRejectedValueOnce(new ApiClientError("Schedule rejected", 400, undefined, { releaseDate: "Choose another release time." }));
  await user.click(screen.getByRole("button", { name: "Schedule release" }));
  await screen.findByText("Choose another release time.");
  expect(screen.getByRole("button", { name: "Review & publish" }).getAttribute("aria-current")).toBe("step");
  expect(screen.getByLabelText("Scheduled release time").getAttribute("aria-invalid")).toBe("true");
  expect((screen.getByLabelText("Scheduled release time") as HTMLInputElement).value).toBe("2030-12-01T13:00");
});

it("retains recording edits across steps and saves them before continuing", async () => {
 const user=userEvent.setup();await open();
 await user.click(screen.getByRole("button",{name:"Track information"}));
 await user.clear(screen.getByLabelText("Track title"));await user.type(screen.getByLabelText("Track title"),"Revised recording");
 await user.click(screen.getByRole("button",{name:"Artwork & release details"}));
 await user.click(screen.getByRole("button",{name:"Track information"}));
 expect((screen.getByLabelText("Track title") as HTMLInputElement).value).toBe("Revised recording");
 await user.click(screen.getByRole("button",{name:"Save & continue"}));
 await waitFor(() => expect(mocks.metadata).toHaveBeenCalledWith("token","one",expect.objectContaining({title:"Revised recording"})));
 expect(mocks.metadata).toHaveBeenCalledOnce();
 expect(mocks.metadata.mock.invocationCallOrder[0]).toBeLessThan(mocks.update.mock.invocationCallOrder[0]);
});
it("requires an explicit revision before showing live editing controls",async () => {
 const live={...base,status:"published"};mocks.load.mockResolvedValue(live);mocks.revision.mockResolvedValue({...live,hasRevision:true});
 const user=userEvent.setup();render(<MemoryRouter><ReleaseManageOverview releaseId="release" /></MemoryRouter>);
 await screen.findByRole("button",{name:"Start revision"});expect(screen.queryByLabelText("Title")).toBeNull();
 await user.click(screen.getByRole("button",{name:"Start revision"}));await screen.findByLabelText("Title");
 expect(mocks.revision).toHaveBeenCalledWith("token","release");
 expect(screen.getByText(/Editing a saved revision/)).toBeTruthy();
});
it("prompts to change a Single before uploading its second recording",async () => {
 const user=userEvent.setup();await open();await user.click(screen.getByRole("button",{name:"Add music"}));
 await user.click(screen.getByRole("button",{name:"Upload a new track"}));
 expect(screen.getByRole("dialog",{name:"Change release type"})).toBeTruthy();expect(mocks.upload).not.toHaveBeenCalled();
});
