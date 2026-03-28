"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";

/**
 * A thin wrapper around useQuery that calls fetchWithAuth automatically.
 *
 * Usage:
 *   const { data, isLoading, error } = useApiQuery<MyType>(
 *     ["apps"],
 *     "/api/apps",
 *   );
 */
export function useApiQuery<T>(
  key: readonly unknown[],
  url: string,
  options?: Omit<UseQueryOptions<T, Error>, "queryKey" | "queryFn">,
) {
  const { fetchWithAuth } = useAuth();
  return useQuery<T, Error>({
    queryKey: key,
    queryFn: async () => {
      const res = await fetchWithAuth(url);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `API error: ${res.status}`);
      }
      return res.json() as Promise<T>;
    },
    ...options,
  });
}

/**
 * A thin wrapper around useMutation + fetchWithAuth.
 *
 * Usage:
 *   const mutation = useApiMutation<ResponseType>(
 *     "/api/account/tracked-apps",
 *     { method: "POST" },
 *     { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["apps"] }) },
 *   );
 *   mutation.mutate({ slug: "my-app" });
 */
export function useApiMutation<TResponse = unknown, TBody = unknown>(
  url: string,
  fetchOptions?: Omit<RequestInit, "body">,
  mutationOptions?: Omit<
    UseMutationOptions<TResponse, Error, TBody>,
    "mutationFn"
  >,
) {
  const { fetchWithAuth } = useAuth();
  return useMutation<TResponse, Error, TBody>({
    mutationFn: async (body: TBody) => {
      const res = await fetchWithAuth(url, {
        ...fetchOptions,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `API error: ${res.status}`);
      }
      return res.json() as Promise<TResponse>;
    },
    ...mutationOptions,
  });
}

/**
 * Re-export useQueryClient for convenience so consumers don't need
 * an extra import from @tanstack/react-query.
 */
export { useQueryClient };
