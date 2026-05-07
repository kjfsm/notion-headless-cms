import { describe, expect, it, vi } from "vitest";
import { cloudflareCache, cloudflarePreset } from "../cloudflare";
import type { KVNamespaceLike, R2BucketLike } from "../types";

// 最小限の KV / R2 fake。preset の組み立てを検証するだけなので I/O は呼ばれない。
const fakeKV = (): KVNamespaceLike => ({
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ keys: [], list_complete: true }),
});

const fakeBucket = (): R2BucketLike => ({
  get: vi.fn().mockResolvedValue(null),
  put: vi.fn().mockResolvedValue(undefined),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi
    .fn()
    .mockResolvedValue({ objects: [], truncated: false, cursor: undefined }),
});

describe("cloudflarePreset", () => {
  it("env.DOC_CACHE / env.IMG_BUCKET から cache 配列を生成する", () => {
    const env = { DOC_CACHE: fakeKV(), IMG_BUCKET: fakeBucket() };
    const { cache } = cloudflarePreset({ env });
    // cloudflareCache と同じ順序 (kv → r2) で 2 件返る。
    expect(cache).toHaveLength(2);
    expect(cache[0]?.name).toBe("kv");
    expect(cache[1]?.name).toBe("r2");
  });

  it("env binding が無ければ cache は空配列", () => {
    const { cache } = cloudflarePreset({ env: {} });
    expect(cache).toEqual([]);
  });

  it("ctx.waitUntil を bind して伝播する", () => {
    const inner = vi.fn();
    // this バインドを検証するため、ctx 自身を返す setter を持たせる。
    const ctx = {
      waitUntil(p: Promise<unknown>) {
        inner(this, p);
      },
    };
    const { waitUntil } = cloudflarePreset({ env: {}, ctx });
    expect(waitUntil).toBeTypeOf("function");
    const p = Promise.resolve();
    waitUntil?.(p);
    expect(inner).toHaveBeenCalledTimes(1);
    // bind 済みなので this は元の ctx を指す。
    expect(inner.mock.calls[0]?.[0]).toBe(ctx);
    expect(inner.mock.calls[0]?.[1]).toBe(p);
  });

  it("ctx 未指定なら waitUntil は undefined", () => {
    const { waitUntil } = cloudflarePreset({ env: {} });
    expect(waitUntil).toBeUndefined();
  });

  it("createClient へスプレッドできる形（cache / waitUntil キー）になっている", () => {
    const result = cloudflarePreset({
      env: { DOC_CACHE: fakeKV() },
      ctx: { waitUntil: vi.fn() },
    });
    expect(Object.keys(result).sort()).toEqual(["cache", "waitUntil"]);
  });
});

describe("cloudflareCache", () => {
  it("docCache のみで kv アダプタだけ返す", () => {
    const adapters = cloudflareCache({ docCache: fakeKV() });
    expect(adapters).toHaveLength(1);
    expect(adapters[0]?.name).toBe("kv");
  });

  it("imgBucket のみで r2 アダプタだけ返す", () => {
    const adapters = cloudflareCache({ imgBucket: fakeBucket() });
    expect(adapters).toHaveLength(1);
    expect(adapters[0]?.name).toBe("r2");
  });
});
