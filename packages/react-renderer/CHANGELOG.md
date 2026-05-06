# @notion-headless-cms/react-renderer

## 0.0.9

### Patch Changes

- 1be8726: bookmark カードの見た目を整理。OGP 画像を右端に揃え、`aspect-video` + `object-contain` で見切れを防止し、`w-40 sm:w-56` の最小幅を確保して小さくなりすぎないようにした。

## 0.0.8

### Patch Changes

- e0b4579: 依存パッケージのメジャーバージョンアップ: lucide-react 1.14.0、tailwind-merge 3.5.0

## 0.0.7

### Patch Changes

- c2e4f03: fix(react-renderer): ブックマークサムネイルの画像が見切れる問題を修正

## 0.0.6

### Patch Changes

- 13ad21c: embed ブロックを OGP カードではなく iframe で描画するよう修正し、ホスト別の推奨サイズを適用する（Steam widget は 646x190、その他は aspect-video）。

## 0.0.5

### Patch Changes

- 0a5c883: link_preview ブロックに OGP カード表示を追加

  - `fetchBlockTree` の OGP enrichment 対象に `link_preview` を追加（`LinkPreviewBlockWithOgp` 型を export）
  - `renderLinkPreview` が OGP 取得に対応。成功時は bookmark と同形状のカードを出力、失敗時はシンプルリンクにフォールバック。OG 画像は `loading="lazy"` でブラウザ側取得（ミラーリングなし）
  - `LinkPreview` React コンポーネントが `ogp` フィールドを持つ場合に `OgCard` を使用

- 9c3777b: embed/video ブロックの URL 判定を廃止

  - `Embed` コンポーネントの YouTube 専用分岐を削除。すべての embed URL を `OgCard` で統一描画
  - `Video` コンポーネントの YouTube 専用分岐を削除。`block.video.type` で `"file"` は `<video>` タグ、`"external"` は `<iframe>` を使用
  - 公開 API `Embeds.YouTubeEmbed` を削除
  - 内部ユーティリティ `isYouTubeUrl` / `extractYouTubeId` を削除

## 0.0.4

### Patch Changes

- a82db83: embed/bookmark ブロックを OG 情報ベースの汎用カードに統一。`fetchBlockTree(client, pageId, { ogp: { enabled: true, imageCache } })` で OG メタデータを取得して各ブロックに `ogp` フィールドとして付与し、react-renderer 側は YouTube 以外をすべて画像入りリンクカード (`OgCard`) で描画する。Steam / DLsite / Twitter / Vimeo / 汎用 iframe 専用コンポーネントは廃止。

## 0.0.3

### Patch Changes

- 1501e16: Code ブロックから shiki 依存を削除し、シンタックスハイライトせず素の `<pre><code>` で描画するように変更。バンドルサイズを大幅に削減。言語名は `data-language` 属性で参照可能。

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
