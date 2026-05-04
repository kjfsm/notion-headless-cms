---
"@notion-headless-cms/core": patch
"@notion-headless-cms/notion-orm": patch
"@notion-headless-cms/react-renderer": patch
---

react-renderer 経由でも Notion ブロックツリーと画像をキャッシュできるようにする。

- core: `DataSource.loadNotionBlocks` (optional) を追加し、`CachedItemContent` / `ItemWithContent` に `notionBlocks` を含める。`cms.posts.find()` 経由で SWR キャッシュに乗る。
- core: `cms.cacheImage` / `cms.imageProxyBase` を公開。画像キャッシュが設定されていれば Notion 画像 URL を SHA256 ハッシュキーのプロキシ URL へ変換できる。
- notion-orm: `NotionCollection.loadNotionBlocks` を実装 (内部で `fetchBlockTree` を呼ぶ)。
- react-renderer: `@notion-headless-cms/react-renderer/server` サブパスから `resolveBlockImageUrls(blocks, cacheImage)` を提供。サーバー側で image / video / audio / file / pdf の file 型 URL をプロキシ URL へ事前解決する。
