---
"@notion-headless-cms/core": patch
"@notion-headless-cms/react-renderer": patch
---

Notion 内部リンクの slug 自動解決を追加（#356 / D6）。

- core に `buildPageIndex` / `createPageLinkResolver` / `normalizePageId` を追加。`cms` のコレクションを走査して pageId → {collection, slug, title} の逆引きインデックスを構築し、`resolvePageUrl` / `resolvePageTitle` 関数ペアを生成する（ゼロ依存・純関数）。URL 既定は `/${collection}/${slug}`、`url` オプションで上書き可。
- react-renderer のリッチテキスト page / database mention を `resolvePageUrl` / `resolvePageTitle` 対応にし、解決できればリンク化、できなければ従来表示にフォールバック。
- `ResolvePageUrlFn` の戻り値を `string | undefined` に緩和（後方互換）。未解決時は `link_to_page` が `#id` にフォールバックする挙動を維持。
