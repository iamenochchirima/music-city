import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { UserProfile } from "@music-city/shared";
import { NotificationSettings } from "./notification-settings";
const updateProfile = vi.hoisted(() => vi.fn());
vi.mock("@/features/users/lib/users-api", () => ({
  usersApi: { updateProfile },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const profile = {
  email: "artist@example.test",
  notificationPreferences: {
    releaseNotifications: true,
    artistUpdates: false,
    productUpdates: false,
  },
} as UserProfile;
it("saves the profile email and optional choices without offering a transactional opt-out", async () => {
  const user = userEvent.setup();
  const saved = vi.fn();
  updateProfile.mockResolvedValue(profile);
  render(
    <NotificationSettings profile={profile} token="session" onSaved={saved} />,
  );
  await user.click(screen.getByRole("checkbox", { name: "Music City news" }));
  await user.click(screen.getByRole("button", { name: "Save preferences" }));
  expect(
    await screen.findByText("Notification preferences saved."),
  ).toBeTruthy();
  expect(updateProfile).toHaveBeenCalledWith("session", {
    email: "artist@example.test",
    notificationPreferences: {
      releaseNotifications: true,
      artistUpdates: false,
      productUpdates: true,
    },
  });
  expect(screen.getAllByRole("checkbox")).toHaveLength(3);
  expect(saved).toHaveBeenCalledWith(profile);
});
it("shows save errors and retains editable choices", async () => {
  const user = userEvent.setup();
  updateProfile.mockRejectedValue(new Error("offline"));
  render(
    <NotificationSettings
      profile={profile}
      token="session"
      onSaved={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Save preferences" }));
  expect(await screen.findByText(/Could not save/)).toBeTruthy();
  expect(
    screen
      .getByRole("button", { name: "Save preferences" })
      .hasAttribute("disabled"),
  ).toBe(false);
});
