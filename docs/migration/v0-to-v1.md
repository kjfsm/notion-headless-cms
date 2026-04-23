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
| `renderItemBySlug(slug)` | `find(slug)` → `render(item)`、または `cms.cache.read.get(slug)` |
| `getItemsCachedFirst()` / `getList()`（旧名） | `cms.cache.read.list()` |
| `getItemCachedFirst(slug)` / `getItem(slug)`（旧名） | `cms.cache.read.get(slug)` |
| `listByStatus(status)` | `query().status(status).execute()` |
| `where(predicate)` | `query().where(predicate).execute()` |
| `paginate({ page, perPage })` | `query().paginate({ page, perPage }).execute()` |
| `getAdjacent(slug)` | `query().adjacent(slug)` |
| `prefetchAllLegacy()` | `cms.cache.manage.prefetchAll()` |
| `syncFromWebhook(payload)` | `cms.cache.manage.sync(payload)` |
| `revalidate(scope)` | `cms.cache.manage.revalidate(scope)` |
| `checkItemsUpdate(version)` / `checkListUpdate` | `cms.cache.manage.checkList(version)` |
| `checkItemUpdate(slug, lastEdited)` | `cms.cache.manage.checkItem(slug, lastEdited)` |

> v1 ではキャッシュ系 API を `cms.cache.read.*`（SWR 読み取り）と `cms.cache.manage.*`（管理操作）の 2 グループに再編した。旧 `cms.cached.*` / `cms.cache.<mutator>` は削除されており、互換レイヤは提供されない。

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
createCloudflareCMS({ env, schema, content, ttlMs })
// env 型は CloudflareCMSEnv（v0 の CloudfareCMSEnv からスペル修正）
// キャッシュアダプタは env.CACHE_BUCKET から自動生成されるため cache オプションは廃止
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

## v1 初回公開時の追加変更（API ハードニング）

初回公開前の構造整理として、以下の破壊的変更が加わっている。

### キャッシュアクセサの 3 階層化

`cms.cached.*` / `cms.cache.<mutator>` は削除され、`cms.cache.read` / `cms.cache.manage` に再編された（上記移行表を参照）。

### `CacheConfig` を discriminated union 化

`false` リテラルは廃止。代わりに文字列 `"disabled"` で完全無効化を表現する。

```ts
// before
{ cache: { document: false, image: false } }
// after
{ cache: "disabled" }
// または document / image / ttlMs を個別指定
{ cache: { document: memoryDocumentCache(), image: memoryImageCache(), ttlMs: 300_000 } }
```

### `source-notion` の peer 化

`@notionhq/client` と `zod` は `peerDependencies` に移動した。利用側で明示的にインストールする必要がある。公開 API から `@notionhq/client/build/src/api-endpoints` の内部パス import は除去され、代わりに `NotionPage` / `NotionRichTextItem` が `source-notion` から再エクスポートされる。

`NotionSchema<T>` から `zodSchema` フィールドも削除（`defineSchema()` 内部のクロージャで保持）。

### `renderer` の peer 化

`unified` / `remark-parse` / `remark-gfm` / `remark-rehype` / `rehype-stringify` / `unist-util-visit` は `peerDependencies` に移動した。複数バージョン同居による `Processor` インスタンス不一致の問題を回避するため。

`RenderOptions.remark/rehypePlugins` の型は `readonly unknown[]` → `PluggableList`（`@notion-headless-cms/renderer` から re-export）に変更。

### `adapter-cloudflare` / `adapter-node` のキャッシュオプション

- `createCloudflareCMS({ cache })` は廃止。代わりに `ttlMs?: number` を直接指定する
- `createNodeCMS({ cache })` は `"disabled" | { document?: "memory"; image?: "memory"; ttlMs? }` の union に変更

### メモリキャッシュの LRU 化

`memoryDocumentCache({ maxItems? })` / `memoryImageCache({ maxItems?, maxSizeBytes? })` でサイズ上限を指定できるようになった。Workers / 長期プロセスでの使用時に推奨。

