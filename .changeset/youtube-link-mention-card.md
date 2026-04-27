---
"@notion-headless-cms/notion-embed": patch
---

YouTube 系コンテンツの 3 形態 (bookmark カード / link_mention 文字 / YouTube カード) を Notion 風に正しく描画できるように修正:

- `renderRichText` の `mention.link_mention` が API レスポンスの `icon_url` / `link_provider` / `title` を使い、Notion 上のインラインリンクメンションと同等の `<img>` アイコン + プロバイダ名 + 太字タイトルを出力するようになった
- `youtubeProvider` に `display: "iframe" | "card"` オプションを追加。`card` モードでは bookmark 風 OGP カード HTML を返す。動画 ID が抽出できないチャンネル URL 等も `card` に自動フォールバック
- `renderBookmark` および YouTube card モードの出力を `<div class="nhc-bookmark-block">` でラップし、markdown 経由で `<p><a><div></div></a></p>` の構造が HTML5 パーサに分解されないように修正
- rehype-sanitize の基本スキーマで `class` 属性を `className` に修正し、HAST との整合性を取りつつ deepMergeSchema を override 先頭挿入に変更。これにより `nhc-*` クラスが全て保持されるようになった (これまで `class=""` に空化されていた)
