import { describe, expect, it } from "vitest";
import { createRateLimiter } from "../rate-limiter.js";

describe("createRateLimiter", () => {
  it("requestsPerSecond の間隔を空けてタスクを実行する", async () => {
    let clock = 0;
    const sleeps: number[] = [];
    const limiter = createRateLimiter({
      requestsPerSecond: 3,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    });

    const order: number[] = [];
    await Promise.all([
      limiter.schedule(async () => {
        order.push(1);
      }),
      limiter.schedule(async () => {
        order.push(2);
      }),
      limiter.schedule(async () => {
        order.push(3);
      }),
    ]);

    expect(order).toEqual([1, 2, 3]); // 直列実行される
    // 3req/s = 約333ms間隔。2件目・3件目は待たされるはず。
    expect(sleeps.length).toBeGreaterThanOrEqual(1);
  });

  it("1件だけなら待たずに実行される", async () => {
    let waited = false;
    const limiter = createRateLimiter({
      requestsPerSecond: 3,
      sleep: async () => {
        waited = true;
      },
    });
    const result = await limiter.schedule(async () => "ok");
    expect(result).toBe("ok");
    expect(waited).toBe(false);
  });

  it("タスクの失敗はキューを壊さず、次のタスクは実行される", async () => {
    const limiter = createRateLimiter({ requestsPerSecond: 100 });
    const first = limiter.schedule(async () => {
      throw new Error("boom");
    });
    const second = limiter.schedule(async () => "ok");
    await expect(first).rejects.toThrow("boom");
    await expect(second).resolves.toBe("ok");
  });
});
