---
"@notion-headless-cms/cms": patch
---

`createCMS` に `logger` / `logLevel` を追加し、同期・配信経路を構造化ログで監視できるようにした。

- `logger`（`debug`/`info`/`warn`/`error` を持つオブジェクト）と `logLevel`（下限レベル）を受け取り、`logLevel` 未満のレベルは内部で抑制する（未指定なら no-op）
- 計装点: Notion クエリ失敗（error）・entry の同期成功（debug）／失敗（warn）・API リトライ待機（debug、`attempt`/`backoffMs` 付き）・webhook 受信（info）／署名不正（warn）・画像 404（warn）
- `Logger` / `LogLevel` / `LogContext` 型をエクスポート
