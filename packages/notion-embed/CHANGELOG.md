# @notion-headless-cms/embeds

## 0.1.1

### Patch Changes

- 2d88e56: YouTube 系コンテンツの 3 形態 (bookmark カード / link_mention 文字 / YouTube カード) を Notion 風に正しく描画できるように修正:

  - `renderRichText` の `mention.link_mention` が API レスポンスの `icon_url` / `link_provider` / `title` を使い、Notion 上のインラインリンクメンションと同等の `<img>` アイコン + プロバイダ名 + 太字タイトルを出力するようになった
  - `youtubeProvider` に `display: "iframe" | "card"` オプションを追加。`card` モードでは bookmark 風 OGP カード HTML を返す。動画 ID が抽出できないチャンネル URL 等も `card` に自動フォールバック
  - `renderBookmark` および YouTube card モードの出力を `<div class="nhc-bookmark-block">` でラップし、markdown 経由で `<p><a><div></div></a></p>` の構造が HTML5 パーサに分解されないように修正
  - rehype-sanitize の基本スキーマで `class` 属性を `className` に修正し、HAST との整合性を取りつつ deepMergeSchema を override 先頭挿入に変更。これにより `nhc-*` クラスが全て保持されるようになった (これまで `class=""` に空化されていた)

## 0.1.0

### Minor Changes

- e6d043b: 新パッケージ `@notion-headless-cms/notion-embed` を追加。

  Notion の各種ブロック（bookmark / embed / link_preview / video / audio / pdf / image / callout / toggle / paragraph / heading / list / quote / to_do）を Notion 風 HTML にレンダリングする。`notionEmbed()` を `createCMS()` の引数に差し込むだけで使える。

  - OGP カード（bookmark ブロック）のレンダリング（in-memory TTL キャッシュ付き）
  - rich_text の mention（link_mention / link_preview / page / database / date / user / custom_emoji）と全アノテーション対応
  - Steam / YouTube / Vimeo / Twitter / DLsite / generic iframe の embed プロバイダー
  - `rehype-raw` + `rehype-sanitize` をセットで返す `embedRehypePlugins()`

  `@notion-headless-cms/renderer` に `allowDangerousHtml` オプションを追加。

### Patch Changes

- Updated dependencies [e6d043b]
  - @notion-headless-cms/renderer@0.1.5
