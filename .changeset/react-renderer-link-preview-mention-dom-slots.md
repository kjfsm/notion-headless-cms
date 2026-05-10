---
"@notion-headless-cms/react-renderer": patch
"@notion-headless-cms/next": patch
---

react-renderer: LinkPreview・Mention の残存ハードコード `<a>`/`<img>` を Context の Image/Link スロットに差替

- `LinkPreview.tsx` の非OGP fallback `<a>` を `useNotionContext()` の `Link` スロット経由に変更
- `Mention.tsx` の `link_mention`・`link_preview` の `<a>` と、`link_mention` アイコン・`custom_emoji` の `<img>` を `useNotionContext()` の `Link`/`Image` スロット経由に変更
- `@notion-headless-cms/next` に next/image・next/link 注入例を含む README.md を追加
