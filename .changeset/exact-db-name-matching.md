---
"@notion-headless-cms/cli": patch
---

`dbName` での DB 解決を完全一致のみに変更

- `nhc generate` での `dbName` 検索は完全一致のみを採用するようにした（部分一致のフォールバックを削除）
- 完全一致する DB が無い場合は `cli/notion_api_failed` で generate を失敗させる
- 同じ Notion インテグレーションから類似名の DB が複数アクセスできる場合の取り違えを防ぐ
