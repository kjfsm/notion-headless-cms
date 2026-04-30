# カスタムキャッシュアダプタの実装

`@notion-headless-cms/core` は `DocumentCacheOps` / `ImageCacheOps` という 2 つのインターフェースを公開している。
`CacheAdapter` としてまとめてから `createCMS` の `cache` に渡すことで、
R2 / Next.js ISR 以外のストレージ（Redis / Memcached / S3 など）にキャッシュを差し替えられる。

## CacheAdapter の構造

```ts
import type { CacheAdapter, DocumentCacheOps, ImageCacheOps } from "@notion-headless-cms/core";

// handles で document / image のどちらを担当するかを宣言する
const myAdapter: CacheAdapter = {
  name: "my-cache",
  handles: ["document", "image"],
  doc: myDocumentOps,  // DocumentCacheOps の実装
  img: myImageOps,     // ImageCacheOps の実装
};
```

## DocumentCacheOps の実装例（Redis）

```ts
import type {
  DocumentCacheOps,
  CachedItemList,
  CachedItemMeta,
  CachedItemContent,
  BaseContentItem,
  InvalidateScope,
  CacheAdapter,
} from "@notion-headless-cms/core";
import { CMSError } from "@notion-headless-cms/core";

class RedisDocumentOps implements DocumentCacheOps {
  constructor(private readonly redis: RedisClient, private readonly prefix = "") {}

  async getList<T extends BaseContentItem>(collection: string): Promise<CachedItemList<T> | null> {
    const raw = await this.redis.get(`${this.prefix}list:${collection}`);
    return raw ? JSON.parse(raw) : null;
  }

  async setList<T extends BaseContentItem>(collection: string, data: CachedItemList<T>): Promise<void> {
    await this.redis.set(`${this.prefix}list:${collection}`, JSON.stringify(data));
  }

  async getMeta<T extends BaseContentItem>(collection: string, slug: string): Promise<CachedItemMeta<T> | null> {
    const raw = await this.redis.get(`${this.prefix}meta:${collection}:${slug}`);
    return raw ? JSON.parse(raw) : null;
  }

  async setMeta<T extends BaseContentItem>(collection: string, slug: string, data: CachedItemMeta<T>): Promise<void> {
    try {
      await this.redis.set(`${this.prefix}meta:${collection}:${slug}`, JSON.stringify(data));
    } catch (err) {
      throw new CMSError({
        code: "cache/io_failed",
        message: "Failed to write to Redis cache.",
        cause: err,
        context: { operation: "RedisDocumentOps.setMeta", collection, slug },
      });
    }
  }

  async getContent(collection: string, slug: string): Promise<CachedItemContent | null> {
    const raw = await this.redis.get(`${this.prefix}content:${collection}:${slug}`);
    return raw ? JSON.parse(raw) : null;
  }

  async setContent(collection: string, slug: string, data: CachedItemContent): Promise<void> {
    await this.redis.set(`${this.prefix}content:${collection}:${slug}`, JSON.stringify(data));
  }

  async invalidate(scope: InvalidateScope): Promise<void> {
    if (scope === "all") {
      await this.redis.del(`${this.prefix}*`); // パターン削除
      return;
    }
    const { collection } = scope;
    if ("slug" in scope) {
      await Promise.all([
        this.redis.del(`${this.prefix}meta:${collection}:${scope.slug}`),
        this.redis.del(`${this.prefix}content:${collection}:${scope.slug}`),
      ]);
    } else {
      await Promise.all([
        this.redis.del(`${this.prefix}list:${collection}`),
        this.redis.del(`${this.prefix}meta:${collection}:*`),
        this.redis.del(`${this.prefix}content:${collection}:*`),
      ]);
    }
  }
}

export function redisCache(redis: RedisClient, prefix = ""): CacheAdapter {
  return {
    name: "redis",
    handles: ["document"],
    doc: new RedisDocumentOps(redis, prefix),
  };
}
```

## ImageCacheOps の実装例（S3）

```ts
import type { ImageCacheOps, StorageBinary, CacheAdapter } from "@notion-headless-cms/core";

class S3ImageOps implements ImageCacheOps {
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

export function s3ImageCache(): CacheAdapter {
  return {
    name: "s3",
    handles: ["image"],
    img: new S3ImageOps(),
  };
}
```

## createCMS で利用

複数のアダプタを配列で渡せる。先着順で `handles` の担当が割り当てられる。

```ts
import { createCMS } from "@notion-headless-cms/core";

const cms = createCMS({
  collections: { /* ... */ },
  cache: [
    redisCache(redis, "myapp:"),
    s3ImageCache(),
  ],
  swr: { ttlMs: 5 * 60_000 },
});
```

単一アダプタで document + image 両方を担う場合は:

```ts
cache: [{
  name: "my-unified",
  handles: ["document", "image"],
  doc: myDocOps,
  img: myImgOps,
}]
```
