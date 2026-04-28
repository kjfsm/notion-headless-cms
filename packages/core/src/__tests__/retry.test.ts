import { describe, expect, it, vi } from "vitest";
import type { RetryConfig } from "../retry";
import { withRetry } from "../retry";

const config: RetryConfig = {
  retryOn: [429, 503],
  maxRetries: 3,
  baseDelayMs: 1,
  jitter: false,
};

describe("withRetry", () => {
  it("初回成功の場合はリトライしない", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const result = await withRetry(fn, config);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("429 エラーでリトライする", async () => {
    const err = Object.assign(new Error("rate limit"), { status: 429 });
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");
    const result = await withRetry(fn, config);
    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("maxRetries 超過でエラーをスロー", async () => {
    const err = Object.assign(new Error("rate limit"), { status: 429 });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, config)).rejects.toThrow("rate limit");
    expect(fn).toHaveBeenCalledTimes(config.maxRetries + 1);
  });

  it("retryOn 対象外のステータスは即スロー", async () => {
    const err = Object.assign(new Error("not found"), { status: 404 });
    const fn = vi.fn().mockRejectedValue(err);
    await expect(withRetry(fn, config)).rejects.toThrow("not found");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("onRetry コールバックが呼ばれる", async () => {
    const onRetry = vi.fn();
    const err = Object.assign(new Error("rate limit"), { status: 429 });
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");
    await withRetry(fn, { ...config, onRetry });
    expect(onRetry).toHaveBeenCalledWith(1, 429);
  });

  it("jitter が有効のときランダム係数が delay に加わる", async () => {
    vi.spyOn(globalThis.Math, "random").mockReturnValue(0.5);
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn, delay) => {
      delays.push(delay as number);
      return originalSetTimeout(fn as () => void, 0);
    });

    const err = Object.assign(new Error("rate limit"), { status: 429 });
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");
    await withRetry(fn, { ...config, baseDelayMs: 100, jitter: true });

    // Math.random() = 0.5 → jitterFactor = 0.5 + 0.5 * 0.5 = 0.75 → delay = 100 * 1 * 0.75 = 75
    expect(delays[0]).toBeCloseTo(75, 0);

    vi.restoreAllMocks();
  });

  it("jitter が未指定のときデフォルトで jitter=true として動作する", async () => {
    vi.spyOn(globalThis.Math, "random").mockReturnValue(0);
    const delays: number[] = [];
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn, delay) => {
      delays.push(delay as number);
      return originalSetTimeout(fn as () => void, 0);
    });

    const err = Object.assign(new Error("rate limit"), { status: 429 });
    const fn = vi.fn().mockRejectedValueOnce(err).mockResolvedValue("ok");
    // jitter を省略（undefined = true と同等）
    const { jitter: _jitter, ...configWithoutJitter } = config;
    await withRetry(fn, { ...configWithoutJitter, baseDelayMs: 100 });

    // Math.random() = 0 → jitterFactor = 0.5 → delay = 100 * 1 * 0.5 = 50
    expect(delays[0]).toBeCloseTo(50, 0);

    vi.restoreAllMocks();
  });
});
