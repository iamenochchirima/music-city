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
  return (
    <output aria-label="Destination">
      {l.pathname + l.search} · {l.state?.files?.length ?? 0} files
    </output>
  );
}
it("starts with music and carries multiple files into a durable partial draft", async () => {
  const user = userEvent.setup();
  create.mockResolvedValue({ id: "saved" });
  render(
    <MemoryRouter>
      <ReleaseCreateOverview />
      <Location />
    </MemoryRouter>,
  );
  expect(screen.queryByLabelText("Title")).toBeNull();
  await user.upload(screen.getByLabelText("Audio files"), [
    new File(["a"], "One.wav", { type: "audio/wav" }),
    new File(["b"], "Two.wav", { type: "audio/wav" }),
  ]);
  await waitFor(() =>
    expect(screen.getByLabelText("Destination").textContent).toContain(
      "/dashboard/releases/saved?step=music · 2 files",
    ),
  );
  expect(create).toHaveBeenCalledWith("token", {
    title: "",
    genre: "",
    type: "single",
    artistName: "Artist",
  });
});
it("recovers a failed draft request without asking for repeated details", async () => {
  const user = userEvent.setup();
  create
    .mockRejectedValueOnce(new Error("Connection interrupted"))
    .mockResolvedValueOnce({ id: "saved" });
  render(
    <MemoryRouter>
      <ReleaseCreateOverview />
      <Location />
    </MemoryRouter>,
  );
  await user.click(screen.getByRole("button", { name: "Choose from library" }));
  expect((await screen.findByRole("alert")).textContent).toContain(
    "Connection interrupted",
  );
  await user.click(screen.getByRole("button", { name: "Choose from library" }));
  await waitFor(() =>
    expect(screen.getByLabelText("Destination").textContent).toContain(
      "saved?step=music",
    ),
  );
});
