/**
 * M2 可観測性: traceId 伝搬 / mergeLoggers / cms.stats() / retry の backoff ログ。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryCache } from "../cache/memory";
import { createClient } from "../cms";
import { mergeLoggers, withTraceId } from "../hooks";
import { withRetry } from "../retry";
import type { CollectionDef, RendererFn } from "../types/config";
import type { BaseContentItem } from "../types/content";
import type { DataSource } from "../types/data-source";
import type { Logger } from "../types/logger";

const mockRenderer: RendererFn = vi.fn().mockResolvedValue("<p>x</p>");

function makeSource(
  items: BaseContentItem[] = [],
): DataSource<BaseContentItem> {
  return {
    name: "mock",
    list: vi.fn().mockResolvedValue(items),
    loadBlocks: vi.fn().mockResolvedValue([]),
    loadMarkdown: vi.fn().mockResolvedValue(""),
    getLastModified: (item) => item.lastEditedTime,
    getListVersion: () => "",
  };
}

function makeSources<C extends Record<string, CollectionDef<BaseContentItem>>>(
  cols: C,
): { mock: { readonly collections: C } } {
  return { mock: { collections: cols } };
}

describe("withTraceId", () => {
  it("ログコンテキストに traceId を自動付与する", () => {
    const debug = vi.fn();
    const base: Logger = { debug };
    const wrapped = withTraceId(base, "abc-123");
    wrapped?.debug?.("msg", { operation: "op" });
    expect(debug).toHaveBeenCalledWith("msg", {
      traceId: "abc-123",
      operation: "op",
    });
  });

  it("呼び出し側が明示した traceId は優先される", () => {
    const debug = vi.fn();
    const wrapped = withTraceId({ debug }, "abc-123");
    wrapped?.debug?.("msg", { traceId: "explicit" });
    expect(debug).toHaveBeenCalledWith("msg", { traceId: "explicit" });
  });

  it("Logger 未指定なら undefined", () => {
    expect(withTraceId(undefined, "x")).toBeUndefined();
  });
});

describe("mergeLoggers — plugin と direct の合成", () => {
  it("plugin logger と createClient.logger を両方呼ぶ", () => {
    const a = vi.fn();
    const b = vi.fn();
    const merged = mergeLoggers([{ logger: { debug: a } }], { debug: b });
    merged?.debug?.("hi", { op: "test" });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});

describe("createClient — traceId 伝搬", () => {
  it("cms.traceId が文字列で返る", () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: makeSources({
        posts: { source: makeSource(), slugField: "slug" },
      }),
    });
    expect(typeof cms.traceId).toBe("string");
    expect(cms.traceId.length).toBeGreaterThan(0);
  });

  it("logger.info に traceId が含まれる (invalidate 操作)", async () => {
    const debug = vi.fn();
    const cms = createClient({
      renderer: mockRenderer,
      logger: { debug },
      sources: makeSources({
        posts: { source: makeSource(), slugField: "slug" },
      }),
    });
    await cms.invalidate();
    expect(debug).toHaveBeenCalled();
    const call = debug.mock.calls[0];
    expect(call?.[1]).toMatchObject({ traceId: cms.traceId });
  });

  it("複数 createClient で別の traceId が発行される", () => {
    const make = () =>
      createClient({
        renderer: mockRenderer,
        sources: makeSources({
          posts: { source: makeSource(), slugField: "slug" },
        }),
      });
    const a = make();
    const b = make();
    expect(a.traceId).not.toBe(b.traceId);
  });
});

describe("cms.stats() — memoryCache 集計", () => {
  it("ヒット率・エントリ数を集計する", async () => {
    const item: BaseContentItem = {
      id: "1",
      slug: "p1",
      title: "T",
      lastEditedTime: "2024-01-01",
    };
    const cms = createClient({
      renderer: mockRenderer,
      cache: [memoryCache()],
      sources: makeSources({
        posts: { source: makeSource([item]), slugField: "slug" },
      }),
    });
    // 初回 list (miss)
    await cms.posts.list();
    // 2 回目 list (hit)
    await cms.posts.list();
    const stats = await cms.stats();
    expect(stats.traceId).toBe(cms.traceId);
    expect(stats.document).toBeDefined();
    expect(stats.document?.adapter).toBe("memory");
    expect(stats.document?.hits).toBeGreaterThanOrEqual(1);
    expect(stats.document?.misses).toBeGreaterThanOrEqual(1);
    expect(stats.document?.hitRate).toBeGreaterThan(0);
    expect(stats.document?.hitRate).toBeLessThanOrEqual(1);
    expect(stats.image?.adapter).toBe("memory");
  });

  it("キャッシュ未設定なら document / image とも省略される", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      sources: makeSources({
        posts: { source: makeSource(), slugField: "slug" },
      }),
    });
    const stats = await cms.stats();
    expect(stats.document).toBeUndefined();
    expect(stats.image).toBeUndefined();
    expect(stats.traceId).toBe(cms.traceId);
  });

  it("hits/misses が両方 0 でも hitRate は 0", async () => {
    const cms = createClient({
      renderer: mockRenderer,
      cache: [memoryCache()],
      sources: makeSources({
        posts: { source: makeSource(), slugField: "slug" },
      }),
    });
    const stats = await cms.stats();
    expect(stats.document?.hitRate).toBe(0);
  });
});

describe("withRetry — onRetry に delayMs が渡る", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("リトライ前フックに attempt / status / delayMs が渡る", async () => {
    const onRetry = vi.fn();
    let calls = 0;
    const fn = vi.fn().mockImplementation(() => {
      calls++;
      if (calls === 1) {
        const err = new Error("rate-limited") as Error & { status?: number };
        err.status = 429;
        return Promise.reject(err);
      }
      return Promise.resolve("ok");
    });

    const promise = withRetry(fn, {
      retryOn: [429],
      maxRetries: 2,
      baseDelayMs: 100,
      jitter: false,
      onRetry,
    });
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe("ok");
    expect(onRetry).toHaveBeenCalledTimes(1);
    const [attempt, status, delayMs] = onRetry.mock.calls[0] ?? [];
    expect(attempt).toBe(1);
    expect(status).toBe(429);
    expect(delayMs).toBe(100);
  });
});
