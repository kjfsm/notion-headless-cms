---
"@notion-headless-cms/cms": major
---

index ストレージを KV から `IndexStore` 抽象へ全面移行した。`createCMS({ stores: { docs } })` は `stores: { index }` に改名し、`kvDocStore`/`DocStore`/`memoryDocStore` を削除した（`@notion-headless-cms/cms/cloudflare` の `kvDocStore` エクスポートも削除）。永続化・スケール・全文検索が必要な場合は新パッケージ `@notion-headless-cms/sql` の `d1IndexStore`/`sqliteIndexStore`/`libsqlIndexStore` を使う。省略時は引き続き in-memory（`memoryIndexStore()`）にフォールバックするため、バインディング無しでも動作する。

あわせて `cms.<collection>.search(query, params?)` を新規追加した。`upsertEntry` に渡す `searchText`（同期時に本文から抽出したプレーンテキスト）に対する全文検索で、`find`/`list` 同様リクエスト処理中に Notion API を呼ばない。`@notion-headless-cms/sql` の SQL 実装では FTS5（trigram tokenizer）で索引化される。

`@notion-headless-cms/cms/node` の `fileDocStore` は `fileIndexStore` に改名した（`memoryIndexStore` を JSON ファイルへ永続化する実装、native 依存なし）。
