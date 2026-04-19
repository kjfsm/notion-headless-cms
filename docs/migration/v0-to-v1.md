# v0 → v1 移行ガイド

v1 は破壊的変更を含むメジャーバージョンアップです。

## 主な変更点

### `createCMS()` のシグネチャ変更

**v0（旧）**
```ts
import { createCMS } from "@notion-headless-cms/core";

const cms = createCMS({
  env: { NOTION_TOKEN, NOTION_DATA_SOURCE_ID },
  storage: r2StorageAdapter,
  schema: { publishedStatuses: ["公開"] },
});
```

**v1（新）**
```ts
import { createCMS } from "@notion-headless-cms/core";
import { notionAdapter } from "@notion-headless-cms/source-notion";
import { r2Cache } from "@notion-headless-cms/cache-r2";

const cms = createCMS({
  source: notionAdapter({ token: NOTION_TOKEN, dataSourceId: NOTION_DATA_SOURCE_ID }),
  cache: {
    document: r2Cache({ bucket: CACHE_BUCKET }),
    image: r2Cache({ bucket: CACHE_BUCKET }),
    ttlMs: 5 * 60_000,
  },
  schema: { publishedStatuses: ["公開"] },
});
```

### メソッド名の変更

| v0（旧） | v1（新） |
|---|---|
| `getItems()` | `list()` |
| `getItemBySlug(slug)` | `findBySlug(slug)` |
| `renderItem(item)` | `render(item)` |
| `renderItemBySlug(slug)` | `renderBySlug(slug)` |
| `getItemsCachedFirst()` | `getList()` |
| `getItemCachedFirst(slug)` | `getItem(slug)` |
| `checkItemsUpdate(version)` | `checkListUpdate(version)` |
| `getCachedItemList()` | `docCache.getList()`（直接公開なし） |
| `setCachedItemList(items)` | `docCache.setList()`（直接公開なし） |
| `getCachedItem(slug)` | `docCache.getItem()`（直接公開なし） |
| `setCachedItem(slug, data)` | `docCache.setItem()`（直接公開なし） |

### `CMSConfig` の削除

`CMSConfig` / `CMSEnv` / `StorageAdapter` インターフェースは削除されました。
代わりに `CreateCMSOptions` / `DataSourceAdapter` / `DocumentCacheAdapter` / `ImageCacheAdapter` を使用します。

### `createCloudflareCMS()` のシグネチャ変更

**v0（旧）**
```ts
createCloudflareCMS(env, config?)
// env: { NOTION_TOKEN, NOTION_DATA_SOURCE_ID, CACHE_BUCKET? }
// config: Omit<CMSConfig, "storage" | "env">
```

**v1（新）**
```ts
createCloudflareCMS({ env, schema, content, cache })
```

### `cache-r2` の変更

**v0（旧）**
```ts
import { createCloudflareR2StorageAdapter } from "@notion-headless-cms/cache-r2";
const storage = createCloudflareR2StorageAdapter(bucket);
```

**v1（新）**
```ts
import { r2Cache } from "@notion-headless-cms/cache-r2";
const cache = r2Cache({ bucket });
// DocumentCacheAdapter & ImageCacheAdapter を実装
```

### renderer / transformer の設定移動

`CMSConfig.transformer` と `CMSConfig.renderer` は `CreateCMSOptions.content` に統合されました。

**v0（旧）**
```ts
createCMS({
  transformer: { blocks: { ... } },
  renderer: { imageProxyBase, remarkPlugins, rehypePlugins },
});
```

**v1（新）**
```ts
createCMS({
  content: {
    blocks: { ... },
    imageProxyBase,
    remarkPlugins,
    rehypePlugins,
  },
});
```

### `waitUntil` の移動

**v0（旧）**: `getItemsCachedFirst({ waitUntil })` の引数
**v1（新）**: `createCMS({ waitUntil })` のオプション

## 新規追加 API

v1 で追加されたメソッド（移行不要、必要に応じて活用）:
- `listByStatus()`, `where()`, `paginate()`, `getAdjacent()`
- `prefetchAll()`, `getStaticSlugs()`, `revalidate()`, `syncFromWebhook()`
