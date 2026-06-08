---
"@notion-headless-cms/core": patch
"@notion-headless-cms/react-renderer": patch
"@notion-headless-cms/client": patch
---

Notion 内部リンクの slug 自動解決を追加（#356 / D6）。

- core に `buildPageLinkMap` / `buildPageIndex` / `normalizePageId` を追加。`cms` のコレクションを走査して `正規化pageId → { href, title }` のプレーンマップを構築する（ゼロ依存・純関数）。URL 既定は `/${collection}/${slug}`、`url` オプションで上書き可。`@notion-headless-cms/client` からも re-export。
- react-renderer に `pageLinks` プロップを追加。`link_to_page` / page・database mention / `child_page` を `pageLinks` で自サイト URL に解決し、無ければ従来フォールバック。**プレーンオブジェクトのため React Router の loader 戻り値や RSC 境界を越えられる**（関数プロップ `resolvePageUrl` は越えられないため、内部リンクは `pageLinks` を推奨）。
- `ResolvePageUrlFn` の戻り値を `string | undefined` に緩和（後方互換）。`resolvePageUrl` / `resolvePageTitle` 関数プロップはカスタムルーティング用の escape hatch として存続。
