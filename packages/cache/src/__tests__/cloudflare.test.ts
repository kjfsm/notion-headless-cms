import type { CachedItemMeta } from "@notion-headless-cms/core";
import { describe, expect, it, vi } from "vitest";
import {
  cloudflareCache,
  cloudflarePreset,
  kvCache,
  r2Cache,
} from "../cloudflare";
import type { KVNamespaceLike, R2BucketLike, R2ObjectLike } from "../types";

const inMemoryKV = (): KVNamespaceLike => {
  const store = new Map<string, string>();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix = "", cursor: _ } = {}) {
      const keys = [...store.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true };
    },
  };
};

const inMemoryBucket = (): R2BucketLike => {
  const store = new Map<
    string,
    { value: ArrayBuffer | string; contentType?: string }
  >();
  const toObject = (
    entry: { value: ArrayBuffer | string; contentType?: string } | undefined,
  ): R2ObjectLike | null => {
    if (!entry) return null;
    return {
      async json<T>() {
        const text =
          typeof entry.value === "string"
            ? entry.value
            : new TextDecoder().decode(entry.value);
        return JSON.parse(text) as T;
      },
      async arrayBuffer() {
        return typeof entry.value === "string"
          ? new TextEncoder().encode(entry.value).buffer
          : entry.value;
      },
      httpMetadata: { contentType: entry.contentType },
    };
  };
  return {
    async get(key) {
      return toObject(store.get(key));
    },
    async head(key) {
      return toObject(store.get(key));
    },
    async put(key, value, opts) {
      store.set(key, { value, contentType: opts?.httpMetadata?.contentType });
    },
    async delete(key) {
      store.delete(key);
    },
    async list({ prefix = "" } = {}) {
      return {
        objects: [...store.keys()]
          .filter((k) => k.startsWith(prefix))
          .map((key) => ({ key })),
        truncated: false,
        cursor: undefined,
      };
    },
  };
};

const meta = (slug: string, lastEdited = "2024-01-01"): CachedItemMeta =>
  ({
    item: { id: `id-${slug}`, slug, lastEditedTime: lastEdited },
    notionUpdatedAt: lastEdited,
    cachedAt: 1700000000000,
  }) as unknown as CachedItemMeta;

describe("cloudflarePreset", () => {
  it("env.DOC_CACHE / env.IMG_BUCKET から cache 配列を生成する", () => {
    const env = { DOC_CACHE: inMemoryKV(), IMG_BUCKET: inMemoryBucket() };
    const { cache } = cloudflarePreset({ env, ctx: { waitUntil: vi.fn() } });
    expect(cache).toHaveLength(2);
    expect(cache[0]?.name).toBe("kv");
    expect(cache[1]?.name).toBe("r2");
  });

  it("forTest: env binding が無ければ cache は空配列", () => {
    const { cache } = cloudflarePreset.forTest({ env: {} });
    expect(cache).toEqual([]);
  });

  it("ctx.waitUntil を bind して伝播する", () => {
    const inner = vi.fn();
    const ctx = {
      waitUntil(p: Promise<unknown>) {
        inner(this, p);
      },
    };
    const { waitUntil } = cloudflarePreset({ env: {}, ctx });
    expect(waitUntil).toBeTypeOf("function");
    const p = Promise.resolve();
    waitUntil(p);
    expect(inner).toHaveBeenCalledTimes(1);
    expect(inner.mock.calls[0]?.[0]).toBe(ctx);
    expect(inner.mock.calls[0]?.[1]).toBe(p);
  });

  it("forTest では waitUntil は undefined", () => {
    const { waitUntil } = cloudflarePreset.forTest({ env: {} });
    expect(waitUntil).toBeUndefined();
  });

  it("createClient へスプレッドできる cache / swr / waitUntil キーを返す", () => {
    // Issue #313 (M2) で nodePreset / nextPreset と契約を揃えるため swr を含める。
    const result = cloudflarePreset({
      env: { DOC_CACHE: inMemoryKV() },
      ctx: { waitUntil: vi.fn() },
    });
    expect(Object.keys(result).sort()).toEqual(["cache", "swr", "waitUntil"]);
    // swr 既定は空（core が webhook 有無等で解決する）。
    expect(result.swr).toEqual({});
  });

  it("opts.swr で SWR 設定を上書きできる", () => {
    const result = cloudflarePreset({
      env: { DOC_CACHE: inMemoryKV() },
      ctx: { waitUntil: vi.fn() },
      swr: { recheckWindowMs: 30_000 },
    });
    expect(result.swr).toEqual({ recheckWindowMs: 30_000 });
  });

  it("prefix を伝播する", async () => {
    const kv = inMemoryKV();
    const { cache } = cloudflarePreset.forTest({
      env: { DOC_CACHE: kv },
      prefix: "blog:",
    });
    await cache[0]?.doc?.setMeta("posts", "hello", meta("hello"));
    expect(await kv.get("blog:meta:posts:hello", "text")).not.toBeNull();
    expect(await kv.get("meta:posts:hello", "text")).toBeNull();
  });
});

