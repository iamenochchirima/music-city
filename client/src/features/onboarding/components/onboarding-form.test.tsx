import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { ApiClientError } from "@/lib/api/http-client";
import { OnboardingForm } from "./onboarding-form";

const mocks = vi.hoisted(() => ({ state: vi.fn(), save: vi.fn(), complete: vi.fn(), refresh: vi.fn(), quote: vi.fn(), artists: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: { token: "token", walletAddress: "GTEST", displayName: "", primaryIntent: "listener", onboardingStatus: "not_started", onboardingStep: "identity" }, refreshSessionProfile: mocks.refresh }) }));
vi.mock("@/features/users/lib/users-api", () => ({ usersApi: { getOnboardingState: mocks.state, saveOnboardingStep: mocks.save, completeOnboarding: mocks.complete, listArtists: mocks.artists } }));
vi.mock("@/features/sponsorships/sponsorships-api", () => ({ sponsorshipsApi: { getMyArtistActivation: mocks.quote } }));
vi.mock("@/lib/analytics", () => ({ trackEvent: vi.fn() }));
const quote = { currency: "USD", originalAmountMinor: 2000, discountAmountMinor: 2000, discountPercent: 100, amountDueMinor: 0, campaignCode: "EARLYUSER", termsRevision: "v1", status: "eligible", artistAccess: false, profileExists: true, activatedAt: null };
beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear();
  mocks.state.mockResolvedValue(null); mocks.save.mockResolvedValue({ id: "profile" }); mocks.complete.mockResolvedValue({ id: "profile" }); mocks.refresh.mockResolvedValue(undefined); mocks.quote.mockResolvedValue(quote); mocks.artists.mockResolvedValue([{id:"artist-1",name:"Axe Ray",city:"South Africa"}]);
  HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);
