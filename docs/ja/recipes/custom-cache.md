---
title: カスタムストア
description: 独自 IndexStore / BlobStore を実装する
category: レシピ
order: 5
---

# カスタムストア（`IndexStore` / `BlobStore`）の実装

`@notion-headless-cms/cms` は `createCMS({ stores: { index, blobs } })` に渡す 2 つの
ストレージインターフェースを公開している。組み込みは in-memory（`.` 本体）・ファイル
（`/node`）・D1/SQLite/libSQL（`@notion-headless-cms/sql`）・R2（`/cloudflare`）の系統だが、
Redis / S3 / Vercel KV・Blob など任意のバックエンドに差し替えられる。

> D1/SQLite/libSQL のいずれかで十分なら、まず `@notion-headless-cms/sql` の
> `d1IndexStore`/`sqliteIndexStore`/`libsqlIndexStore` を検討する（`where`/`sort`/FTS5 全文検索
> まで実装済み）。このレシピは、それら SQLite 系以外のバックエンド（Redis・Vercel KV/Blob・
> S3 等）に差し替えたい場合向け。

## `IndexStore` / `BlobStore` の構造

```ts
import type { BlobStore, IndexEntry, IndexStore } from "@notion-headless-cms/cms";

/**
 * コレクション index の読み書き（`find`/`list`/`search` が読む集合）。
 * 構造型なので実依存パッケージは不要。`IndexEntry` は `{ slug, version, listed, meta }`。
 */
interface IndexStore {
  findEntry(collection: string, slug: string): Promise<IndexEntry | null>;
  listEntries(collection: string, params: ListRuntimeParams): Promise<ListResult<IndexEntry>>;
  /** listed 問わず全件（内部リンク解決用）。 */
  listAllEntries(collection: string): Promise<readonly IndexEntry[]>;
  /** listed 問わず全 slug（reconcile の突合用）。 */
  listSlugs(collection: string): Promise<readonly string[]>;
  /** `upsertEntry` で渡した `searchText`（本文平文）への全文検索。`where`/`sort` も併用可。 */
  search(
    collection: string,
    query: string,
    params: ListRuntimeParams,
  ): Promise<ListResult<IndexEntry>>;
  /** 差分（version 不一致）が無ければ書き込みをスキップする。 */
  upsertEntry(
    collection: string,
    entry: IndexEntry & { searchText?: string },
    knownExisting?: IndexEntry | null,
  ): Promise<IndexWriteResult>;
  removeEntry(collection: string, slug: string): Promise<IndexWriteResult>;
}

/** entry 本体・画像バイナリの読み書き（R2 想定）。read-after-write 強整合を前提にする。 */
interface BlobStore {
  get(key: string): Promise<Uint8Array | null>;
  /** 本体とメタデータを 1 回の読み取りで返す任意メソッド。未実装なら get+head にフォールバックされる。 */
  getWithMetadata?(key: string): Promise<{ bytes: Uint8Array; contentType?: string } | null>;
  put(
    key: string,
    value: Uint8Array,
    opts?: { contentType?: string; customMetadata?: Record<string, string> },
  ): Promise<void>;
  head(key: string): Promise<{
    contentType?: string;
    size: number;
    customMetadata?: Record<string, string>;
  } | null>;
  delete(key: string): Promise<void>;
}
```

`index` はコレクション index（`find`/`list`/`search` が読む一覧・メタデータ）、`blobs` は entry
本体（`find()` が返す `EntrySnapshot`）と画像バイナリを持つ。両方とも省略可能で、省略した slot は
in-memory 実装（`memoryIndexStore()`/`memoryBlobStore()`）にフォールバックする。

`IndexStore` は単純な点キー get/put ではなく `where`/`sort`/全文検索まで扱う契約になっている
ため、Redis のような KVS 上に自作する場合はコレクション単位で全件を 1 つの JSON 配列として
持ち、フィルタ・ソート自体はアプリ側で行う（`memoryIndexStore()` と同じ設計）。フィルタ・
ソートの実装を再発明しない、`evaluateWhere`/`sortByMeta`（`@notion-headless-cms/cms` の公開
API、`memoryIndexStore()` 内部実装と同じ関数）をそのまま使い回せる。

