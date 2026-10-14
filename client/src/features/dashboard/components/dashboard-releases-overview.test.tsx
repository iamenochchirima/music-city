import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { DashboardReleasesOverview } from "./dashboard-releases-overview";

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn() }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ session: { token: "token", primaryIntent: "artist", displayName: "Artist" } }) }));
vi.mock("@/features/music/lib/releases-api", () => ({ releasesApi: { listMyReleases: mocks.list, createRelease: mocks.create } }));
const releases = [{ id: "draft", title: "Draft single", type: "single", status: "draft", trackCount: 1 }, { id: "live", title: "Published album", type: "album", status: "published", trackCount: 8 }];
beforeEach(() => { vi.clearAllMocks(); mocks.list.mockResolvedValue(releases); mocks.create.mockResolvedValue({ id: "new" }); });
afterEach(cleanup);
function Location() { return <output aria-label="Destination">{useLocation().pathname}</output>; }
async function open() { render(<MemoryRouter><DashboardReleasesOverview /><Location /></MemoryRouter>); await screen.findByRole("link", { name: "Draft single" }); }
it("filters the catalog by publication status", async () => {
  const user = userEvent.setup(); await open();
  await user.selectOptions(screen.getByLabelText("Status"), "published");
  expect(screen.getByRole("link", { name: "Published album" })).toBeTruthy();
  expect(screen.queryByRole("link", { name: "Draft single" })).toBeNull();
  await user.selectOptions(screen.getByLabelText("Status"), "scheduled");
  expect(screen.getByRole("heading", { name: "No releases with this status" })).toBeTruthy();
});
it("starts the guided release flow from the library", async () => {
  const user=userEvent.setup(); await open();
  await user.click(screen.getByRole("button",{name:"New release"}));
  expect(screen.getByLabelText("Destination").textContent).toBe("/dashboard/releases/new");
});
