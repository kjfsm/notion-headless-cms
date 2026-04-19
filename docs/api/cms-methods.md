# CMS メソッド一覧

## コンテンツ取得

| メソッド | 説明 |
|---|---|
| `list()` | 公開済みコンテンツ一覧をソースから直接取得 |
| `findBySlug(slug)` | スラッグでコンテンツを取得 |
| `render(item)` | アイテムを Markdown → HTML にレンダリング |
| `renderBySlug(slug)` | スラッグから取得 → レンダリング |
| `isPublished(item)` | publishedStatuses に含まれるか判定 |

## 便利 API

| メソッド | 説明 |
|---|---|
| `listByStatus(status)` | ステータスでフィルタした一覧 |
| `where(predicate)` | 任意の述語でフィルタ |
| `paginate({ page, perPage })` | ページネーション付き一覧 |
| `getAdjacent(slug)` | 前後のコンテンツを取得 |
| `getStaticSlugs()` | 静的生成用スラッグ一覧 |
| `prefetchAll({ concurrency?, onProgress? })` | 全コンテンツを事前キャッシュ |
| `revalidate(scope?)` | キャッシュを無効化 |
| `syncFromWebhook(payload?)` | Webhook からキャッシュ更新 |

## SWR（Stale-While-Revalidate）

| メソッド | 説明 |
|---|---|
| `getList()` | キャッシュ優先で一覧取得 |
| `getItem(slug)` | キャッシュ優先で単一アイテム取得 |
| `checkListUpdate(version)` | 一覧の変更を検知 |
| `checkItemUpdate(slug, lastEdited)` | 単一アイテムの変更を検知 |

## 画像配信

| メソッド | 説明 |
|---|---|
| `getCachedImage(hash)` | ハッシュキーで画像バイナリを取得 |
| `createCachedImageResponse(hash)` | ハッシュキーで Response を生成 |
