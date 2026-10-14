import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ReleaseCreateOverview } from "./release-create-overview";
const create=vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-auth",() => ({useAuth:() => ({session:{token:"token",primaryIntent:"artist",displayName:"Artist"}})}));
vi.mock("@/features/music/lib/releases-api",() => ({releasesApi:{createRelease:create}}));
afterEach(() => {cleanup();vi.clearAllMocks();});
function Location(){const location=useLocation();return <output aria-label="Destination">{location.pathname+location.search}</output>;}
it("keeps basics after a failed create, then opens music on the saved draft",async () => {
  const user=userEvent.setup();create.mockRejectedValueOnce(new Error("Connection interrupted")).mockResolvedValueOnce({id:"saved"});
  render(<MemoryRouter><ReleaseCreateOverview /><Location /></MemoryRouter>);
  await user.type(screen.getByLabelText("Title"),"My Single");
  await user.click(screen.getByLabelText("Genre"));await user.click(screen.getByRole("option",{name:"Afrobeats"}));
  await user.click(screen.getByRole("button",{name:"Save draft & continue"}));
  expect((await screen.findByRole("alert")).textContent).toContain("Connection interrupted");
  expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("My Single");
  await user.click(screen.getByRole("button",{name:"Save draft & continue"}));
  await waitFor(() => expect(screen.getByLabelText("Destination").textContent).toBe("/dashboard/releases/saved?step=music"));
  expect(create).toHaveBeenLastCalledWith("token",{title:"My Single",artistName:"Artist",type:"single",genre:"Afrobeats"});
});
it("validates basics before making a draft",async () => {
  const user=userEvent.setup();render(<MemoryRouter><ReleaseCreateOverview /></MemoryRouter>);
  await user.click(screen.getByRole("button",{name:"Save draft & continue"}));
  expect(create).not.toHaveBeenCalled();
  expect(screen.getByLabelText("Title").getAttribute("aria-invalid")).toBe("true");
});
