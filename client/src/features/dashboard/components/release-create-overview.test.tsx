import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ReleaseCreateOverview } from "./release-create-overview";
const create = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({
    session: { token: "token", primaryIntent: "artist", displayName: "Artist" },
  }),
}));
vi.mock("@/features/music/lib/releases-api", () => ({
  releasesApi: { createRelease: create },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
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
  create.mockResolvedValue({ id: "saved" });
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
  expect(create).toHaveBeenCalledWith("token", {
    title: "After the Rain",
    genre: "",
    type: "single",
    expectedTrackCount: 1,
    artistName: "Artist",
  });
});
it("saves the planned number of songs for an EP", async () => {
  const user = userEvent.setup();
  create.mockResolvedValue({ id: "saved" });
  open();
  await user.type(screen.getByLabelText("Release name"), "Night Songs");
  await user.click(screen.getByRole("radio", { name: /EP/ }));
  await user.clear(screen.getByLabelText("How many songs?"));
  await user.type(screen.getByLabelText("How many songs?"), "4");
  await user.click(screen.getByRole("button", { name: "Continue to songs" }));
  await waitFor(() =>
    expect(create).toHaveBeenCalledWith(
      "token",
      expect.objectContaining({ type: "ep", expectedTrackCount: 4 }),
    ),
  );
});
it("keeps entered setup when creation fails and permits retry", async () => {
  const user = userEvent.setup();
  create
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
  expect(create).not.toHaveBeenCalled();
});
