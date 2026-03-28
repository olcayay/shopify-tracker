import { useEffect, useRef } from "react";

/**
 * Custom hook that polls a function at a set interval while there are pending items.
 * Cleans up interval on unmount or when no pending items remain.
 */
export function usePolling({
  hasPending,
  fetchFn,
  interval = 5000,
  enabled = true,
}: {
  /** Whether there are pending items that need polling */
  hasPending: boolean;
  /** Function to call on each poll tick */
  fetchFn: () => void;
  /** Polling interval in ms (default: 5000) */
  interval?: number;
  /** Whether polling is enabled at all (default: true) */
  enabled?: boolean;
}) {
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    if (enabled && hasPending) {
      pollRef.current = setInterval(fetchFn, interval);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = undefined;
    }
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = undefined;
      }
    };
  }, [hasPending, fetchFn, interval, enabled]);
}
