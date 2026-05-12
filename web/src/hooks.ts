import { useEffect, useRef, useState } from "react";

/** Polls `fetcher` every `intervalMs` while the tab is visible. */
export function usePolling<T>(
  fetcher: () => Promise<T>,
  intervalMs: number,
  deps: unknown[] = [],
): { data: T | null; error: string | null; loading: boolean; refetch: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => () => { mounted.current = false; }, []);

  const run = async () => {
    try {
      const out = await fetcher();
      if (mounted.current) {
        setData(out);
        setError(null);
      }
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (mounted.current) setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    run();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") run();
    }, intervalMs);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, refetch: run };
}
