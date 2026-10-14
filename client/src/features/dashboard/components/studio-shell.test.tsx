import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { StudioShell } from "./studio-shell";

afterEach(cleanup);
function Destination() { return <output aria-label="Current route">{useLocation().pathname}</output>; }
it("marks the containing section active without marking Overview on detail pages", () => {
  render(<MemoryRouter initialEntries={["/dashboard/tracks/track-1"]}><StudioShell><Destination /></StudioShell></MemoryRouter>);
  expect(screen.getByRole("link", { name: "Tracks" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Overview" }).hasAttribute("aria-current")).toBe(false);
  expect((screen.getByLabelText("Artist Studio") as HTMLSelectElement).value).toBe("/dashboard/tracks");
});
it("navigates through the compact Studio selector", async () => {
  const user = userEvent.setup();
  render(<MemoryRouter initialEntries={["/dashboard"]}><StudioShell><Destination /></StudioShell></MemoryRouter>);
  await user.selectOptions(screen.getByLabelText("Artist Studio"), "/dashboard/releases");
  expect(screen.getByLabelText("Current route").textContent).toBe("/dashboard/releases");
  expect(screen.getByRole("link", { name: "Releases" }).getAttribute("aria-current")).toBe("page");
  expect(screen.getByRole("link", { name: "Overview" }).hasAttribute("aria-current")).toBe(false);
});
