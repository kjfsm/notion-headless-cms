---
description: @notion-headless-cms/core の設計方針（ゼロ依存・SWR・更新検知）
paths:
  - "packages/core/**"
---

# core パッケージ

## ゼロ依存の原則

- `@notionhq/client` / `unified` / `zod` / `@notion-headless-cms/renderer` を**静的 import しない**
- renderer は `CreateCMSOptions.renderer`（`RendererFn`）で注入。アダプタ（`adapter-*`）が自動注入する
- 何も指定しない場合のみ、動的 `import("@notion-headless-cms/renderer")` でフォールバック（オプショナル peerDep）

## SWR（Stale-While-Revalidate）

- まずキャッシュを返し、TTL 切れなら**裏で非同期更新**
- `CreateCMSOptions.swr.ttlMs` が有効期間
- `cms.posts.list()` / `cms.posts.find(slug)` が SWR アクセサ
- `cms.cache.manage.prefetchAll()` / `revalidate()` / `sync()` / `checkList()` / `checkItem()` が管理 API
- `cache.document` / `cache.image` 未設定時は `noopDocumentCache` / `noopImageCache` がデフォルト

## 更新検知

- Notion の `last_edited_time` でキャッシュ内容と比較
- 差分があれば HTML を再生成
- `cms.cache.manage.checkItem(slug, lastEdited)` と `cms.cache.manage.checkList(version)` が差分 API

## 画像処理

- Notion 画像 URL は期限付きなので、fetch → SHA256 ハッシュキーで永続ストレージに保存
- `core/src/image.ts` の `fetchAndCacheImage` が担当
- HTTP 失敗時は `CMSError code: "cache/image_fetch_failed"`
- フロントエンドには `{imageProxyBase}/{hash}` で配信（デフォルト: `/api/images`）

## キャッシュ抽象

- `DocumentCacheAdapter<T>` / `ImageCacheAdapter` は `core/src/types/cache.ts` 定義
- 新キャッシュ実装はこのインターフェースを実装するだけ
- `core` は `memoryDocumentCache` / `memoryImageCache`（LRU 対応）と `noop*` を同梱

## サブパスエクスポート

`@notion-headless-cms/core/errors`, `/hooks`, `/cache/memory`, `/cache/noop` を利用側に提供。`package.json` の `exports` を崩さないこと。
