/**
 * Hard-cap a promise with a timeout. If the promise hasn't settled by `ms`,
 * rejects with the given error (default `TimeoutError`). The underlying
 * promise is not cancelled (Node has no cancellation primitive) — callers
 * must rely on upstream abort mechanisms (PG statement_timeout,
 * AbortController, etc.) to actually release resources.
 *
 * Used by /auth/me (PLA-1097) to avoid indefinite hangs when the DB
 * connection pool is saturated.
 */
export class TimeoutError extends Error {
  constructor(message = "operation-timeout") {
    super(message);
    this.name = "TimeoutError";
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorFactory: () => Error = () => new TimeoutError()
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(errorFactory()), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
