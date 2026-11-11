import { useState } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackMetadataEditor, emptyTrackMetadata } from "./track-metadata-editor";
import type { ContributorSummary } from "@music-city/shared";

const search = vi.hoisted(() => vi.fn());
vi.mock("@/features/users/lib/users-api", () => ({ usersApi: { searchContributors: search } }));
const profiles: ContributorSummary[] = [
  { id: "listener-1", name: "Nadia", walletAddress: `G${"A".repeat(51)}ABCD` },
  { id: "listener-2", name: "Nadia", walletAddress: `G${"B".repeat(51)}EFGH` },
];
afterEach(cleanup);
beforeEach(() => { search.mockReset(); });
function Form() {
  const [value, setValue] = useState(emptyTrackMetadata);
  return <><TrackMetadataEditor value={value} onChange={setValue} artists={[]} searchToken="test-token" />
    <output aria-label="Draft">{JSON.stringify(value)}</output></>;
}
it("searches users from the name field and links the chosen wallet without requiring artist status", async () => {
  search.mockResolvedValue(profiles);
  const user = userEvent.setup(); render(<Form />);
  await user.click(screen.getByRole("button", { name: "Add contributor" }));
  const input = screen.getByRole("combobox", { name: "Contributor name 1" });
  await user.type(input, "Na");
  const options = await screen.findAllByRole("option", { name: /Nadia/ });
  expect(search).toHaveBeenCalledWith("test-token", "Na");
  expect(options[1].textContent).toContain("EFGH");
  await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
  expect(JSON.parse(screen.getByLabelText("Draft").textContent!).credits[0]).toEqual({ role: "composer", name: "Nadia", artistId: "listener-2" });
  expect(screen.queryByRole("listbox")).toBeNull();
  await user.type(input, " Smith");
  expect(JSON.parse(screen.getByLabelText("Draft").textContent!).credits[0]).toEqual({ role: "composer", name: "Nadia Smith" });
});
it("keeps manual credits usable when user search fails and supports dismissing results", async () => {
  search.mockRejectedValue(new Error("offline"));
  const user = userEvent.setup(); render(<Form />);
  await user.click(screen.getByRole("button", { name: "Add contributor" }));
  await user.type(screen.getByLabelText("Contributor name 1"), "Publisher");
  expect(await screen.findByText(/Couldn't search users/)).toBeTruthy();
  expect(JSON.parse(screen.getByLabelText("Draft").textContent!).credits[0]).toEqual({ role: "composer", name: "Publisher" });
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("listbox")).toBeNull();
});
it("does not replace newer results with a slow response from an earlier query", async () => {
  let finishOld!: (items: ContributorSummary[]) => void;
  search.mockImplementation((_token: string, query: string) => query === "Na" ? new Promise(resolve => { finishOld = resolve; }) : Promise.resolve([{ ...profiles[0], name: "Natalie" }]));
  const user = userEvent.setup(); render(<Form />);
  await user.click(screen.getByRole("button", { name: "Add contributor" }));
  await user.type(screen.getByLabelText("Contributor name 1"), "Na");
  await waitFor(() => expect(search).toHaveBeenCalledWith("test-token", "Na"));
  await user.type(screen.getByLabelText("Contributor name 1"), "t");
  expect(await screen.findByRole("option", { name: /Natalie/ })).toBeTruthy();
  finishOld(profiles);
  await waitFor(() => expect(screen.queryByRole("option", { name: /Nadia/ })).toBeNull());
});
