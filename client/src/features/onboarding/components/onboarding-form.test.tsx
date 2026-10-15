import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiClientError } from "@/lib/api/http-client";
import { OnboardingForm } from "./onboarding-form";

const mocks = vi.hoisted(() => ({ state: vi.fn(), save: vi.fn(), complete: vi.fn(), refresh: vi.fn(), quote: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: { token: "token", walletAddress: "GTEST", displayName: "", primaryIntent: "listener", onboardingStatus: "not_started", onboardingStep: "identity" }, refreshSessionProfile: mocks.refresh }) }));
vi.mock("@/features/users/lib/users-api", () => ({ usersApi: { getOnboardingState: mocks.state, saveOnboardingStep: mocks.save, completeOnboarding: mocks.complete, listArtists: async () => [] } }));
vi.mock("@/features/sponsorships/sponsorships-api", () => ({ sponsorshipsApi: { getMyArtistActivation: mocks.quote } }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
const quote = { currency: "USD", originalAmountMinor: 2000, discountAmountMinor: 2000, discountPercent: 100, amountDueMinor: 0, campaignCode: "EARLYUSER", termsRevision: "v1", status: "eligible", artistAccess: false, profileExists: true, activatedAt: null };
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  mocks.state.mockResolvedValue(null); mocks.save.mockResolvedValue({ id: "profile" }); mocks.complete.mockResolvedValue({ id: "profile" }); mocks.refresh.mockResolvedValue(undefined); mocks.quote.mockResolvedValue(quote);
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);
async function open(onCompleted = vi.fn()) {
  render(<MemoryRouter><OnboardingForm onCompleted={onCompleted} /></MemoryRouter>);
  await screen.findByLabelText("Display name");
  return onCompleted;
}
async function identity(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Display name"), "New Artist");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "How will you use Music City?" });
}
it("blocks an incomplete identity and focuses its associated field error", async () => {
  const user = userEvent.setup(); await open();
  await user.click(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByLabelText("Display name").getAttribute("aria-invalid")).toBe("true");
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Display name")));
  expect(mocks.save).not.toHaveBeenCalled();
});
it("shows a profile-load retry instead of an editable partial form", async () => {
  mocks.state.mockRejectedValueOnce(new Error("Profile unavailable"));
  const user = userEvent.setup(); render(<MemoryRouter><OnboardingForm /></MemoryRouter>);
  await screen.findByText("Profile unavailable");
  expect(screen.queryByLabelText("Display name")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Retry profile load" }));
  await screen.findByLabelText("Display name");
  expect(mocks.state).toHaveBeenCalledTimes(2);
});
it("retains identity values after a failed save and permits retry", async () => {
  const user = userEvent.setup(); await open();
  await user.type(screen.getByLabelText("Display name"), "Retained Name");
  mocks.save.mockRejectedValueOnce(new ApiClientError("Email rejected", 400, undefined, { email: "Use a valid email address." }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByText("Use a valid email address.");
  expect((screen.getByLabelText("Display name") as HTMLInputElement).value).toBe("Retained Name");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "How will you use Music City?" });
});
it("completes the listener branch with optional skips and its listening destination", async () => {
  const user = userEvent.setup(); const completed = await open(); await identity(user);
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByRole("heading", { name: "Help us find your sound." });
  await user.click(screen.getByRole("button", { name: "Afrobeats" }));
  await user.click(screen.getByRole("button", { name: "Skip for now" }));
  await screen.findByLabelText("Profile image");
  expect(screen.queryByLabelText("Header image")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Skip for now" }));
  await screen.findByText("Your listening space is ready.");
  expect(mocks.save.mock.calls.map(([, input]) => input.step)).toEqual(["identity", "intent", "personalize", "visuals"]);
  expect(mocks.save).toHaveBeenCalledWith("token", expect.objectContaining({ step: "personalize", genres: ["Afrobeats"] }));
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  await user.click(screen.getByRole("button", { name: "Explore music" }));
  expect(completed).toHaveBeenCalledWith("listener", "/discover");
});
it.each(["artist", "both"] as const)("completes the %s branch without losing artist choices or the activation offer", async intent => {
  const user = userEvent.setup(); const completed = await open(); await identity(user);
  await user.click(screen.getAllByRole("radio")[intent === "artist" ? 1 : 2]);
  await waitFor(() => expect(screen.getByRole("button", { name: "Continue" }).hasAttribute("disabled")).toBe(false));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByText("Your early-user discount is applied");
  await user.click(screen.getByRole("button", { name: intent === "artist" ? "Continue to artist profile" : "Continue to listening setup" }));
  if (intent === "both") { await screen.findByRole("heading", { name: "Help us find your sound." }); await user.click(screen.getByRole("button", { name: "Skip for now" })); }
  await screen.findByLabelText("Short biography");
  await user.type(screen.getByLabelText("Short biography"), "Artist biography");
  await user.click(screen.getByRole("button", { name: "Afrobeats" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await screen.findByLabelText("Header image");
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect((screen.getByLabelText("Short biography") as HTMLTextAreaElement).value).toBe("Artist biography");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Skip for now" }));
  await screen.findByText("Your artist workspace is ready.");
  expect(mocks.save).toHaveBeenCalledWith("token", expect.objectContaining({ step: "artist_identity", bio: "Artist biography", genres: ["Afrobeats"] }));
  expect(mocks.complete).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button", { name: "Back" }));
  await screen.findByLabelText("Header image");
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect((screen.getByLabelText("Short biography") as HTMLTextAreaElement).value).toBe("Artist biography");
  await user.click(screen.getByRole("button", { name: "Continue" }));
  await user.click(screen.getByRole("button", { name: "Skip for now" }));
  await screen.findByText("Your artist workspace is ready.");
  await user.click(screen.getByRole("button", { name: "Create your first release" }));
  expect(completed).toHaveBeenCalledWith(intent, "/dashboard/create");
});
it("offers activation retry before continuing when the quote request fails", async () => {
  const user = userEvent.setup(); await open(); await identity(user);
  mocks.quote.mockRejectedValueOnce(new Error("Offer unavailable"));
  await user.click(screen.getAllByRole("radio")[1]);
  await screen.findByText("Offer unavailable");
  expect(screen.getByRole("button", { name: "Continue" }).hasAttribute("disabled")).toBe(true);
  await user.click(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Continue" }).hasAttribute("disabled")).toBe(false));
});