describe("cloudflareCache", () => {
  it("docCache のみで kv アダプタだけ返す", () => {
    const adapters = cloudflareCache({ docCache: inMemoryKV() });
    expect(adapters).toHaveLength(1);
    expect(adapters[0]?.name).toBe("kv");
  });

  it("imgBucket のみで r2 アダプタだけ返す", () => {
    const adapters = cloudflareCache({ imgBucket: inMemoryBucket() });
    expect(adapters).toHaveLength(1);
    expect(adapters[0]?.name).toBe("r2");
  });
});

describe("kvCache", () => {
  const setupAdapter = () => {
    const kv = inMemoryKV();
    const adapter = kvCache({ namespace: kv });
    return { kv, ops: adapter.doc };
  };

  it("setMeta / getMeta / setContent / getContent が往復する", async () => {
    const { ops } = setupAdapter();
    const m = meta("hello");
    await ops?.setMeta("posts", "hello", m);
    expect(await ops?.getMeta("posts", "hello")).toEqual(m);

    const content = {
      html: "<p>x</p>",
      markdown: "x",
      blocks: [],
      notionUpdatedAt: "",
      cachedAt: 0,
    };
    await ops?.setContent("posts", "hello", content);
    expect(await ops?.getContent("posts", "hello")).toEqual(content);
  });

  it("setList / getList が往復する", async () => {
    const { ops } = setupAdapter();
    const list = {
      items: [{ id: "1", slug: "hello", lastEditedTime: "" }],
      cachedAt: 1,
    };
    await ops?.setList("posts", list);
    expect(await ops?.getList("posts")).toEqual(list);
  });

  it("getMeta は未保存のとき null", async () => {
    const { ops } = setupAdapter();
    expect(await ops?.getMeta("posts", "missing")).toBeNull();
    expect(await ops?.getList("posts")).toBeNull();
    expect(await ops?.getContent("posts", "missing")).toBeNull();
  });

  it("invalidate({ collection, slug }) で該当 slug のみ削除する", async () => {
    const { ops } = setupAdapter();
    await ops?.setMeta("posts", "a", meta("a"));
    await ops?.setMeta("posts", "b", meta("b"));
    await ops?.invalidate({ collection: "posts", slug: "a" });
    expect(await ops?.getMeta("posts", "a")).toBeNull();
    expect(await ops?.getMeta("posts", "b")).not.toBeNull();
  });

  it("invalidate({ collection, slug, kind: 'content' }) は meta を残し content だけ削除する", async () => {
    const { ops } = setupAdapter();
    await ops?.setMeta("posts", "a", meta("a"));
    await ops?.setContent("posts", "a", {
      html: "x",
      markdown: "x",
      blocks: [],
      notionUpdatedAt: "",
      cachedAt: 0,
    });
    await ops?.invalidate({ collection: "posts", slug: "a", kind: "content" });
    expect(await ops?.getMeta("posts", "a")).not.toBeNull();
    expect(await ops?.getContent("posts", "a")).toBeNull();
  });

  it("invalidate({ collection }) は collection 配下を全削除する", async () => {
    const { ops } = setupAdapter();
    await ops?.setMeta("posts", "a", meta("a"));
    await ops?.setMeta("posts", "b", meta("b"));
    await ops?.setList("posts", { items: [], cachedAt: 0 });
    await ops?.invalidate({ collection: "posts" });
    expect(await ops?.getMeta("posts", "a")).toBeNull();
    expect(await ops?.getMeta("posts", "b")).toBeNull();
    expect(await ops?.getList("posts")).toBeNull();
  });

  it("invalidate('all') で全削除", async () => {
    const { ops } = setupAdapter();
    await ops?.setMeta("posts", "a", meta("a"));
    await ops?.setMeta("pages", "x", meta("x"));
    await ops?.invalidate("all");
    expect(await ops?.getMeta("posts", "a")).toBeNull();
    expect(await ops?.getMeta("pages", "x")).toBeNull();
  });

  it("prefix オプションでキー空間を分離する", async () => {
    const kv = inMemoryKV();
    const a = kvCache({ namespace: kv, prefix: "a:" }).doc;
    const b = kvCache({ namespace: kv, prefix: "b:" }).doc;
    await a?.setMeta("posts", "hello", meta("hello"));
    expect(await a?.getMeta("posts", "hello")).not.toBeNull();
    expect(await b?.getMeta("posts", "hello")).toBeNull();
  });
});

