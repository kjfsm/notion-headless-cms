---
"@notion-headless-cms/notion-orm": patch
"@notion-headless-cms/cloudflare": patch
---

Cloudflare フリープランのサブリクエスト制限対策

- `notion-orm`: `fetchBlockTree` にグローバル Semaphore による並列数制限を追加（デフォルト `concurrency: 3`）。`Promise.all` 無制限並列を廃止し Notion API レート制限への抵触を解消。`loadMarkdown` にリクエスト内メモ化を追加し API 呼び出し数を削減。
- `cloudflare`: `restKvNamespace()` を追加。Cloudflare KV REST API を `KVNamespaceLike` として実装するアダプタで、Node.js warm スクリプトから KV へ事前書き込みできる。ウォームアップ後は Worker が Notion API を一切叩かなくなる。
