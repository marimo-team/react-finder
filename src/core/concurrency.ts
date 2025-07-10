/**
 * Run `fn` over `items` with at most `limit` in flight, preserving order.
 * Never rejects: each result is a `PromiseSettledResult`.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  // Filled by index below; every index is written before `Promise.all` resolves.
  const results: PromiseSettledResult<R>[] = [];
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next++;
      const item = items[index] as T;
      try {
        results[index] = {
          status: "fulfilled",
          value: await fn(item, index),
        };
      } catch (error) {
        results[index] = { status: "rejected", reason: error };
      }
    }
  });
  await Promise.all(workers);
  return results;
}
