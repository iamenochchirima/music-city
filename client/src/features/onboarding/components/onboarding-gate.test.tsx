import type { ReactNode } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { OnboardingGate } from "./onboarding-gate";

const mocks = vi.hoisted(() => ({ session: { walletAddress: "GTEST", onboardingStatus: "in_progress", onboardingStep: "identity" }, refresh: vi.fn(), logout: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: mocks.session, refreshSessionProfile: mocks.refresh, logout: mocks.logout }) }));
vi.mock("./onboarding-form", () => ({ OnboardingForm: ({ onCompleted, onBusyChange, footerActions }: { footerActions?: ReactNode; onCompleted: (intent: string, destination: string) => void; onBusyChange: (busy: boolean) => void }) => <><button onClick={() => onBusyChange(true)}>Start save</button><button onClick={() => onBusyChange(false)}>Finish save</button><button onClick={() => onCompleted("artist", "/dashboard/create")}>Choose upload destination</button>{footerActions}</> }));
beforeEach(() => { vi.clearAllMocks(); mocks.session = { walletAddress: "GTEST", onboardingStatus: "in_progress", onboardingStep: "identity" }; mocks.refresh.mockResolvedValue(undefined); });
afterEach(cleanup);
const element = () => <MemoryRouter initialEntries={["/discover"]}><OnboardingGate /></MemoryRouter>;
it("retains an open modal after session completion until the user chooses a destination", async () => {
  const user = userEvent.setup(); const view = render(element());
  expect(screen.getByRole("dialog", { name: "Music City onboarding" })).toBeTruthy();
  mocks.session = { ...mocks.session, onboardingStatus: "complete", onboardingStep: "complete" };
  view.rerender(element());
  expect(screen.getByRole("dialog", { name: "Music City onboarding" })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Choose upload destination" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(mocks.refresh).toHaveBeenCalledOnce();
});
it("prevents dismissal during required steps and saves, then permits dismissal on an optional step", async () => {
  const user = userEvent.setup(); const view = render(element());
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  mocks.session = { ...mocks.session, onboardingStep: "visuals" }; view.rerender(element());
  await user.click(screen.getByRole("button", { name: "Start save" }));
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  expect(screen.getByRole("button", { name: "Cancel" }).hasAttribute("disabled")).toBe(true);
  await user.click(screen.getByRole("button", { name: "Finish save" }));
  fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
  expect(screen.queryByRole("dialog")).toBeNull();
});
