import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TrackMetadataEditor, emptyTrackMetadata, validateTrackMetadata, type TrackMetadataDraft } from "./track-metadata-editor";
afterEach(cleanup);
function Form() {
  const [value, setValue] = useState(emptyTrackMetadata);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState("");
  return <><TrackMetadataEditor value={value} onChange={setValue} artists={[]} errors={errors} />
    <button onClick={() => { const checked = validateTrackMetadata(value); setErrors(checked.errors); if (checked.result.success) setSaved(JSON.stringify(checked.result.data)); }}>Save</button>
    <output aria-label="Saved metadata">{saved}</output></>;
}
it("supports multiple composers, author credits, and publisher organizations without profiles", async () => {
  const user = userEvent.setup(); render(<Form />);
  for (const [role, name] of [["composer", "One"], ["composer", "Two"], ["lyricist", "Writer"], ["publisher", "Publisher Ltd"]]) {
    await user.click(screen.getByRole("button", { name: "Add contributor" }));
    const rows = screen.getAllByLabelText(/Role \d/);
    await user.selectOptions(rows.at(-1)!, role);
    await user.type(screen.getAllByLabelText(/Contributor name/).at(-1)!, name);
  }
  await user.type(screen.getByLabelText("Existing ISRC"), "us-rc1-76-07839");
  await user.type(screen.getByLabelText("Record label"), " Label ");
  await user.click(screen.getByRole("button", { name: "Save" }));
  const saved = JSON.parse(screen.getByLabelText("Saved metadata").textContent!);
  expect(saved.credits.map((c: { role: string }) => c.role)).toEqual(["composer", "composer", "lyricist", "publisher"]);
  expect(saved.isrc).toBe("USRC17607839"); expect(saved.recordLabel).toBe("Label");
});
it("shows field errors for incomplete rows and invalid ISRC and allows removing the row", async () => {
  const user = userEvent.setup(); render(<Form />);
  await user.click(screen.getByRole("button", { name: "Add contributor" }));
  await user.type(screen.getByLabelText("Existing ISRC"), "invalid");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByLabelText("Contributor name 1").getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByLabelText("Existing ISRC").getAttribute("aria-invalid")).toBe("true");
  expect(screen.getAllByRole("alert")).toHaveLength(2);
  await user.click(screen.getByRole("button", { name: "Remove contributor 1" }));
  await user.clear(screen.getByLabelText("Existing ISRC"));
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(JSON.parse(screen.getByLabelText("Saved metadata").textContent!)).toEqual({ credits: [], isrc: "", recordLabel: "" });
});

it("preserves a selected profile when its optional control is hidden and restores focus after removal", async () => {
  function LinkedForm() {
    const [value, setValue] = useState<TrackMetadataDraft>({ ...emptyTrackMetadata(), credits: [{ role: "composer" as const, name: "Composer", artistId: "artist-1" }] });
    return <TrackMetadataEditor value={value} onChange={setValue} artists={[]} />;
  }
  const user = userEvent.setup(); render(<LinkedForm />);
  expect(screen.queryByLabelText("Linked profile 1")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Show linked profile 1" }));
  expect(screen.getByLabelText("Linked profile 1").textContent).toContain("Existing linked profile");
  await user.click(screen.getByRole("button", { name: "Hide linked profile 1" }));
  await user.click(screen.getByRole("button", { name: "Show linked profile 1" }));
  expect(screen.getByLabelText("Linked profile 1").textContent).toContain("Existing linked profile");
  await user.click(screen.getByRole("button", { name: "Remove contributor 1" }));
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Add contributor" }));
});

it("identifies duplicate normalized credits beside the second contributor", async () => {
  const user = userEvent.setup(); render(<Form />);
  await user.click(screen.getByRole("button", { name: "Add contributor" }));
  await user.type(screen.getByLabelText("Contributor name 1"), "Same Contributor");
  await user.click(screen.getByRole("button", { name: "Add contributor" }));
  await user.type(screen.getByLabelText("Contributor name 2"), " same contributor ");
  await user.click(screen.getByRole("button", { name: "Save" }));
  expect(screen.getByLabelText("Contributor name 2").getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByRole("alert").textContent).toContain("already has this credit");
  expect(screen.getByLabelText("Saved metadata").textContent).toBe("");
});
