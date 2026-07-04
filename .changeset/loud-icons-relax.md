---
"@notion-headless-cms/cms": patch
---

`@notion-headless-cms/cms/cloudflare` から `SyncCoordinatorDOInstance` 型を export した。

- `createSyncCoordinatorDO()` の戻り値（DO コンストラクタ）が実装するインスタンス型は、
  利用側が Worker から re-export して `wrangler.toml` にバインドする必要がある公開契約の
  一部だが、これまで export リストから漏れていた
- 未 export のため、`tsc -b`（`composite: true`）でこの型を含む宣言ファイルを出力する際に
  「名前を付けられない型」エラーになっていた
