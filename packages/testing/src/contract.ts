/**
 * `@notion-headless-cms/testing/contract`
 *
 * サードパーティ実装の `CacheAdapter` / `DataSource` が公開 API 契約を満たすかを
 * 1 ファイルで検証する Vitest 用テストランナー (Issue #317 / M6)。
 *
 * 利用例:
 *
 * ```ts
 * import { describe } from "vitest";
 * import {
 *   runCacheAdapterContract,
 *   runDataSourceContract,
 * } from "@notion-headless-cms/testing/contract";
 *
 * describe("MyRedisCache contract", () =>
 *   runCacheAdapterContract({ factory: () => myRedisCache() }));
 *
 * describe("MyContentfulSource contract", () =>
 *   runDataSourceContract({
 *     factory: () => contentfulSource({...}),
 *     fixture: { id: "1", slug: "hello", lastEditedTime: "2026-01-01T00:00:00.000Z" },
 *   }));
 * ```
 *
 * 自実装でも `describe` の内側で呼び出すことが前提。`it` を内部で発行する。
 */

import type {
  BaseContentItem,
  CacheAdapter,
  DataSource,
} from "@notion-headless-cms/core";
import { expect, it } from "vitest";

export interface CacheAdapterContractOptions {
  /** テスト実行ごとに新しい adapter を生成するファクトリ。 */
  factory: () => CacheAdapter | Promise<CacheAdapter>;
}

/**
 * `CacheAdapter` 実装が public 契約を満たすかを検証する Vitest スイート。
 * `describe(...)` の中で呼び出す。`it` を内部で発行する。
 */
export function runCacheAdapterContract(opts: CacheAdapterContractOptions) {
  it("name と handles を返す (CacheAdapter 必須プロパティ)", async () => {
    const adapter = await opts.factory();
    expect(typeof adapter.name).toBe("string");
    expect(Array.isArray(adapter.handles)).toBe(true);
  });

  it("document を担当する場合 doc.setMeta / getMeta が round trip する", async () => {
    const adapter = await opts.factory();
    if (!adapter.handles.includes("document") || !adapter.doc) return;
    const meta = {
      item: {
        id: "id-1",
        slug: "hello",
        title: "Hello",
        lastEditedTime: "2026-01-01T00:00:00.000Z",
      } as BaseContentItem,
      notionUpdatedAt: "2026-01-01T00:00:00.000Z",
      cachedAt: Date.now(),
    };
    await adapter.doc.setMeta("posts", "hello", meta);
    const got = await adapter.doc.getMeta("posts", "hello");
    expect(got?.item.slug).toBe("hello");
  });

  it("document を担当する場合 setList / getList が round trip する", async () => {
    const adapter = await opts.factory();
    if (!adapter.handles.includes("document") || !adapter.doc) return;
    const items = [
      {
        id: "id-1",
        slug: "hello",
        title: "Hello",
        lastEditedTime: "2026-01-01T00:00:00.000Z",
      } as BaseContentItem,
    ];
    await adapter.doc.setList("posts", { items, cachedAt: Date.now() });
    const list = await adapter.doc.getList("posts");
    expect(list?.items[0]?.slug).toBe("hello");
  });

  it("document を担当する場合 invalidate('all') で全件消える", async () => {
    const adapter = await opts.factory();
    if (!adapter.handles.includes("document") || !adapter.doc) return;
    await adapter.doc.setList("posts", { items: [], cachedAt: Date.now() });
    await adapter.doc.invalidate("all");
    const list = await adapter.doc.getList("posts");
    expect(list).toBeNull();
  });

  it("image を担当する場合 img.set / get が round trip する", async () => {
    const adapter = await opts.factory();
    if (!adapter.handles.includes("image") || !adapter.img) return;
    const data = new ArrayBuffer(8);
    await adapter.img.set("hash-1", data, "image/png");
    const got = await adapter.img.get("hash-1");
    expect(got?.contentType).toBe("image/png");
    expect((got?.data as ArrayBuffer)?.byteLength).toBe(8);
  });
}

export interface DataSourceContractOptions<
  T extends BaseContentItem = BaseContentItem,
> {
  /** テストごとに新しい source を生成するファクトリ。 */
  factory: () => DataSource<T> | Promise<DataSource<T>>;
  /** `list()` が返すと期待する最低 1 件の fixture。 */
  fixture: T;
}

/**
 * `DataSource<T>` 実装が public 契約を満たすかを検証する Vitest スイート。
 * `describe(...)` の中で呼び出す。
 */
export function runDataSourceContract<T extends BaseContentItem>(
  opts: DataSourceContractOptions<T>,
) {
  it("name を返す", async () => {
    const source = await opts.factory();
    expect(typeof source.name).toBe("string");
  });

  it("list() が配列を返す", async () => {
    const source = await opts.factory();
    const items = await source.list();
    expect(Array.isArray(items)).toBe(true);
  });

  it("list() の各要素が BaseContentItem の必須キーを持つ", async () => {
    const source = await opts.factory();
    const items = await source.list();
    if (items.length === 0) return;
    const item = items[0];
    if (!item) return;
    expect(typeof item.id).toBe("string");
    expect(typeof item.slug).toBe("string");
    expect(typeof item.lastEditedTime).toBe("string");
  });

  it("loadMarkdown() が文字列を返す", async () => {
    const source = await opts.factory();
    const md = await source.loadMarkdown(opts.fixture);
    expect(typeof md).toBe("string");
  });

  it("getLastModified() が文字列 (ISO 8601 推奨) を返す", async () => {
    const source = await opts.factory();
    const lm = source.getLastModified(opts.fixture);
    expect(typeof lm).toBe("string");
  });
}
