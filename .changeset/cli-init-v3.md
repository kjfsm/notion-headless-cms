---
"@notion-headless-cms/cli": patch
---

`nhc init` に `@notion-headless-cms/cms` 向けの雛形一式（`nhc.config.ts`・`wrangler.toml`・`src/schema.ts`・`src/lib/do.ts`・`src/lib/cms.ts`・`src/index.ts`）生成を追加した。

`generateMountCodeTemplate()` はこれまで `throw new Error("not implemented: ...")` を含む未完成なマウントコードを生成しており、`commands/init.ts` からも呼び出されていなかった。`examples/cloudflare-hono` と同じ配線（`createSyncCoordinatorDO` + `durableObjectSyncDelegate` + `kvDocStore`/`r2BlobStore`）で実際に動くコードを生成するよう書き直し、`nhc init` に配線した。`nhc pull` と同様、`nhc.config.ts` 以外の生成物は既存ファイルを上書きしない。
