import { useState } from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchablePicker } from "./searchable-picker";
import { FormField } from "./form-field";

afterEach(cleanup);
function Picker() {
  const [value, setValue] = useState("");
  return <FormField id="genre" label="Genre" hint="Choose the primary genre." error="Choose a genre.">
    <SearchablePicker id="genre" value={value} onValueChange={setValue} options={["Afrobeats", "Pop"]} placeholder="Select genre" searchPlaceholder="Search genres" />
  </FormField>;
}
it("associates shared field hints and errors with the picker and supports keyboard selection", async () => {
  const user = userEvent.setup(); render(<Picker />);
  const trigger = screen.getByLabelText("Genre"); trigger.focus();
  expect(trigger.getAttribute("aria-describedby")).toBe("genre-help genre-error");
  expect(trigger.getAttribute("aria-invalid")).toBe("true");
  await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
  expect(trigger.textContent).toBe("Afrobeats");
  expect(document.activeElement).toBe(trigger);
  expect(screen.queryByRole("listbox")).toBeNull();
  await user.click(trigger); await user.keyboard("{Escape}");
  expect(screen.queryByRole("listbox")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

it("moves from the trigger to the last option with ArrowUp", async () => {
  const user = userEvent.setup(); render(<Picker />);
  const trigger = screen.getByLabelText("Genre");
  await user.click(trigger); await user.keyboard("{ArrowUp}{Enter}");
  expect(trigger.textContent).toBe("Pop");
  expect(document.activeElement).toBe(trigger);
});

it("searches readable labels while storing the selected profile identifier", async () => {
  function Profiles() {
    const [value, setValue] = useState("");
    return <><FormField id="artist" label="Artist"><SearchablePicker id="artist" value={value} onValueChange={setValue} options={Array.from({ length: 10 }, (_, i) => ({ value: `artist-${i}`, label: `Artist Name ${i}` }))} placeholder="Choose artist" searchPlaceholder="Search profiles" /></FormField><output aria-label="Selected identifier">{value}</output></>;
  }
  const user = userEvent.setup(); render(<Profiles />);
  await user.click(screen.getByLabelText("Artist"));
  await user.type(screen.getByLabelText("Search profiles"), "Name 8");
  await user.click(screen.getByRole("option", { name: "Artist Name 8" }));
  expect(screen.getByLabelText("Selected identifier").textContent).toBe("artist-8");
  expect(screen.getByLabelText("Artist").textContent).toContain("Artist Name 8");
});
