import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { ArtistAccessGate } from "./artist-access-gate";

const mocks = vi.hoisted(() => ({
  session: {
    token: "test-token",
    primaryIntent: "listener",
    artistAccess: false,
  },
}));

vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ session: mocks.session }),
}));

const CurrentLocation = () => {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
};

afterEach(cleanup);

it("takes a listener directly to artist setup instead of the completed listener screen", async () => {
  const user = userEvent.setup();
  render(
    <MemoryRouter initialEntries={["/dashboard"]}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <>
              <ArtistAccessGate action="upload and release music" />
              <CurrentLocation />
            </>
          }
        />
        <Route path="/onboarding" element={<CurrentLocation />} />
      </Routes>
    </MemoryRouter>,
  );

  await user.click(screen.getByRole("button", { name: "Set up artist profile" }));
  expect(screen.getByTestId("location").textContent).toBe(
    "/onboarding?intent=artist",
  );
});
