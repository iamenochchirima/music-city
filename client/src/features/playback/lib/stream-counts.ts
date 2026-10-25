import { useSyncExternalStore } from "react";

const counts = new Map<string, number>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function publishStreamCount(trackId: string, count: number) {
  if (!Number.isSafeInteger(count) || count < 0 || count <= (counts.get(trackId) ?? -1)) return;
  counts.set(trackId, count);
  listeners.forEach((listener) => listener());
}

export function useStreamCount(trackId: string, initialCount: number) {
  return useSyncExternalStore(
    subscribe,
    () => Math.max(initialCount, counts.get(trackId) ?? 0),
    () => initialCount,
  );
}
