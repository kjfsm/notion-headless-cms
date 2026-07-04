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
- `app/schema.ts` はスキーマキー（英語）が実際の Notion プロパティ名（日本語）と食い違って
  おり記事が一切取得できていなかった。`prop.*("実プロパティ名")` の別名指定
  （`@notion-headless-cms/cms` に新規追加）で修正した
- `<NotionRenderer>` に `ogpEndpoint="/api/cms/ogp"` を追加。埋め込みリンクのOGPサムネイル
  取得（`useOgp`）がクライアント側で発火していなかった不具合を修正した
