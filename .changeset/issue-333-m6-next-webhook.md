---
"@notion-headless-cms/next": patch
---

M6: Webhook → revalidate の補助ヘルパーを追加 (Issue #333)

- `createNextWebhookHandler(cms, { secret, revalidate })` を `@notion-headless-cms/next` から公開
  - `cms.handler({ webhookSecret })` を内部で再利用しつつ、ペイロード処理後に Next.js の `revalidateTag` / `revalidatePath` まで 1 リクエストで完結
  - `revalidate` には固定値 `{ tags, paths }` または webhook ペイロードから決まる `InvalidateScope` を受ける関数 (`NextRevalidateResolver`) を渡せる
- low-level の `createNextHandler` / `cms.handler` / `cms.invalidate` は引き続き利用可能
- `examples/vercel-nextjs` に `app/api/cms/webhook/[collection]/route.ts` を追加し、新ヘルパーを使う例を示す
