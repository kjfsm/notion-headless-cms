# カスタムキャッシュアダプタの実装

## DocumentCacheAdapter

```ts
import type {
  DocumentCacheAdapter,
  CachedItem,
  CachedItemList,
  BaseContentItem,
} from "@notion-headless-cms/core";

class RedisDocumentCache<T extends BaseContentItem> implements DocumentCacheAdapter<T> {
  readonly name = "redis";
  constructor(private redis: RedisClient) {}

  async getList(): Promise<CachedItemList<T> | null> {
    const json = await this.redis.get("cms:list");
    return json ? JSON.parse(json) : null;
  }

  async setList(data: CachedItemList<T>): Promise<void> {
    await this.redis.set("cms:list", JSON.stringify(data));
  }

  async getItem(slug: string): Promise<CachedItem<T> | null> {
    const json = await this.redis.get(`cms:item:${slug}`);
    return json ? JSON.parse(json) : null;
  }

  async setItem(slug: string, data: CachedItem<T>): Promise<void> {
    await this.redis.set(`cms:item:${slug}`, JSON.stringify(data));
  }

  // invalidate はオプション。未実装でも cms.cache.revalidate() が no-op になるだけ。
  async invalidate(scope: "all" | { slug: string } | { tag: string }): Promise<void> {
    if (scope === "all") {
      await this.redis.del("cms:list");
      // 全アイテムをクリアする場合はパターン削除
    } else if ("slug" in scope) {
      await this.redis.del(`cms:item:${scope.slug}`);
    }
    // tag スコープは実装任意
  }
}
```

## ImageCacheAdapter

```ts
import type { ImageCacheAdapter, StorageBinary } from "@notion-headless-cms/core";

class S3ImageCache implements ImageCacheAdapter {
  readonly name = "s3";

  async get(hash: string): Promise<StorageBinary | null> {
    const obj = await s3.getObject({ Key: `images/${hash}` }).catch(() => null);
    if (!obj) return null;
    return {
      data: await obj.Body!.transformToByteArray(),
      contentType: obj.ContentType,
    };
  }

  async set(hash: string, data: ArrayBuffer, contentType: string): Promise<void> {
    await s3.putObject({
      Key: `images/${hash}`,
      Body: Buffer.from(data),
      ContentType: contentType,
    });
  }
}
```

## createCMS で利用

```ts
import { createCMS } from "@notion-headless-cms/core";

const cms = createCMS({
  source: mySource,
  cache: {
    document: new RedisDocumentCache(redis),
    image: new S3ImageCache(),
    ttlMs: 5 * 60_000,
  },
});
```

## エラー処理

キャッシュ R/W 失敗は `CMSError` の `cache/io_failed` コードで投げると、ライブラリ他部分と挙動が揃う。

```ts
import { CMSError } from "@notion-headless-cms/core";

async setItem(slug: string, data: CachedItem<T>): Promise<void> {
  try {
    await this.redis.set(`cms:item:${slug}`, JSON.stringify(data));
  } catch (err) {
    throw new CMSError({
      code: "cache/io_failed",
      message: "Failed to write to Redis cache.",
      cause: err,
      context: { operation: "RedisDocumentCache.setItem", slug },
    });
  }
}
```
