# @notion-headless-cms/react-renderer

## 0.0.2

### Patch Changes

- 2257467: react-renderer 経由でも Notion ブロックツリーと画像をキャッシュできるようにする。

  - core: `DataSource.loadNotionBlocks` (optional) を追加し、`CachedItemContent` / `ItemWithContent` に `notionBlocks` を含める。`cms.posts.find()` 経由で SWR キャッシュに乗る。
  - core: `cms.cacheImage` / `cms.imageProxyBase` を公開。画像キャッシュが設定されていれば Notion 画像 URL を SHA256 ハッシュキーのプロキシ URL へ変換できる。
  - notion-orm: `NotionCollection.loadNotionBlocks` を実装 (内部で `fetchBlockTree` を呼ぶ)。
  - react-renderer: `@notion-headless-cms/react-renderer/server` サブパスから `resolveBlockImageUrls(blocks, cacheImage)` を提供。サーバー側で image / video / audio / file / pdf の file 型 URL をプロキシ URL へ事前解決する。

## 0.0.1

### Patch Changes

- aa3b1d5: `@notion-headless-cms/react-renderer` パッケージを新規追加。Notion API のブロックレスポンスを React コンポーネント (shadcn/ui + Tailwind v4) として直接描画する。`notion-to-md` を経由せず、Notion 全 block type に対応する。あわせて `@notion-headless-cms/notion-orm` に `fetchBlockTree(client, pageId)` を追加し、children を再帰的に解決済みのブロック木を返せるようにした。