describe("r2Cache", () => {
  it("既定では image のみ担当する", () => {
    const adapter = r2Cache({ bucket: inMemoryBucket() });
    expect(adapter.handles).toEqual(["image"]);
    expect(adapter.img).toBeDefined();
    expect(adapter.doc).toBeUndefined();
  });

  it("doc: true で document も担当する", () => {
    const adapter = r2Cache({ bucket: inMemoryBucket(), doc: true });
    expect(adapter.handles).toEqual(["document", "image"]);
    expect(adapter.doc).toBeDefined();
  });

  it("img.set / get で contentType と data が往復する", async () => {
    const adapter = r2Cache({ bucket: inMemoryBucket() });
    const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer;
    await adapter.img?.set("h1", data, "image/png");
    const got = await adapter.img?.get("h1");
    expect(got?.contentType).toBe("image/png");
    expect(got?.data.byteLength).toBe(4);
  });

  it("img.get は未保存時 null", async () => {
    const adapter = r2Cache({ bucket: inMemoryBucket() });
    expect(await adapter.img?.get("nope")).toBeNull();
  });

  it("img.has は head で存在判定する（保存後 true / 未保存 false）", async () => {
    const bucket = inMemoryBucket();
    const headSpy = vi.spyOn(bucket, "head");
    const adapter = r2Cache({ bucket });
    await adapter.img?.set("h1", new ArrayBuffer(4), "image/png");

    expect(await adapter.img?.has?.("h1")).toBe(true);
    expect(await adapter.img?.has?.("nope")).toBe(false);
    // head 経由（本体 DL を伴う get ではない）で判定している
    expect(headSpy).toHaveBeenCalled();
  });

  it("img.has は head 未提供のバケットでは get にフォールバックする", async () => {
    const bucket = inMemoryBucket();
    // head を持たない構造型（旧バケット互換）を再現する
    const { head: _omit, ...noHead } = bucket;
    const adapter = r2Cache({ bucket: noHead as R2BucketLike });
    await adapter.img?.set("h1", new ArrayBuffer(4), "image/png");

    expect(await adapter.img?.has?.("h1")).toBe(true);
    expect(await adapter.img?.has?.("nope")).toBe(false);
  });

  it("doc.setMeta / getMeta が往復する (doc: true)", async () => {
    const adapter = r2Cache({ bucket: inMemoryBucket(), doc: true });
    await adapter.doc?.setMeta("posts", "hello", meta("hello"));
    expect(await adapter.doc?.getMeta("posts", "hello")).toEqual(meta("hello"));
  });

  it("doc.invalidate({ collection, slug }) で該当のみ削除", async () => {
    const adapter = r2Cache({ bucket: inMemoryBucket(), doc: true });
    await adapter.doc?.setMeta("posts", "a", meta("a"));
    await adapter.doc?.setMeta("posts", "b", meta("b"));
    await adapter.doc?.invalidate({ collection: "posts", slug: "a" });
    expect(await adapter.doc?.getMeta("posts", "a")).toBeNull();
    expect(await adapter.doc?.getMeta("posts", "b")).not.toBeNull();
  });

  it("doc.invalidate({ collection }) で配下全削除", async () => {
    const adapter = r2Cache({ bucket: inMemoryBucket(), doc: true });
    await adapter.doc?.setList("posts", { items: [], cachedAt: 0 });
    await adapter.doc?.setMeta("posts", "a", meta("a"));
    await adapter.doc?.setContent("posts", "a", {
      html: "x",
      markdown: "x",
      blocks: [],
      notionUpdatedAt: "",
      cachedAt: 0,
    });
    await adapter.doc?.invalidate({ collection: "posts" });
    expect(await adapter.doc?.getList("posts")).toBeNull();
    expect(await adapter.doc?.getMeta("posts", "a")).toBeNull();
    expect(await adapter.doc?.getContent("posts", "a")).toBeNull();
  });

  it("doc.invalidate('all') で全削除", async () => {
    const adapter = r2Cache({ bucket: inMemoryBucket(), doc: true });
    await adapter.doc?.setMeta("posts", "a", meta("a"));
    await adapter.doc?.setMeta("pages", "x", meta("x"));
    await adapter.doc?.invalidate("all");
    expect(await adapter.doc?.getMeta("posts", "a")).toBeNull();
    expect(await adapter.doc?.getMeta("pages", "x")).toBeNull();
  });

  it("doc.invalidate({ collection, slug, kind: 'content' }) は meta を残す", async () => {
    const adapter = r2Cache({ bucket: inMemoryBucket(), doc: true });
    await adapter.doc?.setMeta("posts", "a", meta("a"));
    await adapter.doc?.setContent("posts", "a", {
      html: "x",
      markdown: "x",
      blocks: [],
      notionUpdatedAt: "",
      cachedAt: 0,
    });
    await adapter.doc?.invalidate({
      collection: "posts",
      slug: "a",
      kind: "content",
    });
    expect(await adapter.doc?.getMeta("posts", "a")).not.toBeNull();
    expect(await adapter.doc?.getContent("posts", "a")).toBeNull();
  });
});
