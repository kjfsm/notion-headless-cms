---
"@notion-headless-cms/cli": patch
---

`nhc generate` 実行時に Notion API が一時的なエラー（429 / 502 / 503 / 504）を返した場合、指数バックオフでリトライするようになりました（最大 4 回）。CI の間欠的な失敗（"DNS cache overflow" など）に対してより安定します。