async function open(onCompleted = vi.fn()) {
  render(<MemoryRouter><OnboardingForm onCompleted={onCompleted} /></MemoryRouter>);
  await screen.findByLabelText("Display name");
  return onCompleted;
}
const completedListenerProfile = {
  id: "profile-1",
  walletAddress: "GTEST",
  email: "",
  displayName: "Listener",
  primaryIntent: "listener" as const,
  artistAccess: false,
  onboardingStatus: "complete" as const,
  onboardingStep: "complete" as const,
  onboardingVersion: 1,
  location: "",
  genres: [],
  favoriteArtistIds: [],
  interestedInLocalMusic: false,
  notificationPreferences: {
    releaseNotifications: true,
    artistUpdates: true,
    productUpdates: false,
  },
  bio: "",
  socialLinks: {},
  verified: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
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
it("opens the artist choice for a completed listener without changing their profile", async () => {
  mocks.state.mockResolvedValue({
    profile: completedListenerProfile,
    onboardingStatus: "complete",
    onboardingStep: "complete",
  });
  render(
    <MemoryRouter>
      <OnboardingForm startArtistSetup />
    </MemoryRouter>,
  );

  await screen.findByRole("heading", { name: "How will you use Music City?" });
  expect(
    (screen.getByRole("radio", { name: /I’m an artist/ }) as HTMLInputElement)
      .checked,
  ).toBe(true);
  expect(mocks.save).not.toHaveBeenCalled();
  expect(mocks.complete).not.toHaveBeenCalled();
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
it("completes the listener branch with genres and follows only at the end", async () => {
  const user = userEvent.setup(); const completed = await open(); await identity(user);
  await user.click(screen.getByRole("button", {name:"Continue"}));
  await screen.findByLabelText("Profile image");
  expect(screen.queryByText("Artists to follow")).toBeNull();
  await user.click(screen.getByRole("button", {name:"Skip for now"}));
  await screen.findByRole("heading", {name:"Find your artists"});
  for (const name of ["Traditional","Dance","Kwaito","Amapiano","Maskandi","R&B / Soul"]) expect(screen.getByRole("button",{name})).toBeTruthy();
  for (const name of ["Traditional","Dance","Kwaito","Amapiano","Maskandi"]) await user.click(screen.getByRole("button",{name}));
  expect(screen.getByRole("button",{name:"R&B / Soul"}).hasAttribute("disabled")).toBe(true);
  await user.click(await screen.findByRole("checkbox", {name:/Axe Ray/}));
  await user.click(screen.getByRole("button",{name:"Back"}));
  await screen.findByLabelText("Profile image");
  await user.click(screen.getByRole("button",{name:"Skip for now"}));
  expect(screen.getByRole("button",{name:"Maskandi"}).getAttribute("aria-pressed")).toBe("true");
  await user.click(screen.getByRole("button",{name:"Finish setup"}));
  await screen.findByText("Your listening space is ready.");
  expect(mocks.save).toHaveBeenLastCalledWith("token",expect.objectContaining({step:"personalize",genres:["Traditional","Dance","Kwaito","Amapiano","Maskandi"],favoriteArtistIds:["artist-1"]}));
  expect(screen.getByRole("progressbar").getAttribute("aria-valuenow")).toBe("100");
  await user.click(screen.getByRole("button",{name:"Explore music"}));
  expect(completed).toHaveBeenCalledWith("listener","/discover");
});
it.each(["artist", "both"] as const)("completes %s with genres asked once and artist recommendations last", async intent => {
  const user = userEvent.setup(); const completed = await open(); await identity(user);
  await user.click(screen.getAllByRole("radio")[intent === "artist" ? 1 : 2]);
  await waitFor(() => expect(screen.getByRole("button", {name:"Continue"}).hasAttribute("disabled")).toBe(false));
  await user.click(screen.getByRole("button", {name:"Continue"}));
  await screen.findByText("Your early-user discount is applied");
  await user.click(screen.getByRole("button",{name:"Continue to artist profile"}));
  await screen.findByLabelText("Short biography");
  expect(screen.queryByText("Artists to follow")).toBeNull();
  expect(screen.queryByLabelText("SoundCloud")).toBeNull();
  await user.type(screen.getByLabelText("Facebook"),"https://facebook.com/testartist");
  await user.type(screen.getByLabelText("Short biography"),"Artist biography");
  await user.click(screen.getByRole("button",{name:"Maskandi"}));
  await user.click(screen.getByRole("button",{name:"Continue"}));
  await screen.findByLabelText("Header image");
  await user.click(screen.getByRole("button",{name:"Skip for now"}));
  await screen.findByRole("heading",{name:"Find your artists"});
  expect(screen.queryByText("Favorite genres")).toBeNull();
  expect(screen.queryByText("Primary genres")).toBeNull();
  expect(mocks.complete).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button",{name:"Back"}));
  await user.click(screen.getByRole("button",{name:"Back"}));
  expect((screen.getByLabelText("Short biography") as HTMLTextAreaElement).value).toBe("Artist biography");
  expect((screen.getByLabelText("Facebook") as HTMLInputElement).value).toBe("https://facebook.com/testartist");
  expect(screen.getByRole("button",{name:"Maskandi"}).getAttribute("aria-pressed")).toBe("true");
  await user.click(screen.getByRole("button",{name:"Continue"}));
  await user.click(screen.getByRole("button",{name:"Skip for now"}));
  await user.click(screen.getByRole("button",{name:"Skip for now"}));
  await screen.findByText("Your artist workspace is ready.");
  expect(mocks.save).toHaveBeenCalledWith("token",expect.objectContaining({step:"artist_identity",genres:["Maskandi"],socialLinks:expect.objectContaining({facebook:"https://facebook.com/testartist"})}));
  expect(mocks.complete).toHaveBeenCalledOnce();
  await user.click(screen.getByRole("button",{name:"Back"}));
  await screen.findByRole("heading",{name:"Find your artists"});
  await user.click(screen.getByRole("button",{name:"Skip for now"}));
  await screen.findByText("Your artist workspace is ready.");
  await user.click(screen.getByRole("button",{name:"Create your first release"}));
  expect(completed).toHaveBeenCalledWith(intent,"/dashboard/create");
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
