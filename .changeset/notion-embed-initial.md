---
"@notion-headless-cms/notion-embed": minor
"@notion-headless-cms/renderer": patch
---

新パッケージ `@notion-headless-cms/notion-embed` を追加。

Notion の各種ブロック（bookmark / embed / link_preview / video / audio / pdf / image / callout / toggle / paragraph / heading / list / quote / to_do）を Notion 風 HTML にレンダリングする。`notionEmbed()` を `createCMS()` の引数に差し込むだけで使える。

- OGP カード（bookmark ブロック）のレンダリング（in-memory TTL キャッシュ付き）
- rich_text の mention（link_mention / link_preview / page / database / date / user / custom_emoji）と全アノテーション対応
- Steam / YouTube / Vimeo / Twitter / DLsite / generic iframe の embed プロバイダー
- `rehype-raw` + `rehype-sanitize` をセットで返す `embedRehypePlugins()`

`@notion-headless-cms/renderer` に `allowDangerousHtml` オプションを追加。
