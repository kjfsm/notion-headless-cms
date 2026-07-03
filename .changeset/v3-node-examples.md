---
"@notion-headless-cms/cms": patch
---

`examples/minimal-node`・`examples/node-hono`・`examples/node-express` を v2 API
（`@notion-headless-cms/client`）から v3 API（`@notion-headless-cms/cms`）へ書き直した。

- codegen（`nhc generate`）を廃止し、`src/schema.ts` に `defineCollection`/`defineSchema`
  を直接書く方式に統一
- `post.html()`/`post.markdown()`（関数を剥がす儀式）を廃止し、`cms.posts.find()` が返す
  プレーンな `EntrySnapshot`（`post.blocks`）をそのまま使う。HTML化が必要な場合は
  `renderBlocksToHtml`（`@notion-headless-cms/cms/html`）を使う
- webhook・画像プロキシ・OGP 等の個別配線を `cms.fetch(request)` 1本に統合
- `node-express` は Fetch API を話さないため、`Request`/`Response` 変換アダプタ
  （`src/lib/web-adapter.ts`）を追加した
- 一括同期スクリプト向けに `cms.sync.kick()` を `cursor` が尽きるまでループする
  パターンを導入（chunked sync は元々 Workers の Alarm 継続を想定した設計のため）
