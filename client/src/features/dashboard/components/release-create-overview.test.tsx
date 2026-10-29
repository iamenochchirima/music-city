import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ReleaseCreateOverview } from "./release-create-overview";
const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  session: { token: "token", primaryIntent: "artist", displayName: "Artist", artistAccess: true } as Record<string, unknown>,
  payment: {
    activationQuote: null as unknown,
    complete: vi.fn(),
    isChecking: false,
    isPaid: true,
    isPaying: false,
    isPreparing: false,
    prepare: vi.fn(),
    refreshStatus: vi.fn(),
  },
  wallet: vi.fn(),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: mocks.session }),
}));
vi.mock("@/features/music/lib/releases-api", () => ({
  releasesApi: { createRelease: mocks.create },
}));
vi.mock("@/features/onboarding/hooks/use-artist-onboarding-payment", () => ({
  useArtistOnboardingPayment: () => mocks.payment,
}));
vi.mock("@/features/wallet/lib/wallet-api", () => ({
  walletApi: { getMe: mocks.wallet },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  Object.assign(mocks.session, {
    token: "token",
    primaryIntent: "artist",
    displayName: "Artist",
    artistAccess: true,
  });
  Object.assign(mocks.payment, {
    activationQuote: null,
    isChecking: false,
    isPaid: true,
    isPaying: false,
    isPreparing: false,
  });
});
function Location() {
  const l = useLocation();
  return <output aria-label="Destination">{l.pathname + l.search}</output>;
}
function open() {
  render(
    <MemoryRouter>
      <ReleaseCreateOverview />
      <Location />
    </MemoryRouter>,
  );
}
it("saves the release name and Single format before choosing audio", async () => {
  const user = userEvent.setup();
  mocks.create.mockResolvedValue({ id: "saved" });
  open();
  expect(screen.queryByLabelText("Audio files")).toBeNull();
  expect(screen.queryByLabelText("How many songs?")).toBeNull();
  await user.type(screen.getByLabelText("Release name"), "After the Rain");
  await user.click(screen.getByRole("button", { name: "Continue to songs" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Destination").textContent).toContain(
      "/dashboard/releases/saved?step=music",
    ),
  );
  expect(mocks.create).toHaveBeenCalledWith("token", {
    title: "After the Rain",
    genre: "",
    type: "single",
    expectedTrackCount: 1,
    artistName: "Artist",
  });
});
it("saves the planned number of songs for an EP", async () => {
  const user = userEvent.setup();
  mocks.create.mockResolvedValue({ id: "saved" });
  open();
  await user.type(screen.getByLabelText("Release name"), "Night Songs");
  await user.click(screen.getByRole("radio", { name: /EP/ }));
  await user.clear(screen.getByLabelText("How many songs?"));
  await user.type(screen.getByLabelText("How many songs?"), "4");
  await user.click(screen.getByRole("button", { name: "Continue to songs" }));
  await waitFor(() =>
    expect(mocks.create).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ type: "ep", expectedTrackCount: 4 }),
    ),
  );
});
it("keeps entered setup when creation fails and permits retry", async () => {
  const user = userEvent.setup();
  mocks.create
    .mockRejectedValueOnce(new Error("Connection interrupted"))
    .mockResolvedValueOnce({ id: "saved" });
  open();
  await user.type(screen.getByLabelText("Release name"), "Keep this name");
  await user.click(screen.getByRole("button", { name: "Continue to songs" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Connection interrupted",
  );
  expect(
    (screen.getByLabelText("Release name") as HTMLInputElement).value,
  ).toBe("Keep this name");
  await user.click(screen.getByRole("button", { name: "Continue to songs" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Destination").textContent).toContain(
      "saved?step=music",
    ),
  );
});
it("does not create an unnamed release", async () => {
  const user = userEvent.setup();
  open();
  await user.click(screen.getByRole("button", { name: "Continue to songs" }));
  expect(screen.getByRole("alert").textContent).toContain(
    "Give your release a name",
  );
  expect(mocks.create).not.toHaveBeenCalled();
});

it("clears release-name feedback as soon as the name is corrected", async () => {
  const user = userEvent.setup();
  open();
  await user.click(screen.getByRole("button", { name: "Continue to songs" }));
  expect(screen.getByText("Give your release a name.")).toBeTruthy();

  await user.type(screen.getByLabelText("Release name"), "Night Songs");

  expect(screen.queryByText("Give your release a name.")).toBeNull();
  expect(mocks.create).not.toHaveBeenCalled();
});

it("shows the activation fee before release setup and keeps payment behind an explicit review", async () => {
  const user = userEvent.setup();
  Object.assign(mocks.session, { artistAccess: false });
  Object.assign(mocks.payment, {
    activationQuote: {
      currency: "USD",
      originalAmountMinor: 2000,
      discountAmountMinor: 0,
      discountPercent: 0,
      amountDueMinor: 2000,
      campaignCode: null,
      termsRevision: null,
      status: "payment_required",
      profileExists: true,
      artistAccess: false,
      activatedAt: null,
    },
    isPaid: false,
  });
  mocks.payment.prepare.mockResolvedValue({
    id: "activation-intent",
    amount: "20",
    assetCode: "USDC",
    walletAddress: "GARTIST",
    destinationAddress: "GTREASURY",
  });
  mocks.wallet.mockResolvedValue({
    exists: true,
    balances: [{ assetKey: "usdc", assetCode: "USDC", availableAmount: "25" }],
  });
  open();

  expect(screen.getByText("$20.00")).toBeTruthy();
  expect(screen.queryByLabelText("Release name")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Review activation" }));
  expect(await screen.findByRole("heading", { name: "Confirm artist activation" })).toBeTruthy();
  expect(mocks.payment.prepare).toHaveBeenCalledOnce();
  expect(mocks.create).not.toHaveBeenCalled();
  expect(mocks.payment.complete).not.toHaveBeenCalled();

  await user.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(mocks.payment.complete).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});
