import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { TrackCreateForm } from "./track-create-form";
import { ApiClientError } from "@/lib/api/http-client";
const mocks = vi.hoisted(() => ({ create: vi.fn(), remove: vi.fn(), upload: vi.fn(), cancel: vi.fn(), prepare: vi.fn(), complete: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: { token: "token", walletAddress: "wallet", displayName: "Artist" } }) }));
vi.mock("@/features/users/lib/users-api", () => ({ usersApi: { listArtists: async () => [] } }));
vi.mock("@/features/music/lib/tracks-api", () => ({ tracksApi: { createTrack: mocks.create, deleteTrack: mocks.remove } }));
vi.mock("@/features/uploads/lib/uploads-api", () => ({ uploadsApi: { createSession: async () => ({ id: "upload" }), uploadFile: mocks.upload, completeSession: mocks.complete, cancelSession: mocks.cancel } }));
vi.mock("@/features/onboarding/hooks/use-artist-onboarding-payment", () => ({ useArtistOnboardingPayment: () => ({ complete: vi.fn(), prepare: mocks.prepare, isPaying: false }) }));
vi.mock("@/features/onboarding/components/artist-payment-review-dialog", () => ({ ArtistPaymentReviewDialog: () => null }));
vi.mock("@/components/ui/searchable-picker", () => ({ SearchablePicker: ({ id, value, onValueChange }: { id: string; value: string; onValueChange: (value: string) => void }) => <select id={id} value={value} onChange={e => onValueChange(e.target.value)}><option value="">Select</option><option value="Pop">Pop</option></select> }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); mocks.create.mockResolvedValue({ id: "track", title: "Song" }); mocks.upload.mockResolvedValue("etag"); mocks.complete.mockResolvedValue({ track: { id: "track", title: "Song", playbackReady: true } }); mocks.cancel.mockResolvedValue(undefined); mocks.remove.mockResolvedValue(undefined); });
afterEach(cleanup);
function open() { return render(<MemoryRouter><TrackCreateForm onCreated={vi.fn()} /></MemoryRouter>); }
async function basics(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Track title"), "Song");
  await user.selectOptions(screen.getByLabelText("Primary genre"), "Pop");
  await user.click(screen.getByRole("button", { name: "Next" }));
}
async function audio(user: ReturnType<typeof userEvent.setup>) {
  await user.upload(screen.getByLabelText("Master audio file"), new File(["audio"], "song.wav", { type: "audio/wav" }));
  await user.click(screen.getByRole("button", { name: "Next" }));
}
it("collects metadata, preserves it on upload failure, cleans up, and retries the same entered values", async () => {
  const user = userEvent.setup(); open(); await basics(user); await audio(user);
  await user.click(screen.getByRole("button", { name: "Add contributor" }));
  await user.type(screen.getByLabelText("Contributor name 1"), "Composer");
  await user.type(screen.getByLabelText("Existing ISRC"), "us-rc1-76-07839");
  await user.type(screen.getByLabelText("Record label"), "Label");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByText("Composer: Composer")).toBeTruthy();
  mocks.upload.mockRejectedValueOnce(new Error("Upload interrupted"));
  await user.click(screen.getByRole("button", { name: "Save track draft" }));
  await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("token", "track"));
  expect(mocks.cancel).toHaveBeenCalledWith("token", "upload");
  await waitFor(() => expect(screen.getByRole("button", { name: "Save track draft" }).hasAttribute("disabled")).toBe(false));
  await user.click(screen.getByRole("button", { name: "Save track draft" }));
  await screen.findByText("Song is ready for a release.");
  expect(mocks.create).toHaveBeenLastCalledWith("token", expect.objectContaining({ credits: [{ role: "composer", name: "Composer" }], isrc: "USRC17607839", recordLabel: "Label" }));
  expect(localStorage.getItem("music-city-track-draft:wallet")).toBeNull();
  expect(mocks.prepare).not.toHaveBeenCalled();
});
it("retains unfinished text after reload and requests audio reselection", async () => {
  const user = userEvent.setup(); const view = open(); await basics(user); await audio(user);
  await user.click(screen.getByRole("button", { name: "Add contributor" }));
  await user.type(screen.getByLabelText("Record label"), "Saved Label");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByRole("alert").textContent).toContain("contributor name");
  view.unmount(); open();
  expect((screen.getByLabelText("Record label") as HTMLInputElement).value).toBe("Saved Label");
  expect(screen.getByLabelText("Contributor name 1")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByText(/select your audio file again/)).toBeTruthy();
});
it("allows all optional metadata to stay empty and saves a draft", async () => {
  const user = userEvent.setup(); open(); await basics(user); await audio(user);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Save track draft" }));
  await screen.findByText("Song is ready for a release.");
  expect(mocks.create).toHaveBeenCalledWith("token", expect.objectContaining({ credits: [], isrc: "", recordLabel: "" }));
});

it("prepares artist activation only when saving is denied and retains metadata", async () => {
  const user = userEvent.setup(); open(); await basics(user); await audio(user);
  await user.type(screen.getByLabelText("Record label"), "Retained Label");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(mocks.prepare).not.toHaveBeenCalled();
  mocks.create.mockRejectedValueOnce(new ApiClientError("Complete artist activation", 402));
  mocks.prepare.mockResolvedValue({ id: "activation-intent" });
  await user.click(screen.getByRole("button", { name: "Save track draft" }));
  await waitFor(() => expect(mocks.prepare).toHaveBeenCalledTimes(1));
  expect(mocks.upload).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Edit credits & identifiers" }));
  expect((screen.getByLabelText("Record label") as HTMLInputElement).value).toBe("Retained Label");
});

it("focuses inline errors for missing details and missing audio before advancing", async () => {
  const user = userEvent.setup(); open();
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByLabelText("Track title").getAttribute("aria-invalid")).toBe("true");
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Track title")));
  await basics(user);
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByLabelText("Master audio file").getAttribute("aria-invalid")).toBe("true");
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Master audio file")));
  expect(mocks.create).not.toHaveBeenCalled();
});

it("routes a server title validation error back to details while preserving metadata", async () => {
  const user = userEvent.setup(); open(); await basics(user); await audio(user);
  await user.type(screen.getByLabelText("Record label"), "Retained Label");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  mocks.create.mockRejectedValueOnce(new ApiClientError("Check title", 400, undefined, { title: "Shorten the title." }));
  await user.click(screen.getByRole("button", { name: "Save track draft" }));
  await screen.findByText("Shorten the title.");
  expect(screen.getByLabelText("Track title").getAttribute("aria-invalid")).toBe("true");
  await user.click(screen.getByRole("button", { name: "Credits & identifiers" }));
  expect((screen.getByLabelText("Record label") as HTMLInputElement).value).toBe("Retained Label");
});

it("shows a processing result instead of claiming pending audio is ready", async () => {
  const user = userEvent.setup(); open(); await basics(user); await audio(user);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  mocks.complete.mockResolvedValueOnce({ track: { id: "track", title: "Song", playbackReady: false, status: "processing" } });
  await user.click(screen.getByRole("button", { name: "Save track draft" }));
  await screen.findByText("Song was uploaded. Audio is processing.");
  expect(screen.queryByText("Song is ready for a release.")).toBeNull();
  expect(screen.getByRole("link", { name: "Check recording status" }).getAttribute("href")).toBe("/dashboard/tracks/track");
});
