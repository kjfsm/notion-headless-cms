---
"@notion-headless-cms/sql": minor
---

新パッケージ `@notion-headless-cms/sql` を追加した。`@notion-headless-cms/cms` の `IndexStore` 契約を Kysely で実装し、D1（`./d1`）・Node の `better-sqlite3`（`./sqlite`）・libSQL/Turso（`./libsql`）向けの永続化された index ストアを提供する（`cms` 本体はゼロ依存原則のため Kysely をここに分離した）。

コレクションのプロパティのうち where/sort 演算子を持つ型（title/richText/url/select/status/multiSelect/date/createdTime/number/checkbox）だけ実カラム化し、pushdown で WHERE/ORDER BY を評価する。加えて FTS5 全文検索（trigram tokenizer）を各コレクションに自動生成し、`cms.<collection>.search()` を実際に高速化する。スキーマ進化（プロパティ追加）は `ALTER TABLE ADD COLUMN` で追従する。v1 は SQLite 系（D1/better-sqlite3/libSQL）のみ対応。
