---
description: packages/sql（D1/SQLite/libSQL 向け IndexStore・Kysely・FTS5）の設計方針
paths:
  - "packages/sql/**"
---

# sql パッケージ

`@notion-headless-cms/sql` は `@notion-headless-cms/cms` の `IndexStore` 契約を Kysely で実装する
下位シブリング（依存方向 `sql → cms`。`cms` 自体はゼロ依存原則のため Kysely を持てない）。

## サブパスエクスポート

- `.`（本体）— dialect 非依存のコア。`createSqlIndexStore(db, schema)` / `ensureSchema` / `queryableColumns` 等
- `./d1` — Cloudflare D1（`kysely-d1`、コミュニティ dialect）。対話型トランザクション非対応
- `./sqlite` — Node 向け `better-sqlite3`（ネイティブアドオン。Workers/`node:sqlite` では使えない）
- `./libsql` — libSQL/Turso（`@libsql/kysely-libsql`）。トランザクション対応、`:memory:` ローカルモードあり

v1 は SQLite 系のみ対応（Postgres は follow-up）。3 dialect とも同じ SQL コアを共有する
（D1/libSQL/better-sqlite3 はいずれも SQLite 方言のため、方言分岐はほぼ不要）。

## スキーマ設計（`schema.ts`）

- プロパティのうち **where 演算子を持つ型のみ**実カラム化する（`types/query.ts` の `OperatorsForProp` と対応）。
  formula/rollup/relation/people/files/uniqueId は演算子を持たないため実カラム化しない（`meta` JSON にのみ保持）
- 実カラム名は `prop_<sanitized-key>` を前置する（`slug`/`version`/`listed`/`meta` という予約列名と
  Notion プロパティキーの衝突を避けるため。例: `properties: { slug: prop.richText() }` がありうる）
- テーブル: `cms_entry_<collection>`（実カラム + `meta` JSON 列）、`cms_fts_<collection>`（FTS5 仮想テーブル）
- スキーマ進化は `ensureSchema` が初回 `CREATE TABLE`、以後は不足列を `ALTER TABLE ADD COLUMN` で追従する
  （`PRAGMA table_info` で既存列を確認。Kysely 標準の introspector は D1 が拒否する
  `pragma_table_info` cross-join を使うため使わない）

## FTS5（全文検索）

- 本文（`searchText`）は R2 由来で content テーブルを持てないため、emdash の外部コンテンツ+トリガ方式は不採用。
  `upsertEntry`/`removeEntry` 内で明示的に `DELETE`→`INSERT` する（非トリガ）
- tokenizer は `trigram`。**3 文字未満のクエリはトリグラムを 1 つも作れず一致しない**（テストで踏みがちな罠）
- `search()` は `bm25()` 昇順（既定）または `params.sort` 明示時はそちらを優先

## テスト

- `packages/sql/src/__tests__/contract.test.ts` — `runIndexStoreContract`（`@notion-headless-cms/cms/testing`）を
  `sqliteIndexStore`/`libsqlIndexStore`（`:memory:`）に対して実行
- `packages/sql/src/__tests__/schema.test.ts` — `queryableColumns` の型マッピング・列名衝突検出
- `packages/sql/src/__tests__/schema-evolution.test.ts` — `ensureSchema` の `ALTER TABLE ADD COLUMN`
- `packages/sql/src/__tests__/where-operators.test.ts` — where 演算子ごとの SQL 変換（contains/has/date 範囲等）