### サブパスエクスポートの追加

`core` の `package.json` に以下のサブパスが追加された。

| サブパス | 内容 |
|---|---|
| `@notion-headless-cms/core/errors` | `CMSError` など |
| `@notion-headless-cms/core/hooks` | `mergeHooks` / `mergeLoggers` |
| `@notion-headless-cms/core/cache/memory` | `memoryDocumentCache` / `memoryImageCache` |

### 観測フックの例外隔離

`onCacheHit` / `onCacheMiss` 等の観測フックは `try/catch` で囲まれ、1 つのフックが例外を投げても他のフックや CMS 本体のリクエストに波及しなくなった。例外は `logger.error` に流される。

### `onRenderStart` / `onRenderEnd` フックを追加

レンダリング所要時間の観測が可能になった（詳細は [CMS API リファレンス](../api/cms-methods.md#ライフサイクルフック)）。

### `fetcher` / `transformer` パッケージの削除

`@notion-headless-cms/fetcher` / `@notion-headless-cms/transformer` は公開パッケージとしては削除された。機能はすべて `@notion-headless-cms/source-notion/src/internal/` に統合済み。

### Node.js バージョン要件

全パッケージの `engines.node` が `>=24` に引き上げられた。

### `createNodeCMS` / `createCloudflareCMS` をマルチソース一本に統合

単一ソース版の `createCloudflareCMS` / `createNodeCMS` と、マルチソース版 `createCloudflareCMSMulti` / `createNodeMultiCMS` に分かれていた API を 1 つに統合した。同名の `createCloudflareCMS` / `createNodeCMS` が `nhc generate` の `nhcSchema` を受け取り、各ソースに対応する `CMS` インスタンスのマップを返す形に変更されている。

```ts
// before (single)
const cms = createNodeCMS({ schema: { publishedStatuses: ["公開"] } });
await cms.list();

// before (multi)
const client = createNodeMultiCMS({ schema: nhcSchema });
await client.posts.list();

// after（統合後）
const client = createNodeCMS({
  schema: nhcSchema,
  sources: { posts: { published: ["公開"] } },
});
await client.posts.list();
```

旧 `createNodeMultiCMS` / `createCloudflareCMSMulti` および旧 `NodeCMSOptions` / `CreateCloudflareCMSOptions`（単一版）/ `CloudflareMultiCMSEnv` / `MultiSourceEntry` / `MultiSourceSchema` / `MultiCMSResult` は削除された。型名は次のように改名されている:

| 旧 | 新 |
|----|----|
| `MultiSourceEntry<T>` | `SourceEntry<T>`（`source-notion` から export） |
| `MultiSourceSchema` | `NHCSchema` |
| `MultiCMSResult<S>` | `CMSMap<S>` |
| `CloudflareMultiCMSEnv` | `CloudflareCMSEnv` |
| `CreateCloudflareCMSMultiOptions` | `CreateCloudflareCMSOptions` |
| `CreateNodeMultiCMSOptions` | `CreateNodeCMSOptions` |

あわせて `adapter-cloudflare` の `CloudflareCMSEnv` からは旧 `NOTION_DATA_SOURCE_ID` / `DB_NAME` フィールドが削除された（各ソースの `id` は `nhcSchema` から取得）。単一 DB で運用したい場合も `nhc.config.ts` に 1 件だけ登録する構成にする。

## 新規追加 API

- `cms.query()` — QueryBuilder（status / tag / where / sortBy / paginate / execute / executeOne / adjacent）
- `cms.cache.read` — SWR アクセサ（list / get）
- `cms.cache.manage` — キャッシュ管理グループ（prefetchAll / revalidate / sync / checkList / checkItem）
- `definePlugin()` — フック・ロガー・リトライ設定をまとめて注入するプラグイン
- `isCMSErrorInNamespace(err, "source/")` — 名前空間判定ヘルパー
- `onRenderStart` / `onRenderEnd` — レンダリング所要時間の観測フック
