# CMS メソッド一覧

`createCMS()` / `CMS` クラスが公開するメソッド。

## ソース直接取得

| メソッド | 説明 |
|---|---|
| `list()` | 公開済みコンテンツ一覧をソースから直接取得（`publishedStatuses` でフィルタ） |
| `find(slug)` | スラッグでコンテンツを取得（`accessibleStatuses` でフィルタ） |
| `render(item)` | アイテムを Markdown → HTML にレンダリングして `CachedItem` を返す |
| `isPublished(item)` | `publishedStatuses` に含まれるかどうかを返す |

## SWR（Stale-While-Revalidate）: `cms.cached`

| メソッド | 説明 |
|---|---|
| `cached.list()` | キャッシュ優先で一覧を返す。`{ items, isStale, cachedAt }` |
| `cached.get(slug)` | キャッシュ優先で単一アイテムを返す。`CachedItem \| null` |

キャッシュが `TTL` 切れ or 未ヒットの場合はソースから取得し、`waitUntil` 指定時は非同期で書き戻す。

## キャッシュ管理: `cms.cache`

| メソッド | 説明 |
|---|---|
| `cache.prefetchAll({ concurrency?, onProgress? })` | 全コンテンツを事前レンダリングしてキャッシュに保存 |
| `cache.revalidate(scope?)` | 指定スコープ（`"all"` または `{ slug }`）のキャッシュを無効化 |
| `cache.sync({ slug? })` | Webhook ペイロードを元にキャッシュを同期 |
| `cache.checkList(version)` | 一覧の更新有無を返す（`{ changed: true, items } \| { changed: false }`） |
| `cache.checkItem(slug, lastEdited)` | 単一アイテムの更新有無を返す |

## クエリビルダー

`cms.query()` で `QueryBuilder` を取得し、ステータス・タグ・述語・ソート・ページネーションを連鎖指定できる。

| メソッド | 説明 |
|---|---|
| `query().status(s \| [s])` | ステータスフィルタ（省略時は `publishedStatuses`） |
| `query().tag(t \| [t])` | `item.tags` に対するフィルタ |
| `query().where(predicate)` | 任意の述語でフィルタ |
| `query().sortBy(field, "asc" \| "desc")` | ソート指定 |
| `query().paginate({ page, perPage })` | ページネーション |
| `query().execute()` | `{ items, total, page, perPage, hasNext, hasPrev }` を返す |
| `query().executeOne()` | 最初の 1 件を返す |
| `query().adjacent(slug)` | 前後のコンテンツを返す（`{ prev, next }`） |

`DataSourceAdapter.query` を実装しているソースでは、`where()` 未使用時に限り Notion API へクエリを委譲する（push-down）。

## その他

| メソッド | 説明 |
|---|---|
| `getStaticSlugs()` | 静的生成用のスラッグ一覧を返す |
| `getCachedImage(hash)` | ハッシュキーで画像バイナリを取得 |
| `createCachedImageResponse(hash)` | ハッシュキーで `Response` を生成（`cache-control: public, max-age=31536000, immutable`） |

## エラーハンドリング

すべての内部エラーは `CMSError` に統一される。

```ts
import { isCMSError, isCMSErrorInNamespace } from "@notion-headless-cms/core";

try {
  await cms.list();
} catch (err) {
  if (isCMSErrorInNamespace(err, "source/")) {
    // Notion 取得系エラー
    console.error(err.code, err.context);
  } else if (isCMSError(err)) {
    console.error(err.code, err.message);
  } else {
    throw err;
  }
}
```

組み込みエラーコード:

| コード | 発生箇所 |
|---|---|
| `core/config_invalid` | 必須設定の欠落（例: `NOTION_TOKEN` 未設定） |
| `core/schema_invalid` | Zod / スキーマ検証失敗 |
| `source/fetch_items_failed` | `list()` の Notion 取得失敗 |
| `source/fetch_item_failed` | `find()` の Notion 取得失敗 |
| `source/load_markdown_failed` | ブロック → Markdown 変換失敗 |
| `cache/io_failed` | キャッシュ R/W 失敗・画像 fetch 失敗 |
| `renderer/failed` | Markdown → HTML レンダリング失敗 |
