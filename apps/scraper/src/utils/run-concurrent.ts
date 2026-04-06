/**
 * Run an async function over an array of items with bounded concurrency.
 * Each item is processed at most once; failures in one item do not
 * prevent other items from completing.
 */
export async function runConcurrent<T>(
  items: T[],
  fn: (item: T, index: number) => Promise<void>,
  concurrency: number,
): Promise<void> {
  let index = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (index < items.length) {
        const i = index++;
        await fn(items[i], i);
      }
    },
  );
  await Promise.allSettled(workers);
}
