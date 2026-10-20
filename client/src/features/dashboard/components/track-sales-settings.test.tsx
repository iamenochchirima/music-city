import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TrackSummary } from "@music-city/shared";
import { TrackSalesSettings } from "./track-sales-settings";
const m = vi.hoisted(() => ({ save: vi.fn() }));
vi.mock("@/features/music/lib/tracks-api", () => ({
  tracksApi: { updateTrackMonetization: m.save },
}));
const track = { id: "track", purchaseEnabled: false } as TrackSummary;
function Settings() {
  const [value, setValue] = useState(track);
  return <TrackSalesSettings track={value} token="token" onSaved={setValue} />;
}
beforeEach(() => {
  vi.clearAllMocks();
  m.save.mockImplementation(async (_token, _id, fields) => ({
    ...track,
    ...fields,
  }));
});
afterEach(cleanup);
it("enables exact-price USDC sales and can disable them independently of metadata", async () => {
  const user = userEvent.setup();
  render(<Settings />);
  await user.click(screen.getByLabelText("Let listeners buy this song"));
  await user.type(screen.getByLabelText("Price (USDC)"), "0.0000001");
  await user.click(screen.getByRole("button", { name: "Save sales settings" }));
  await screen.findByText("Sales settings saved");
  expect(m.save).toHaveBeenLastCalledWith("token", "track", {
    purchaseEnabled: true,
    purchasePrice: "0.0000001",
  });
  await user.click(screen.getByLabelText("Let listeners buy this song"));
  await user.click(screen.getByRole("button", { name: "Save sales settings" }));
  expect(m.save).toHaveBeenLastCalledWith("token", "track", {
    purchaseEnabled: false,
    purchasePrice: undefined,
  });
});
it("invalid precision sends no request and a failed save preserves the entered price", async () => {
  const user = userEvent.setup();
  render(<Settings />);
  await user.click(screen.getByLabelText("Let listeners buy this song"));
  await user.type(screen.getByLabelText("Price (USDC)"), "0.00000001");
  await user.click(screen.getByRole("button", { name: "Save sales settings" }));
  expect(m.save).not.toHaveBeenCalled();
  await user.clear(screen.getByLabelText("Price (USDC)"));
  await user.type(screen.getByLabelText("Price (USDC)"), "2.50");
  m.save.mockRejectedValueOnce(new Error("Connection interrupted"));
  await user.click(screen.getByRole("button", { name: "Save sales settings" }));
  await screen.findByText("Connection interrupted");
  expect(
    (screen.getByLabelText("Price (USDC)") as HTMLInputElement).value,
  ).toBe("2.50");
  await user.click(screen.getByRole("button", { name: "Save sales settings" }));
  await screen.findByText("Sales settings saved");
});
