---
"@notion-headless-cms/cms": patch
---

`examples/vercel-nextjs` を v2 API から v3 API（`@notion-headless-cms/cms`）へ書き直した。

- `createNextHandler`/`createNextWebhookHandler`（2種併用）を `cms.fetch()` 1本 +
  `revalidatePath` 呼び出し専用の webhook route（Next.js の `after()` でレスポンス確定後に
  ISR キャッシュを掃く）に統合
- `post.markdown()` + `fetch-markdown/react` の `<Renderer>` を、`denormalizeBlocks`/
  `toPageLinkMap`（`@notion-headless-cms/react-renderer/v3`）+ 既存の `<NotionRenderer>` に置換
- Vercel の serverless/edge 関数はインスタンス間でメモリを共有しないため、in-memory store は
  コールドスタートごとに再同期が必要という制約を明記した（`ensureSynced()` ヘルパー）
