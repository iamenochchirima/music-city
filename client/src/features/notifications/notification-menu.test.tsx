import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { NotificationMenu } from "./notification-menu";
const fetchMock = vi.fn();
const item = {
  id: "a".repeat(64),
  title: "Agreement ready for your approval",
  body: "Review the proposed splits.",
  href: "/account/agreements/demo",
  createdAt: "2026-10-30T10:00:00Z",
  readAt: null,
};
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ items: [item], unreadCount: 1 }),
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
function setup() {
  render(
    <MemoryRouter>
      <NotificationMenu token="session-token" />
    </MemoryRouter>,
  );
}
it("shows unread count, agreement deep link and marks the clicked entry read", async () => {
  const user = userEvent.setup();
  setup();
  await user.click(
    await screen.findByRole("button", { name: "Notifications, 1 unread" }),
  );
  const link = await screen.findByRole("menuitem", { name: /Agreement ready/ });
  expect(link.getAttribute("href")).toBe("/account/agreements/demo");
  await user.click(link);
  await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/${item.id}/read`),
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer session-token" },
      }),
    ),
  );
});
it("supports marking all entries read", async () => {
  const user = userEvent.setup();
  setup();
  await user.click(
    await screen.findByRole("button", { name: "Notifications, 1 unread" }),
  );
  await user.click(
    await screen.findByRole("menuitem", { name: "Mark all as read" }),
  );
  await waitFor(() =>
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/notifications\/read$/),
      expect.objectContaining({ method: "POST" }),
    ),
  );
});
it("shows the empty state and transactional email explanation", async () => {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ items: [], unreadCount: 0 }),
  });
  const user = userEvent.setup();
  setup();
  await user.click(screen.getByRole("button", { name: "Notifications" }));
  expect(await screen.findByText(/You're all caught up/)).toBeTruthy();
  expect(
    screen.getByText(/Agreement, payment and account emails/),
  ).toBeTruthy();
});
it("offers retry on a failed inbox request", async () => {
  fetchMock.mockResolvedValue({ ok: false });
  const user = userEvent.setup();
  setup();
  await user.click(screen.getByRole("button", { name: "Notifications" }));
  expect(await screen.findByRole("button", { name: "Retry" })).toBeTruthy();
});
it("aborts the old recipient's request when the component unmounts", async () => {
  fetchMock.mockImplementation(() => new Promise(() => {}));
  const result = render(
    <MemoryRouter>
      <NotificationMenu token="old-token" />
    </MemoryRouter>,
  );
  const signal = fetchMock.mock.calls[0][1].signal;
  result.unmount();
  expect(signal.aborted).toBe(true);
});
