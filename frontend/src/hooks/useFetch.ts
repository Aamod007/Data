import { useEffect, useState } from "react";

/** Tiny data-loading hook: fetch on mount/deps change, expose reload. */
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    fn()
      .then((d) => { if (alive) { setData(d); setError(""); } })
      .catch((e) => { if (alive) setError(String(e)); });
    return () => { alive = false; };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  return { data, error, reload: () => setTick((t) => t + 1) };
}
