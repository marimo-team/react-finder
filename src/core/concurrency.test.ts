import { describe, expect, it } from "vite-plus/test";

import { mapWithConcurrency } from "./concurrency.js";

describe("mapWithConcurrency", () => {
  it("caps in-flight work and preserves order", async () => {
    let active = 0;
    let peak = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5, 6], 2, async (n) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 1);
      });
      active--;
      if (n === 4) throw new Error("four");
      return n * 10;
    });
    expect(peak).toBe(2);
    expect(results.map((r) => r.status)).toEqual([
      "fulfilled",
      "fulfilled",
      "fulfilled",
      "rejected",
      "fulfilled",
      "fulfilled",
    ]);
    expect(results[0]).toEqual({ status: "fulfilled", value: 10 });
    const fourth = results[3];
    expect(fourth?.status === "rejected" && (fourth.reason as Error).message).toBe("four");
  });

  it("handles an empty list", async () => {
    await expect(mapWithConcurrency([], 4, async () => 1)).resolves.toEqual([]);
  });
});
