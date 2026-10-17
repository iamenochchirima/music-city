import { useCallback, useEffect, useRef, useState } from "react";

export function useAgreementResource<T>(
  key: string,
  fetchValue: () => Promise<T>,
  paused = false,
) {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const source = useRef(fetchValue);
  source.current = fetchValue;
  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    const revision = generation.current;
    inFlight.current = true;
    try {
      const next = await source.current();
      if (revision === generation.current) {
        setValue(next);
        setError(null);
      }
    } catch (e) {
      if (revision === generation.current)
        setError(
          e instanceof Error ? e.message : "Could not check agreement status",
        );
    } finally {
      if (revision === generation.current) {
        inFlight.current = false;
        setLoading(false);
      }
    }
  }, []);
  useEffect(() => {
    generation.current++;
    inFlight.current = false;
    setValue(null);
    setError(null);
    setLoading(true);
    void refresh();
    return () => {
      generation.current++;
      inFlight.current = false;
    };
  }, [key, refresh]);
  useEffect(() => {
    if (paused) return;
    const check = () => {
      if (document.visibilityState !== "hidden") void refresh();
    };
    const timer = setInterval(check, 5000);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [paused, refresh, key]);
  return { value, error, loading, refresh };
}
