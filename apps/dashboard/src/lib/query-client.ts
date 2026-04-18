import { QueryClient } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30 seconds
        retry: (failureCount, error) => {
          // Never retry on auth failures — prevents infinite 401 loops (PLA-1141)
          if (error instanceof Error) {
            const msg = error.message?.toLowerCase() || "";
            if (msg.includes("401") || msg.includes("session expired") || msg.includes("not authenticated")) return false;
          }
          return failureCount < 1;
        },
        refetchOnWindowFocus: false,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Get a singleton QueryClient for the browser.
 * On the server, always create a new one to avoid cross-request leaks.
 */
export function getQueryClient() {
  if (typeof window === "undefined") {
    return makeQueryClient();
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}
