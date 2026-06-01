---
description: @notion-headless-cms/core の設計方針（ゼロ依存・SWR・更新検知）
paths:
  - "packages/core/**"
---

# core パッケージ

## ゼロ依存の原則

- `@notionhq/client` / `unified` / `zod` / `@notion-headless-cms/markdown-html` を**静的 import しない**
- renderer は `CreateClientOptions.renderer`（`RendererFn`）で注入。`@notion-headless-cms/client` の `createCMS`（content モード）が自動注入する
- 何も指定しない場合のみ、動的 `import("@notion-headless-cms/markdown-html")` でフォールバック（オプショナル peerDep）

## SWR（Stale-While-Revalidate）

- まずキャッシュを返し、**TTL 切れはブロッキングで再取得**（ユーザー要件: 古いデータは返さない）
- バックグラウンドの更新検知 (Webhook / `check()`) は fail-soft で動く
- `CreateClientOptions.swr.ttlMs` が有効期間
- `cms.posts.list()` / `cms.posts.find(slug)` が SWR アクセサ
- `cms.posts.cache.invalidate()` / `cms.posts.cache.warm()` / `cms.invalidate(scope?)` が管理 API
- `cms.posts.check(slug, version)` / `cms.posts.peekVersion(slug)` が差分 API
- cache 配列が空 (= noop) のときは何もキャッシュされず source への素通し

## 更新検知

- Notion の `last_edited_time` でキャッシュ内容と比較
- 差分があれば HTML を再生成
- `cms.posts.check(slug, version)` がリクエスト本体での差分チェック API
- Webhook 経由は `cms.handler({ webhookSecret })` または `createNextHandler(cms, ...)` でルーティングする

## 画像処理

- Notion 画像 URL は期限付きなので、fetch → SHA256 ハッシュキーで永続ストレージに保存
- `core/src/image.ts` の `fetchAndCacheImage` が担当
- HTTP 失敗時は `CMSError code: "cache/image_fetch_failed"`
- フロントエンドには `{imageProxyBase}/{hash}` で配信（デフォルト: `/api/images`）
- `cms.cacheImage` (`(url: string) => Promise<string>`) を public API として公開。利用側 (例: `resolveBlockImageUrls`) に渡してプロキシ URL を事前解決させる

## キャッシュ抽象

- `CacheAdapter` / `DocumentCacheOps` / `ImageCacheOps` は `core/src/types/cache.ts` 定義
- 新キャッシュ実装は `CacheAdapter` (handles + doc/img) を実装するだけ
- `core` は `memoryCache`（document + image 両対応、LRU）と `noopDocOps` / `noopImgOps` を同梱

## サブパスエクスポート

`@notion-headless-cms/core/errors`, `/hooks`, `/cache/memory`, `/cache/noop` を利用側に提供。`package.json` の `exports` を崩さないこと。
