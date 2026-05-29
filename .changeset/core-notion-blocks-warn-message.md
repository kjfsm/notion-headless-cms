---
"@notion-headless-cms/core": patch
---

`notionBlocks()` が `undefined` を返したときの警告メッセージを正確化。既定 (blocks 戦略) では設定不要で利用できること、`markdownFetcher` 使用時は markdown→React の Renderer を使うか `blocksFetcher()` に切り替える旨を案内する。挙動は不変。