## `IndexStore` の実装例（Redis）

```ts
import type { IndexEntry, IndexStore, JsonValue } from "@notion-headless-cms/cms";
import { evaluateWhere, sortByMeta } from "@notion-headless-cms/cms";
import type { RedisClientType } from "redis";

interface StoredRecord {
  readonly entry: IndexEntry;
  readonly searchText?: string;
}

function key(collection: string): string {
  return `nhc:index:${collection}`;
}

/**
 * コレクションごとに全件を 1 つの Redis キー（JSON 配列）として持つ。`where`/`sort`/
 * `search` はここで JS 側で評価する（memoryIndexStore() と同じ設計。ページングだけ
 * 集合を読んだ後で行う）。大規模データセットでは D1/SQLite/libSQL（`@notion-headless-cms/sql`）
 * の方が本来向いている点に注意。
 */
export function redisIndexStore(redis: RedisClientType, prefix = ""): IndexStore {
  async function readAll(collection: string): Promise<StoredRecord[]> {
    const raw = await redis.get(`${prefix}${key(collection)}`);
    return raw ? (JSON.parse(raw) as StoredRecord[]) : [];
  }

  async function writeAll(collection: string, records: StoredRecord[]): Promise<void> {
    await redis.set(`${prefix}${key(collection)}`, JSON.stringify(records));
  }

  function paginate(items: readonly IndexEntry[], params: { cursor?: string; limit?: number }) {
    const offset = params.cursor ? Math.max(0, Number.parseInt(params.cursor, 10) || 0) : 0;
    const limit = Math.max(0, params.limit ?? 20);
    const page = items.slice(offset, offset + limit);
    const hasMore = offset + limit < items.length;
    return {
      items: page,
      nextCursor: hasMore ? String(offset + limit) : null,
      hasMore,
      total: items.length,
    };
  }

  return {
    async findEntry(collection, slug) {
      const records = await readAll(collection);
      return records.find((r) => r.entry.slug === slug)?.entry ?? null;
    },
    async listEntries(collection, params) {
      const listed = (await readAll(collection)).map((r) => r.entry).filter((e) => e.listed);
      const filtered = listed.filter((e) =>
        evaluateWhere(e.meta as Record<string, JsonValue>, params.where),
      );
      const sorted = sortByMeta(filtered, params.sort, (e) => e.meta as Record<string, JsonValue>);
      return paginate(sorted, params);
    },
    async listAllEntries(collection) {
      return (await readAll(collection)).map((r) => r.entry);
    },
    async listSlugs(collection) {
      return (await readAll(collection)).map((r) => r.entry.slug);
    },
    async search(collection, query, params) {
      const q = query.toLowerCase();
      const matched = (await readAll(collection))
        .filter((r) => r.entry.listed && r.searchText?.toLowerCase().includes(q))
        .map((r) => r.entry);
      const filtered = matched.filter((e) =>
        evaluateWhere(e.meta as Record<string, JsonValue>, params.where),
      );
      const sorted = sortByMeta(filtered, params.sort, (e) => e.meta as Record<string, JsonValue>);
      return paginate(sorted, params);
    },
    async upsertEntry(collection, entry, knownExisting) {
      const records = await readAll(collection);
      const idx = records.findIndex((r) => r.entry.slug === entry.slug);
      const existing = knownExisting !== undefined ? knownExisting : (records[idx]?.entry ?? null);
      if (existing && existing.version === entry.version) {
        return { wrote: false, writes: 0 }; // Notion 側で何も変わっていない
      }
      const { searchText, ...indexEntry } = entry;
      const next =
        idx === -1
          ? [...records, { entry: indexEntry, searchText }]
          : records.map((r, i) => (i === idx ? { entry: indexEntry, searchText } : r));
      await writeAll(collection, next);
      return { wrote: true, writes: 1 };
    },
    async removeEntry(collection, slug) {
      const records = await readAll(collection);
      if (!records.some((r) => r.entry.slug === slug)) return { wrote: false, writes: 0 };
      await writeAll(
        collection,
        records.filter((r) => r.entry.slug !== slug),
      );
      return { wrote: true, writes: 1 };
    },
  };
}
```

