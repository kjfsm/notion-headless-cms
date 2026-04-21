# v0 → v1 移行ガイド

v1 は破壊的変更を含むメジャーバージョンアップ。未公開（初回 npm 公開前）の内部変更も含めてまとめる。

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
import { renderMarkdown } from "@notion-headless-cms/renderer";
import { r2Cache } from "@notion-headless-cms/cache-r2";

const cms = createCMS({
  source: notionAdapter({ token: NOTION_TOKEN, dataSourceId: NOTION_DATA_SOURCE_ID }),
  renderer: renderMarkdown,
  cache: {
    document: r2Cache({ bucket: CACHE_BUCKET }),
    image: r2Cache({ bucket: CACHE_BUCKET }),
    ttlMs: 5 * 60_000,
  },
  schema: { publishedStatuses: ["公開"] },
});
```

> `renderer` を省略した場合、`core` は動的 `import("@notion-headless-cms/renderer")` でフォールバックする。
> アダプタ（`adapter-cloudflare` / `adapter-node`）を使う場合は自動で注入される。

### メソッド名の変更

v1 で CMS の API は一新された。`@deprecated` だった旧メソッドはすべて削除済み。

| v0（旧） | v1（新） |
|---|---|
| `getItems()` / `list()`（旧名） | `list()` |
| `getItemBySlug(slug)` / `findBySlug(slug)`（旧名） | `find(slug)` |
| `renderItem(item)` | `render(item)` |
| `renderItemBySlug(slug)` | `find(slug)` → `render(item)`、または `cached.get(slug)` |
| `getItemsCachedFirst()` / `getList()`（旧名） | `cached.list()` |
| `getItemCachedFirst(slug)` / `getItem(slug)`（旧名） | `cached.get(slug)` |
| `listByStatus(status)` | `query().status(status).execute()` |
| `where(predicate)` | `query().where(predicate).execute()` |
| `paginate({ page, perPage })` | `query().paginate({ page, perPage }).execute()` |
| `getAdjacent(slug)` | `query().adjacent(slug)` |
| `prefetchAllLegacy()` | `cache.prefetchAll()` |
| `syncFromWebhook(payload)` | `cache.sync(payload)` |
| `revalidate(scope)` | `cache.revalidate(scope)` |
| `checkItemsUpdate(version)` / `checkListUpdate` | `cache.checkList(version)` |
| `checkItemUpdate(slug, lastEdited)` | `cache.checkItem(slug, lastEdited)` |

### `CMSConfig` 型の削除

`CMSConfig` / `CMSEnv` / `StorageAdapter` は削除済み。代わりに以下を使う:
- `CreateCMSOptions<T>`
- `DataSourceAdapter<T>`
- `DocumentCacheAdapter<T>`
- `ImageCacheAdapter`

### `createCloudflareCMS()` のシグネチャ変更

**v0（旧）**
```ts
createCloudflareCMS(env, config?)
// env: { NOTION_TOKEN, NOTION_DATA_SOURCE_ID, CACHE_BUCKET? }
```

**v1（新）**
```ts
createCloudflareCMS({ env, schema, content, cache })
// env 型は CloudflareCMSEnv（v0 の CloudfareCMSEnv からスペル修正）
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
const cache = r2Cache({ bucket }); // DocumentCacheAdapter & ImageCacheAdapter
```

`bucket` の型は構造型 `R2BucketLike`。`@cloudflare/workers-types` への実依存はなくなり、モック差し替えが容易になった。

### renderer / transformer の設定統合

`CMSConfig.transformer` と `CMSConfig.renderer` は `CreateCMSOptions.content` に統合された。

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
    imageProxyBase,
    remarkPlugins,
    rehypePlugins,
  },
});
// カスタムブロックハンドラは notionAdapter({ blocks }) へ移動
```

### `BaseContentItem` の最小化

v0 では `id` / `slug` / `status` / `publishedAt` / `updatedAt` がすべて必須だった。v1 では `status` / `publishedAt` が**オプション**になった。ステータスプロパティや日付プロパティがない DB でも型エラーなく使える。

```ts
interface BaseContentItem {
  id: string;
  slug: string;
  updatedAt: string;
  status?: string;      // v1 でオプション化
  publishedAt?: string; // v1 でオプション化
}
```

### エラーコード体系

v0 では `"CONFIG_INVALID" | "NOTION_ITEM_SCHEMA_INVALID" | ...` の固定 union だった。v1 では `namespace/kind` 形式に統一し、サードパーティアダプタが独自コードを使えるよう拡張可能になった。

```ts
type BuiltInCMSErrorCode =
  | "core/config_invalid"
  | "core/schema_invalid"
  | "source/fetch_items_failed"
  | "source/fetch_item_failed"
  | "source/load_markdown_failed"
  | "cache/io_failed"
  | "renderer/failed";

type CMSErrorCode = BuiltInCMSErrorCode | (string & {});
```

名前空間判定は `isCMSErrorInNamespace(err, "source/")` を使う。

### パッケージ構成の変更

| v0 | v1 |
|---|---|
| `@notion-headless-cms/fetcher`（公開） | `@notion-headless-cms/source-notion` に内包（`private: true`） |
| `@notion-headless-cms/transformer`（公開） | `@notion-headless-cms/source-notion` に内包（`private: true`） |
| — | `@notion-headless-cms/adapter-node` を新規公開 |
| — | `@notion-headless-cms/adapter-next` を新規公開 |
| — | `@notion-headless-cms/cache-next` を新規公開 |

`core` からは `@notionhq/client` / `unified` / `zod` / `renderer` への依存がすべて取り除かれ、外部ランタイム依存ゼロになった。

### `waitUntil` の移動

**v0（旧）**: `getItemsCachedFirst({ waitUntil })` の引数
**v1（新）**: `createCMS({ waitUntil })` のオプション

## 新規追加 API

- `cms.query()` — QueryBuilder（status / tag / where / sortBy / paginate / execute / executeOne / adjacent）
- `cms.cache` — キャッシュ管理グループ（prefetchAll / revalidate / sync / checkList / checkItem）
- `cms.cached` — SWR アクセサ（list / get）
- `definePlugin()` — フック・ロガー・リトライ設定をまとめて注入するプラグイン
- `isCMSErrorInNamespace(err, "source/")` — 名前空間判定ヘルパー
