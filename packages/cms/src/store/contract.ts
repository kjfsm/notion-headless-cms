import { expect, it } from "vitest";

import type { IndexStore } from "./index-store.js";
import type { BlobStore } from "./types.js";

export interface IndexStoreContractOptions {
  factory: () => IndexStore | Promise<IndexStore>;
}

/**
 * `IndexStore` 実装が満たすべき契約を検証する。同一スイートを
 * memory / SQL(D1・better-sqlite3・libSQL) 複数実装に対して走らせ、差し替え可能性を保証する。
 */
export function runIndexStoreContract(opts: IndexStoreContractOptions) {
  it("upsert した entry が findEntry で読み戻せる", async () => {
    const store = await opts.factory();
    await store.upsertEntry("posts", { slug: "a", version: "v1", listed: true, meta: {} });
    expect(await store.findEntry("posts", "a")).toEqual({
      slug: "a",
      version: "v1",
      listed: true,
      meta: {},
    });
  });

  it("存在しない slug の findEntry は null を返す", async () => {
    const store = await opts.factory();
    expect(await store.findEntry("posts", "missing")).toBeNull();
  });

  it("同一 version の upsert は書き込まない(差分検知)", async () => {
    const store = await opts.factory();
    await store.upsertEntry("posts", { slug: "a", version: "v1", listed: true, meta: {} });
    const result = await store.upsertEntry("posts", {
      slug: "a",
      version: "v1",
      listed: true,
      meta: {},
    });
    expect(result.wrote).toBe(false);
    expect(result.writes).toBe(0);
  });

  it("version が変化した upsert は書き込む", async () => {
    const store = await opts.factory();
    await store.upsertEntry("posts", { slug: "a", version: "v1", listed: true, meta: {} });
    const result = await store.upsertEntry("posts", {
      slug: "a",
      version: "v2",
      listed: true,
      meta: {},
    });
    expect(result.wrote).toBe(true);
    expect((await store.findEntry("posts", "a"))?.version).toBe("v2");
  });

  it("removeEntry 後は findEntry が null を返す", async () => {
    const store = await opts.factory();
    await store.upsertEntry("posts", { slug: "a", version: "v1", listed: true, meta: {} });
    const result = await store.removeEntry("posts", "a");
    expect(result.wrote).toBe(true);
    expect(await store.findEntry("posts", "a")).toBeNull();
  });

  it("存在しない slug の removeEntry は書き込まない", async () => {
    const store = await opts.factory();
    const result = await store.removeEntry("posts", "missing");
    expect(result.wrote).toBe(false);
    expect(result.writes).toBe(0);
  });

  it("listEntries は where/sort/pagination を評価する", async () => {
    const store = await opts.factory();
    await store.upsertEntry("posts", {
      slug: "a",
      version: "v1",
      listed: true,
      meta: { title: "A", order: 2 },
    });
    await store.upsertEntry("posts", {
      slug: "b",
      version: "v1",
      listed: true,
      meta: { title: "B", order: 1 },
    });
    await store.upsertEntry("posts", {
      slug: "c",
      version: "v1",
      listed: true,
      meta: { title: "C", order: 3 },
    });

    const sorted = await store.listEntries("posts", {
      sort: [{ by: "order", direction: "asc" }],
    });
    expect(sorted.items.map((e) => e.slug)).toEqual(["b", "a", "c"]);

    const filtered = await store.listEntries("posts", {
      where: { title: { equals: "B" } },
    });
    expect(filtered.items.map((e) => e.slug)).toEqual(["b"]);

    const paged = await store.listEntries("posts", { limit: 2 });
    expect(paged.items).toHaveLength(2);
    expect(paged.hasMore).toBe(true);
    expect(paged.total).toBe(3);
  });

  it("listEntries は listed:false のエントリを隠す", async () => {
    const store = await opts.factory();
    await store.upsertEntry("posts", { slug: "a", version: "v1", listed: true, meta: {} });
    await store.upsertEntry("posts", { slug: "b", version: "v1", listed: false, meta: {} });
    const result = await store.listEntries("posts", {});
    expect(result.items.map((e) => e.slug)).toEqual(["a"]);
    expect(await store.findEntry("posts", "b")).not.toBeNull(); // find() は listed 問わず通す
  });

  it("listSlugs は listed 問わず全 slug を返す(reconcile 用)", async () => {
    const store = await opts.factory();
    await store.upsertEntry("posts", { slug: "a", version: "v1", listed: true, meta: {} });
    await store.upsertEntry("posts", { slug: "b", version: "v1", listed: false, meta: {} });
    expect(await store.listSlugs("posts")).toEqual(expect.arrayContaining(["a", "b"]));
  });

  it("コレクションが異なれば別々に管理される", async () => {
    const store = await opts.factory();
    await store.upsertEntry("posts", { slug: "a", version: "v1", listed: true, meta: {} });
    await store.upsertEntry("fixedPages", { slug: "a", version: "v1", listed: true, meta: {} });
    expect(await store.listSlugs("posts")).toEqual(["a"]);
    expect(await store.listSlugs("fixedPages")).toEqual(["a"]);
  });

  it("search は searchText への一致で entry を返す", async () => {
    const store = await opts.factory();
    await store.upsertEntry("posts", {
      slug: "a",
      version: "v1",
      listed: true,
      meta: { title: "A" },
      searchText: "Notion をヘッドレス CMS として使う",
    });
    await store.upsertEntry("posts", {
      slug: "b",
      version: "v1",
      listed: true,
      meta: { title: "B" },
      searchText: "全く関係の無い内容",
    });
    const result = await store.search("posts", "ヘッドレス", {});
    expect(result.items.map((e) => e.slug)).toEqual(["a"]);
  });

  it("search は where と併用できる", async () => {
    const store = await opts.factory();
    await store.upsertEntry("posts", {
      slug: "a",
      version: "v1",
      listed: true,
      meta: { title: "A", category: "tech" },
      searchText: "検索対象の本文",
    });
    await store.upsertEntry("posts", {
      slug: "b",
      version: "v1",
      listed: true,
      meta: { title: "B", category: "life" },
      searchText: "検索対象の本文",
    });
    // trigram tokenizer(FTS5)は 3 文字未満のクエリでは一致しない実装があるため、
    // 3 文字以上のクエリを使う(2 文字の "検索" 単体だとトライグラムが 1 つも作れない)。
    const result = await store.search("posts", "検索対象", {
      where: { category: { equals: "tech" } },
    });
    expect(result.items.map((e) => e.slug)).toEqual(["a"]);
  });
}