## `BlobStore` の実装例（S3）

```ts
import type { BlobStore } from "@notion-headless-cms/cms";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export function s3BlobStore(s3: S3Client, bucket: string): BlobStore {
  const key = (k: string) => `blobs/${k}`;

  return {
    async get(k) {
      try {
        const obj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key(k) }));
        return new Uint8Array(await obj.Body!.transformToByteArray());
      } catch {
        return null;
      }
    },
    async put(k, value, opts) {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key(k),
          Body: value,
          ContentType: opts?.contentType,
          Metadata: opts?.customMetadata,
        }),
      );
    },
    async head(k) {
      try {
        const meta = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key(k) }));
        return {
          contentType: meta.ContentType,
          size: meta.ContentLength ?? 0,
          customMetadata: meta.Metadata,
        };
      } catch {
        return null;
      }
    },
    async delete(k) {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key(k) }));
    },
  };
}
```

## `createCMS` で利用

```ts
import { createCMS } from "@notion-headless-cms/cms";
import { schema } from "./schema.js";
import { redisIndexStore } from "./redis-index-store.js";
import { s3BlobStore } from "./s3-blob-store.js";

const cms = createCMS({
  schema,
  notion: { token: process.env.NOTION_TOKEN! },
  stores: {
    index: redisIndexStore(redisClient, "myapp:"),
    blobs: s3BlobStore(s3Client, "my-bucket"),
  },
});
```

`index`/`blobs` は個別に差し替えられる。片方だけカスタム実装にし、もう片方は組み込み
（`d1IndexStore`/`sqliteIndexStore`/`libsqlIndexStore`/`r2BlobStore`/`fileIndexStore`/`fileBlobStore`）
のままにしてもよい。

## 契約テスト: `runIndexStoreContract` / `runBlobStoreContract`

`@notion-headless-cms/cms/testing`（`vitest` に依存する専用サブパス。汎用 `.` エントリからは
import されない）が、組み込み実装（memory/file/D1/SQLite/libSQL/Cloudflare）が満たしているのと
同じ契約を検証するヘルパーを提供する。自作の `IndexStore`/`BlobStore` にもそのまま使える。

```ts
import { describe } from "vitest";
import { runBlobStoreContract, runIndexStoreContract } from "@notion-headless-cms/cms/testing";
import { redisIndexStore } from "./redis-index-store.js";
import { s3BlobStore } from "./s3-blob-store.js";

describe("redisIndexStore", () => {
  runIndexStoreContract({
    factory: () => redisIndexStore(testRedisClient),
  });
});

describe("s3BlobStore", () => {
  runBlobStoreContract({
    factory: () => s3BlobStore(testS3Client, "test-bucket"),
  });
});
```

`runIndexStoreContract` は「upsert した entry が findEntry で読み戻せる」「同一 version の
upsert は書き込みをスキップする（差分検知）」「version が変化した upsert は書き込む」
「removeEntry 後は findEntry が null を返す」などを検証する。`runBlobStoreContract` は
「put した値が get で読み戻せる」ことに加えて `head`（本体を読まずメタデータだけ返す）・
`customMetadata` の往復を検証する（`customMetadata`/`getWithMetadata` に未対応の実装向けには、
これらを課さない `runBlobStoreMetadataContract` が別途ある）。

自作の実装がこの契約さえ満たしていれば、`createCMS` から見て組み込み実装と差し替え可能で
あることが保証される。

## 関連ドキュメント

- [テスト](./testing.md)
- [Cloudflare Workers + R2 + D1](./cloudflare-workers.md) — 組み込み `d1IndexStore`/`r2BlobStore`
- [CMS メソッド一覧](../api/cms-methods.md)
