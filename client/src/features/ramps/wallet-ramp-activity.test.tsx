import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { WalletRampActivity } from "./wallet-ramp-activity";
const mock = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock("@/lib/api/http-client", () => ({ httpClient: { get: mock.get, post: mock.post } }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("clears the previous session's history and details before a new session can load them", async () => {
  const order = { id: "saved", direction: "buy", provider: "moonpay", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, launchRequested: true, providerStarted: true, providerState: "processing", chainState: "unobserved", amount: { currency: "GBP", units: "1250", decimals: 2 }, createdAt: "2026-10-29T09:00:00Z" };
  let resolveHistory!: (result: { items: unknown[] }) => void;
  let rejectDetail!: (error: Error) => void;
  mock.get.mockImplementation((path: string, token: string) => {
    if (path === "/ramps/capabilities") return Promise.resolve({ routes: [] });
    if (token === "first-session") return Promise.resolve(path === "/ramps" ? { items: [order] } : { order });
    if (path === "/ramps") return new Promise((resolve) => { resolveHistory = resolve; });
    return new Promise((_resolve, reject) => { rejectDetail = reject; });
  });
  const view = render(<MemoryRouter initialEntries={["/account?ramp=saved"]}><WalletRampActivity token="first-session" /></MemoryRouter>);
  expect(await screen.findByText("12.50 GBP · GB · Card")).toBeTruthy();

  view.rerender(<MemoryRouter><WalletRampActivity token="second-session" /></MemoryRouter>);
  expect(screen.queryAllByText(/12\.50 GBP/)).toHaveLength(0);
  expect(screen.getByText("Loading transaction…")).toBeTruthy();
  await act(async () => {
    resolveHistory({ items: [] });
    rejectDetail(new Error("Not found"));
  });
  expect(await screen.findByText("Could not load this transaction.")).toBeTruthy();
  expect(screen.queryAllByText(/12\.50 GBP/)).toHaveLength(0);
});
function renderActivity(child: ReactNode, initialEntries = ["/account"]) {
  function LocationProbe() {
    const location = useLocation();
    return <output data-testid="current-url">{location.pathname}{location.search}</output>;
  }
  return render(<MemoryRouter initialEntries={initialEntries}>{child}<LocationProbe /></MemoryRouter>);
}
it("offers a visible close action while saved transaction details load or fail", async () => {
  let rejectDetail!: (error: Error) => void;
  mock.get.mockImplementation((path: string) => {
    if (path === "/ramps/capabilities") return Promise.resolve({ routes: [] });
    if (path === "/ramps") return Promise.resolve({ items: [] });
    return new Promise((_resolve, reject) => { rejectDetail = reject; });
  });
  renderActivity(<WalletRampActivity token="session" />, ["/account?section=wallet&ramp=missing"]);
  expect(screen.getByText("Loading transaction…")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  await act(async () => rejectDetail(new Error("Not found")));
  expect(await screen.findByText("Could not load this transaction.")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(screen.getByTestId("current-url").textContent).toBe("/account?section=wallet");
});
it("keeps unavailable options disabled and distinguishes provider completion from delivery", async () => {
  mock.get.mockResolvedValue({ items: [{ id: "one", direction: "buy", providerState: "completed", chainState: "unobserved", amount: { currency: "GBP", units: "10000", decimals: 2 }, createdAt: "2026-10-28T00:00:00Z" }] });
  renderActivity(<WalletRampActivity token="session" />);
  expect(screen.getByRole("button", { name: "Add funds" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByRole("button", { name: "Cash out" }).hasAttribute("disabled")).toBe(true);
  expect(await screen.findByText("Provider completed · Transfer unconfirmed")).toBeTruthy();
  expect(await screen.findByText("No verified provider route is enabled yet. Your wallet balance stays unchanged.")).toBeTruthy();
  expect(screen.getByText("Add funds · 100.00 GBP")).toBeTruthy();
  expect(mock.get).toHaveBeenCalledWith("/ramps", "session");
});
it("automatically refreshes transaction history and detail when a provider status changes", async () => {
  const order = {
    id: "saved",
    direction: "buy",
    provider: "moonpay",
    assetCode: "XLM",
    market: { country: "GB", currency: "GBP", method: "card" },
    launchRequested: true,
    providerStarted: true,
    providerState: "processing",
    chainState: "unobserved",
    amount: { currency: "GBP", units: "1250", decimals: 2 },
    createdAt: "2026-10-29T09:00:00Z",
  };
  let historyCalls = 0;
  let detailCalls = 0;
  mock.get.mockImplementation(async (path: string) => {
    if (path === "/ramps/capabilities") return { routes: [] };
    if (path === "/ramps") {
      historyCalls += 1;
      return { items: [{ ...order, providerState: historyCalls === 1 ? "processing" : "completed" }] };
    }
    if (path === "/ramps/saved") {
      detailCalls += 1;
      return { order: { ...order, providerState: detailCalls === 1 ? "processing" : "completed" } };
    }
    throw new Error(`Unexpected request: ${path}`);
  });

  vi.useFakeTimers();
  try {
    renderActivity(<WalletRampActivity token="session" />, ["/account?ramp=saved"]);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    const details = screen.getByRole("dialog", { name: "Funding details" });
    expect(within(details).getByText("Processing")).toBeTruthy();
    expect(screen.getByText("Processing · Transfer unconfirmed")).toBeTruthy();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15000);
    });

    expect(historyCalls).toBe(2);
    expect(detailCalls).toBe(2);
    expect(screen.getByText("Provider completed · Transfer unconfirmed")).toBeTruthy();
    expect(within(details).getByText("Provider completed")).toBeTruthy();
    expect(screen.getByText("Check your pending transaction before starting another.")).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});
it("offers retry when transaction history cannot be loaded", async () => {
  let historyCalls = 0;
  mock.get.mockImplementation(async (path: string) => {
    if (path === "/ramps/capabilities") return { routes: [] };
    if (++historyCalls === 1) throw new Error("offline");
    return { items: [] };
  });
  renderActivity(<WalletRampActivity token="session" />);
  await userEvent.setup().click(await screen.findByRole("button", { name: "Try again" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(historyCalls).toBe(2);
});
it("retries provider capability checks and distinguishes loading failures from no routes", async () => {
  let capabilityCalls = 0;
  mock.get.mockImplementation(async (path: string) => {
    if (path === "/ramps/capabilities") {
      capabilityCalls += 1;
      if (capabilityCalls === 1) throw new Error("offline");
      return { routes: [] };
    }
    return { items: [] };
  });
  const user = userEvent.setup();
  renderActivity(<WalletRampActivity token="session" />);
  expect(await screen.findByText("Could not check provider availability.")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Try again" }));
  expect(await screen.findByText("No verified provider route is enabled yet. Your wallet balance stays unchanged.")).toBeTruthy();
  expect(capabilityCalls).toBe(2);
});
it("offers funding only when the server provides a buy route", async () => {
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [{ provider: "moonpay", direction: "buy", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, amountDecimals: 2, minUnits: "1000", maxUnits: "100000" }] } : { items: [] });
  const user = userEvent.setup();
  renderActivity(<WalletRampActivity token="session" />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Add funds" }).hasAttribute("disabled")).toBe(false));
  await user.click(screen.getByRole("button", { name: "Add funds" }));
  expect(await screen.findByRole("radio", { name: /United Kingdom/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Cash out" }).hasAttribute("disabled")).toBe(true);
});
it("shows every buy provider included in verified server capabilities", async () => {
  const routes = [
    { provider: "moneygram", direction: "buy", assetCode: "USDC", market: { country: "ZA", currency: "ZAR", method: "cash_deposit" }, amountDecimals: 2, minUnits: "1000", maxUnits: "100000" },
    { provider: "moonpay", direction: "buy", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, amountDecimals: 2, minUnits: "1000", maxUnits: "100000" },
  ];
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes } : { items: [] });
  const user = userEvent.setup();
  renderActivity(<WalletRampActivity token="session" />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Add funds" }).hasAttribute("disabled")).toBe(false));
  await user.click(screen.getByRole("button", { name: "Add funds" }));
  expect(screen.getByRole("radio", { name: /United Kingdom/ })).toBeTruthy();
  expect(screen.getByRole("radio", { name: /South Africa/ })).toBeTruthy();
  expect(screen.getAllByRole("radio")).toHaveLength(2);
});

it("resumes a MoneyGram order with its matching verified route", async () => {
  const order = { id: "saved-mg", direction: "buy", provider: "moneygram", assetCode: "USDC", market: { country: "ZA", currency: "ZAR", method: "cash_deposit" }, launchRequested: false, providerState: "created", chainState: "unobserved", amount: { currency: "ZAR", units: "2000", decimals: 2 }, createdAt: "2026-10-28T00:00:00Z" };
  const route = { provider: "moneygram", direction: "buy", assetCode: "USDC", market: order.market, amountDecimals: 2, minUnits: "1000", maxUnits: "100000" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [route] } : { items: [order] });
  mock.post.mockResolvedValue({ url: "https://playground.xramps.moneygram.com/widget.html?mode=on-ramp" });
  const user = userEvent.setup();
  renderActivity(<WalletRampActivity token="session" />);
  await user.click(await screen.findByRole("button", { name: "Manage" }));
  const dialog = await screen.findByRole("dialog", { name: "Add funds" });
  expect(within(dialog).getByText("Continue this transaction with MoneyGram.")).toBeTruthy();
  await user.click(within(dialog).getByRole("button", { name: "Continue" }));
  expect(await screen.findByRole("link", { name: "Continue to provider" })).toBeTruthy();
  expect(mock.post).toHaveBeenCalledWith("/ramps/saved-mg/launch", {}, "session");
});
it("resumes an unlaunched saved order without creating another", async () => {
  const order = { id: "saved", direction: "buy", provider: "moonpay", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, launchRequested: false, providerState: "created", chainState: "unobserved", amount: { currency: "GBP", units: "10000", decimals: 2 }, createdAt: "2026-10-28T00:00:00Z" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [{ provider: "moonpay", direction: "buy", assetCode: "XLM", market: order.market, amountDecimals: 2, minUnits: "1000", maxUnits: "100000" }] } : { items: [order] });
  mock.post.mockResolvedValue({ url: "https://buy-sandbox.moonpay.com/?signature=test" });
  const user = userEvent.setup();
  renderActivity(<WalletRampActivity token="session" />);
  expect(await screen.findByText("Not started")).toBeTruthy();
  await user.click(await screen.findByRole("button", { name: "Manage" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Continue" }));
  expect(await screen.findByRole("link", { name: "Continue to provider" })).toBeTruthy();
  expect(mock.post).toHaveBeenCalledTimes(1);
  expect(mock.post).toHaveBeenCalledWith("/ramps/saved/launch", {}, "session");
});
it("shows unresolved launches as checking and blocks another funding request", async () => {
  const order = { id: "saved", direction: "buy", provider: "moonpay", launchRequested: true, providerState: "created", chainState: "unobserved", amount: { currency: "GBP", units: "10000", decimals: 2 }, createdAt: "2026-10-28T00:00:00Z" };
  const route = { provider: "moonpay", direction: "buy", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, amountDecimals: 2, minUnits: "1000", maxUnits: "100000" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [route] } : { items: [order] });
  renderActivity(<WalletRampActivity token="session" />);
  expect(await screen.findByText("Checking status · Transfer unconfirmed")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add funds" }).hasAttribute("disabled")).toBe(true);
  expect(screen.queryByRole("button", { name: "Manage" })).toBeNull();
});
it("does not reopen an order with an existing provider reference", async () => {
  const order = { id: "saved", direction: "buy", provider: "moonpay", launchRequested: false, providerStarted: true, providerState: "created", chainState: "unobserved", amount: { currency: "GBP", units: "10000", decimals: 2 }, createdAt: "2026-10-28T00:00:00Z" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [] } : { items: [order] });
  renderActivity(<WalletRampActivity token="session" />);
  expect(await screen.findByText("Checking status · Transfer unconfirmed")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Manage" })).toBeNull();
});
it("cancels an unlaunched funding request without opening the provider", async () => {
  const order = { id: "saved", direction: "buy", provider: "moonpay", launchRequested: false, providerStarted: false, providerState: "created", chainState: "unobserved", amount: { currency: "GBP", units: "10000", decimals: 2 }, createdAt: "2026-10-28T00:00:00Z" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [] } : { items: [order] });
  mock.post.mockResolvedValue({});
  const user = userEvent.setup();
  renderActivity(<WalletRampActivity token="session" />);
  await user.click(await screen.findByRole("button", { name: "Manage" }));
  await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Cancel funding" }));
  expect(await screen.findByText("Funding request cancelled.")).toBeTruthy();
  expect(mock.post).toHaveBeenCalledTimes(1);
  expect(mock.post).toHaveBeenCalledWith("/ramps/saved/cancel", {}, "session");
});


it("allows cancellation but hides provider launch when the saved route is unavailable", async () => {
  const order = { id: "saved", direction: "buy", provider: "moonpay", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, launchRequested: false, providerStarted: false, providerState: "created", chainState: "unobserved", amount: { currency: "GBP", units: "10000", decimals: 2 }, createdAt: "2026-10-28T00:00:00Z" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [] } : { items: [order] });
  mock.post.mockResolvedValue({});
  const user = userEvent.setup();
  renderActivity(<WalletRampActivity token="session" />);
  await user.click(await screen.findByRole("button", { name: "Manage" }));
  const dialog = within(screen.getByRole("dialog"));
  expect(dialog.getByText("This payment option is unavailable.")).toBeTruthy();
  expect(dialog.queryByRole("button", { name: "Continue" })).toBeNull();
  await user.click(dialog.getByRole("button", { name: "Cancel funding" }));
  expect(mock.post).toHaveBeenCalledWith("/ramps/saved/cancel", {}, "session");
});


it("blocks new funding while a started transaction is pending or delivery is unconfirmed", async () => {
  const order = { id: "saved", direction: "buy", provider: "moonpay", launchRequested: true, providerStarted: true, providerState: "completed", chainState: "unobserved", amount: { currency: "GBP", units: "10000", decimals: 2 }, createdAt: "2026-10-28T00:00:00Z" };
  const route = { provider: "moonpay", direction: "buy", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, amountDecimals: 2, minUnits: "1000", maxUnits: "100000" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [route] } : { items: [order] });
  renderActivity(<WalletRampActivity token="session" />);
  expect(await screen.findByText("Provider completed · Transfer unconfirmed")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add funds" }).hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("Check your pending transaction before starting another.")).toBeTruthy();
});

it("allows new funding once both provider and transfer are confirmed", async () => {
  const order = { id: "saved", direction: "buy", provider: "moonpay", launchRequested: true, providerStarted: true, providerState: "completed", chainState: "confirmed", amount: { currency: "GBP", units: "10000", decimals: 2 }, createdAt: "2026-10-28T00:00:00Z" };
  const route = { provider: "moonpay", direction: "buy", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, amountDecimals: 2, minUnits: "1000", maxUnits: "100000" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [route] } : { items: [order] });
  renderActivity(<WalletRampActivity token="session" />);
  expect(await screen.findByText("Provider completed · Transfer confirmed")).toBeTruthy();
  await waitFor(() => expect(screen.getByRole("button", { name: "Add funds" }).hasAttribute("disabled")).toBe(false));
});


it("offers cash-out only for a supported sell route and spendable USDC", async () => {
  const route = { provider: "moonpay", direction: "sell", assetCode: "USDC", assetIssuer: "issuer", market: { country: "GB", currency: "GBP", method: "bank" }, amountDecimals: 7, minUnits: "10000000", maxUnits: "100000000" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [route] } : { items: [] });
  const user = userEvent.setup();
  renderActivity(<WalletRampActivity token="session" sign={vi.fn()} spendableUsdc="2.5" />);
  await waitFor(() => expect(screen.getByRole("button", { name: "Cash out" }).hasAttribute("disabled")).toBe(false));
  await user.click(screen.getByRole("button", { name: "Cash out" }));
  expect(screen.getByRole("radio", { name: /United Kingdom/ })).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Amount in USDC" })).toBeTruthy();
});


it("lets an unlaunched cash-out be cancelled even when the route is unavailable", async () => {
  const order = { id: "saved-sell", direction: "sell", provider: "moonpay", assetCode: "USDC", market: { country: "GB", currency: "GBP", method: "bank" }, launchRequested: false, providerStarted: false, providerState: "created", chainState: "unobserved", amount: { currency: "USDC", units: "10000000", decimals: 7 }, createdAt: "2026-10-28T00:00:00Z" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [] } : { items: [order] });
  mock.post.mockResolvedValue({});
  const user = userEvent.setup();
  renderActivity(<WalletRampActivity token="session" sign={vi.fn()} spendableUsdc="2" />);
  await user.click(await screen.findByRole("button", { name: "Manage" }));
  const dialog = within(screen.getByRole("dialog", { name: "Cash out" }));
  expect(dialog.getByText("This payment option is unavailable.")).toBeTruthy();
  await user.click(dialog.getByRole("button", { name: "Cancel cash-out" }));
  expect(await screen.findByText("Cash-out request cancelled.")).toBeTruthy();
  expect(mock.post).toHaveBeenCalledWith("/ramps/saved-sell/cancel", {}, "session");
});

it("offers a quote only for a started, processing cash-out with a matching route", async () => {
  const order = { id: "saved-sell", direction: "sell", provider: "moonpay", assetCode: "USDC", market: { country: "GB", currency: "GBP", method: "bank" }, launchRequested: true, providerStarted: true, providerState: "processing", chainState: "unobserved", amount: { currency: "USDC", units: "10000000", decimals: 7 }, createdAt: "2026-10-28T00:00:00Z" };
  const route = { provider: "moonpay", direction: "sell", assetCode: "USDC", assetIssuer: "issuer", market: order.market, amountDecimals: 7, minUnits: "10000000", maxUnits: "100000000" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [route] } : { items: [order] });
  const user = userEvent.setup();
  mock.post.mockRejectedValue(new Error("not ready"));
  renderActivity(<WalletRampActivity token="session" sign={vi.fn()} spendableUsdc="2" />);
  await user.click(await screen.findByRole("button", { name: "Get quote" }));
  expect((await within(screen.getByRole("dialog", { name: "Cash out" })).findByRole("alert")).textContent).toContain("Quote not available yet");
  expect(mock.post).toHaveBeenCalledWith("/ramps/saved-sell/cashout/quotes", {}, "session");
});

it("takes a provider-ready cash-out from quote to review without signing", async () => {
  const order = { id: "ready-sell", direction: "sell", provider: "moonpay", assetCode: "USDC", market: { country: "GB", currency: "GBP", method: "bank" }, launchRequested: true, providerStarted: true, providerState: "awaiting_user", chainState: "unobserved", amount: { currency: "USDC", units: "10000000", decimals: 7 }, createdAt: "2026-10-28T00:00:00Z" };
  const route = { provider: "moonpay", direction: "sell", assetCode: "USDC", assetIssuer: "issuer", market: order.market, amountDecimals: 7, minUnits: "10000000", maxUnits: "100000000" };
  const transfer = { id: "attempt", quoteId: "quote", transactionHash: "hash", transaction: "unsigned", networkFeeStroops: "100", state: "prepared", expiresAt: "2099-01-01T00:00:00Z" };
  const quote = { provider: "moonpay", debitUnits: "10000000", receive: { currency: "GBP", units: "75", decimals: 2 }, destinationLabel: "Bank ending 1234", fees: [] };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [route] } : path.endsWith("/transfer") ? { transfer } : path.endsWith("/quotes/quote") ? { quote, expiresAt: "2099-01-01T00:00:00Z" } : { items: [order] });
  mock.post.mockResolvedValueOnce({ quote: { id: "quote" }, confirmationHash: "hash" }).mockResolvedValueOnce({ transfer });
  const sign = vi.fn(), user = userEvent.setup();
  renderActivity(<WalletRampActivity token="session" sign={sign} spendableUsdc="2" />);
  await user.click(await screen.findByRole("button", { name: "Get quote" }));
  expect(await screen.findByText("0.75 GBP")).toBeTruthy();
  expect(screen.getByText("Bank ending 1234")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Confirm cash-out" })).toBeTruthy();
  expect(sign).not.toHaveBeenCalled();
});

it("opens an owner-scoped, reloadable detail URL from transaction history", async () => {
  const order = { id: "saved", direction: "buy", provider: "moonpay", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, launchRequested: true, providerStarted: true, providerState: "completed", chainState: "unobserved", amount: { currency: "GBP", units: "1250", decimals: 2 }, createdAt: "2026-10-29T09:00:00Z" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [] } : path === "/ramps" ? { items: [order] } : { order });
  const user = userEvent.setup();
  renderActivity(<WalletRampActivity token="session" />);
  await user.click(await screen.findByRole("button", { name: "View funding 12.50 GBP" }));
  expect(screen.getByTestId("current-url").textContent).toBe("/account?ramp=saved");
  const details = await screen.findByRole("dialog", { name: "Funding details" });
  expect(within(details).getByText("Provider completed")).toBeTruthy();
  expect(within(details).getByText("Transfer unconfirmed")).toBeTruthy();
  expect(within(details).getByText("Provider completion is recorded; Stellar delivery is still being checked.")).toBeTruthy();
  expect(mock.get).toHaveBeenCalledWith("/ramps/saved", "session");
  await user.click(within(details).getByRole("button", { name: "Close" }));
  expect(screen.getByTestId("current-url").textContent).toBe("/account");
});

it("restores a transaction detail from its URL and lets the user refresh it", async () => {
  const order = { id: "saved", direction: "sell", provider: "moonpay", assetCode: "USDC", market: { country: "GB", currency: "GBP", method: "bank" }, launchRequested: true, providerStarted: true, providerState: "processing", chainState: "confirmed", amount: { currency: "USDC", units: "1250000", decimals: 7 }, createdAt: "2026-10-29T09:00:00Z" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [] } : path === "/ramps" ? { items: [order] } : { order });
  const user = userEvent.setup();
  renderActivity(<WalletRampActivity token="session" />, ["/account?ramp=saved"]);
  const details = await screen.findByRole("dialog", { name: "Cash-out details" });
  expect(within(details).getByText("Processing")).toBeTruthy();
  expect(within(details).getByText("Transfer confirmed")).toBeTruthy();
  await user.click(within(details).getByRole("button", { name: "Refresh status" }));
  await waitFor(() => expect(mock.get.mock.calls.filter(([path]) => path === "/ramps/saved").length).toBeGreaterThanOrEqual(2));
});

it("shows failed refunds as unresolved and tells the user the funds were not returned", async () => {
  const order = { id: "refund-failed", direction: "buy", provider: "moonpay", assetCode: "XLM", market: { country: "GB", currency: "GBP", method: "card" }, launchRequested: true, providerStarted: true, providerState: "refund_failed", chainState: "unobserved", amount: { currency: "GBP", units: "1250", decimals: 2 }, createdAt: "2026-10-29T09:00:00Z" };
  mock.get.mockImplementation(async (path: string) => path === "/ramps/capabilities" ? { routes: [] } : path === "/ramps" ? { items: [order] } : { order });
  const user = userEvent.setup();
  renderActivity(<WalletRampActivity token="session" />);
  expect(await screen.findByText("Refund failed · Transfer unconfirmed")).toBeTruthy();
  expect(screen.getByText("Check your pending transaction before starting another.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add funds" }).hasAttribute("disabled")).toBe(true);
  await user.click(await screen.findByRole("button", { name: "View funding 12.50 GBP" }));
  const details = await screen.findByRole("dialog", { name: "Funding details" });
  expect(within(details).getByRole("alert").textContent).toBe("The provider could not return the funds. Contact support; no refund is confirmed.");
});
