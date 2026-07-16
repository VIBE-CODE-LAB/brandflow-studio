// Shared helpers for running a batch of async jobs with bounded concurrency,
// used by both the single-deck (Gear 1) and multi-bra-deck (Gear 2) generation engines.

export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

export async function runLimited<T>(items: T[], limit: number, worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      const item = items[index];
      if (item === undefined) return;
      await worker(item);
    }
  });

  await Promise.all(runners);
}
