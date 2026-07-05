---
"@notion-headless-cms/cms": patch
---

`ListResult` に `total`（`where` 適用後・ページング前の総件数）を追加した。`index-store.ts` の `listEntries` はフィルタ・ソート後の配列を既に手元に持っているため、ページャ UI が件数表示するために利用側で全件回収するような回避策を不要にする。
