import { describe, expect, it, vi } from "vitest";

import { withRetry } from "../retry.js";

describe("withRetry", () => {
  it("成功すればそのまま返す", async () => {
    const result = await withRetry(async () => "ok", {
      retryOn: [429],
      maxRetries: 3,
      baseDelayMs: 1,
    });
    expect(result).toBe("ok");
  });

  it("retryOn に含まれるステータスはリトライする", async () => {
    let attempts = 0;
    const result = await withRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw { status: 429 };
        return "ok";
      },
      { retryOn: [429], maxRetries: 5, baseDelayMs: 1 },
      async () => {},
    );
    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("maxRetries を超えると最後のエラーを投げる", async () => {
    await expect(
      withRetry(
        async () => {
          throw { status: 429 };
        },
        { retryOn: [429], maxRetries: 2, baseDelayMs: 1 },
        async () => {},
      ),
    ).rejects.toEqual({ status: 429 });
  });

  it("retryOn に無いステータスは即座に投げる", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async () => {
          attempts++;
          throw { status: 500 };
        },
        { retryOn: [429], maxRetries: 3, baseDelayMs: 1 },
        async () => {},
      ),
    ).rejects.toEqual({ status: 500 });
    expect(attempts).toBe(1);
  });

  it("onRetry フックが呼ばれる", async () => {
    const onRetry = vi.fn();
    let attempts = 0;
    await withRetry(
      async () => {
        attempts++;
        if (attempts < 2) throw { status: 503 };
        return "ok";
      },
      { retryOn: [503], maxRetries: 3, baseDelayMs: 1, onRetry },
      async () => {},
    );
    expect(onRetry).toHaveBeenCalledWith(1, 503, expect.any(Number));
  });

  it("1回目のリトライ遅延は baseDelayMs 前後(v2 core/retry.ts と同じ倍率)", async () => {
    const onRetry = vi.fn();
    let attempts = 0;
    await withRetry(
      async () => {
        attempts++;
        if (attempts < 2) throw { status: 503 };
        return "ok";
      },
      {
        retryOn: [503],
        maxRetries: 3,
        baseDelayMs: 1000,
        jitter: false,
        onRetry,
      },
      async () => {},
    );
    expect(onRetry).toHaveBeenCalledWith(1, 503, 1000);
  });
});
