---
"@notion-headless-cms/cms": patch
---

createCMS の `stores` と `scheduler` を省略可能にし、未指定時は in-memory ストア（`memoryDocStore()`/`memoryBlobStore()`）と `createNodeSyncScheduler()` にフォールバックするようにした。これにより KV/R2/DO バインディングが無い環境（ローカル・プレビュー等）でも Notion トークンだけで最低限動作し、KV/R2/DO を足すと永続化・高速化される（progressive enhancement）。

あわせて `@notion-headless-cms/cms/cloudflare` に `cloudflareStores(bindings)` を追加。`docs`(KV)/`blobs`(R2)/`cache`(Cache API) のバインディング有無を見て、ある slot は KV/R2 ストア、無い slot はメモリストアへ per-binding にフォールバックした `stores` を組み立てる。
