---
"@notion-headless-cms/core": patch
"@notion-headless-cms/adapter-next": patch
---

webhook `:collection` 単一経路化・adapter-next ハンドラ分割

**core**:
- Webhook URL パターンを `POST /revalidate/:collection` に変更（汎用 JSON body フォールバック廃止）
- `HandlerAdapter.parseWebhook` を `parseWebhookFor(collection, req, secret)` に置換。未知コレクションは `webhook/unknown_collection`、未実装は `webhook/not_implemented` CMSError をスロー
- 新エラーコード追加: `webhook/signature_invalid`, `webhook/payload_invalid`, `webhook/unknown_collection`, `webhook/not_implemented`
- CMSError コードから HTTP ステータスへの明示マッピング (401/400/404/501)

**adapter-next**:
- `createRevalidateRouteHandler` を廃止し以下の 2 関数に分割:
  - `createCollectionRevalidateRouteHandler` — `/api/revalidate/[collection]/route.ts` 用。JSON パース失敗は 400 を返す
  - `createInvalidateAllRouteHandler` — 全体無効化用の管理エンドポイント向け
