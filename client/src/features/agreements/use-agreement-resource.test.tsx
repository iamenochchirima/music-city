import { afterEach, expect, it, vi } from "vitest";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useAgreementResource } from "./use-agreement-resource";
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
it("polls serially, pauses during editing and ignores responses from a previous actor", async () => {
  vi.useFakeTimers();
  let resolveOld: (x: string) => void = () => {};
  const old = new Promise<string>((resolve) => {
    resolveOld = resolve;
  });
  const fetch = vi
    .fn<(key: string) => Promise<string>>()
    .mockImplementation((key) =>
      key === "old" ? old : Promise.resolve("new actor"),
    );
  const { result, rerender, unmount } = renderHook(
    ({ key, paused }) => useAgreementResource(key, () => fetch(key), paused),
    { initialProps: { key: "old", paused: false } },
  );
  await act(async () => {
    vi.advanceTimersByTime(15000);
  });
  expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => {
    rerender({ key: "new", paused: false });
  });
  expect(result.current.value).toBe("new actor");
  await act(async () => {
    resolveOld("old private data");
  });
  expect(result.current.value).toBe("new actor");
  await act(async () => {
    rerender({ key: "new", paused: true });
  });
  await act(async () => {
    vi.advanceTimersByTime(15000);
  });
  expect(fetch).toHaveBeenCalledTimes(2);
  unmount();
  await act(async () => {
    vi.advanceTimersByTime(15000);
  });
  expect(fetch).toHaveBeenCalledTimes(2);
});
it("keeps the last confirmed view when a poll fails and recovers on retry", async () => {
  vi.useFakeTimers();
  const source = vi
    .fn<() => Promise<string>>()
    .mockResolvedValueOnce("ready")
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue("active");
  const { result } = renderHook(() =>
    useAgreementResource("agreement", source),
  );
  await act(async () => {});
  expect(result.current.value).toBe("ready");
  await act(async () => {
    vi.advanceTimersByTime(5000);
  });
  expect(result.current.value).toBe("ready");
  expect(result.current.error).toBe("offline");
  await act(async () => {
    await result.current.refresh();
  });
  expect(result.current.value).toBe("active");
  expect(result.current.error).toBeNull();
});