export interface BlobStoreContractOptions {
  factory: () => BlobStore | Promise<BlobStore>;
}

/** `BlobStore` 実装が満たすべき契約を検証する。 */
export function runBlobStoreContract(opts: BlobStoreContractOptions) {
  it("put したバイト列が get で読み戻せる", async () => {
    const store = await opts.factory();
    const bytes = new Uint8Array([1, 2, 3]);
    await store.put("k1", bytes);
    expect(await store.get("k1")).toEqual(bytes);
  });

  it("存在しないキーは null を返す", async () => {
    const store = await opts.factory();
    expect(await store.get("does-not-exist")).toBeNull();
  });

  it("head が本体を DL せずメタデータを返す", async () => {
    const store = await opts.factory();
    await store.put("k1", new Uint8Array([1, 2, 3, 4]), {
      contentType: "image/png",
    });
    const head = await store.head("k1");
    expect(head?.size).toBe(4);
    expect(head?.contentType).toBe("image/png");
  });

  it("存在しないキーの head は null", async () => {
    const store = await opts.factory();
    expect(await store.head("does-not-exist")).toBeNull();
  });

  it("delete 後は get / head が null を返す", async () => {
    const store = await opts.factory();
    await store.put("k1", new Uint8Array([1]));
    await store.delete("k1");
    expect(await store.get("k1")).toBeNull();
    expect(await store.head("k1")).toBeNull();
  });

  it("同じキーへの put はアトミックに上書きする(直前の内容は残らない)", async () => {
    const store = await opts.factory();
    await store.put("k1", new Uint8Array([1, 1, 1]));
    await store.put("k1", new Uint8Array([2, 2]));
    expect(await store.get("k1")).toEqual(new Uint8Array([2, 2]));
  });
}

/**
 * `customMetadata` と `getWithMetadata` に対応する `BlobStore` 実装向けの追加契約。
 * 未対応の実装(REST 経由等)には課さないため、基本契約とは分離している。
 */
export function runBlobStoreMetadataContract(opts: BlobStoreContractOptions) {
  it("put した customMetadata が head で読み戻せる", async () => {
    const store = await opts.factory();
    await store.put("k1", new Uint8Array([1, 2]), {
      contentType: "image/png",
      customMetadata: { width: "800", height: "600" },
    });
    const head = await store.head("k1");
    expect(head?.customMetadata).toEqual({ width: "800", height: "600" });
  });

  it("customMetadata 無しで put したキーの head は customMetadata を返さない", async () => {
    const store = await opts.factory();
    await store.put("k1", new Uint8Array([1]));
    const head = await store.head("k1");
    expect(head?.customMetadata ?? undefined).toBeUndefined();
  });

  it("getWithMetadata は本体と contentType を 1 回で返す", async () => {
    const store = await opts.factory();
    await store.put("k1", new Uint8Array([1, 2, 3]), {
      contentType: "image/png",
    });
    const result = await store.getWithMetadata?.("k1");
    expect(result?.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(result?.contentType).toBe("image/png");
  });

  it("存在しないキーの getWithMetadata は null を返す", async () => {
    const store = await opts.factory();
    expect(await store.getWithMetadata?.("does-not-exist")).toBeNull();
  });
}
