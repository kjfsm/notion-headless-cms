---
title: カスタムストア
description: 独自 DocStore / BlobStore を実装する
category: レシピ
order: 5
---

# カスタムストア（`DocStore` / `BlobStore`）の実装

`@notion-headless-cms/cms` は `createCMS({ stores: { docs, blobs } })` に渡す 2 つの
ストレージインターフェースを公開している。組み込みは KV/R2（`/cloudflare`）・ファイル
（`/node`）・in-memory（`.` 本体）の 3 系統だが、Redis / S3 / Vercel KV・Blob など任意の
バックエンドに差し替えられる。

## `DocStore` / `BlobStore` の構造

```ts
import type { BlobStore, DocStore } from "@notion-headless-cms/cms";

/** コレクション index の読み書き（KV 想定）。構造型なので実依存パッケージは不要。 */
interface DocStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

/** entry 本体・画像バイナリの読み書き（R2 想定）。read-after-write 強整合を前提にする。 */
interface BlobStore {
  get(key: string): Promise<Uint8Array | null>;
  /** 本体とメタデータを 1 回の読み取りで返す任意メソッド。未実装なら get+head にフォールバックされる。 */
  getWithMetadata?(key: string): Promise<{ bytes: Uint8Array; contentType?: string } | null>;
  put(key: string, value: Uint8Array, opts?: { contentType?: string; customMetadata?: Record<string, string> }): Promise<void>;
  head(key: string): Promise<{ contentType?: string; size: number; customMetadata?: Record<string, string> } | null>;
  delete(key: string): Promise<void>;
}
```

`docs` はコレクション index（`list()` が読む一覧・メタデータ）、`blobs` は entry 本体
（`find()` が返す `EntrySnapshot`）と画像バイナリを持つ。両方とも省略可能で、省略した slot は
in-memory 実装（`memoryDocStore()`/`memoryBlobStore()`）にフォールバックする。

## `DocStore` の実装例（Redis）

```ts
import type { DocStore } from "@notion-headless-cms/cms";
import type { RedisClientType } from "redis";

export function redisDocStore(redis: RedisClientType, prefix = ""): DocStore {
  return {
    async get(key) {
      return redis.get(`${prefix}${key}`);
    },
    async put(key, value) {
      await redis.set(`${prefix}${key}`, value);
    },
    async delete(key) {
      await redis.del(`${prefix}${key}`);
    },
  };
}
```

## `BlobStore` の実装例（S3）

```ts
import type { BlobStore } from "@notion-headless-cms/cms";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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
import { redisDocStore } from "./redis-doc-store.js";
import { s3BlobStore } from "./s3-blob-store.js";

const cms = createCMS({
  schema,
  notion: { token: process.env.NOTION_TOKEN! },
  stores: {
    docs: redisDocStore(redisClient, "myapp:"),
    blobs: s3BlobStore(s3Client, "my-bucket"),
  },
});
```

`docs`/`blobs` は個別に差し替えられる。片方だけカスタム実装にし、もう片方は組み込み
（`kvDocStore`/`r2BlobStore`/`fileDocStore`/`fileBlobStore`）のままにしてもよい。

## 契約テスト: `runDocStoreContract` / `runBlobStoreContract`

`@notion-headless-cms/cms/testing`（`vitest` に依存する専用サブパス。汎用 `.` エントリからは
import されない）が、組み込み実装（memory/file/Cloudflare）が満たしているのと同じ契約を
検証するヘルパーを提供する。自作の `DocStore`/`BlobStore` にもそのまま使える。

```ts
import { describe } from "vitest";
import { runBlobStoreContract, runDocStoreContract } from "@notion-headless-cms/cms/testing";
import { redisDocStore } from "./redis-doc-store.js";
import { s3BlobStore } from "./s3-blob-store.js";

describe("redisDocStore", () => {
  runDocStoreContract({
    factory: () => redisDocStore(testRedisClient),
  });
});

describe("s3BlobStore", () => {
  runBlobStoreContract({
    factory: () => s3BlobStore(testS3Client, "test-bucket"),
  });
});
```

`runDocStoreContract` は「put した値が get で読み戻せる」「存在しないキーは null」
「上書きされる」「delete 後は null」を検証する。`runBlobStoreContract` はこれに加えて
`head`（本体を読まずメタデータだけ返す）・`customMetadata` の往復を検証する
（`customMetadata`/`getWithMetadata` に未対応の実装向けには、これらを課さない
`runBlobStoreMetadataContract` が別途ある）。

自作の実装がこの契約さえ満たしていれば、`createCMS` から見て組み込み実装と差し替え可能で
あることが保証される。

## 関連ドキュメント

- [テスト](./testing.md)
- [Cloudflare Workers + R2 + KV](./cloudflare-workers.md) — 組み込み `kvDocStore`/`r2BlobStore`
- [CMS メソッド一覧](../api/cms-methods.md)
