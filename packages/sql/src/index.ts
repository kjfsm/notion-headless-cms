/**
 * Kysely コア（dialect 非依存）のエントリ。D1/SQLite/libSQL 固有のファクトリは
 * それぞれ `./d1` / `./sqlite` / `./libsql` サブパスで提供する（対応する dialect
 * ドライバを optional peerDependency にとどめ、未使用ランタイムへの依存を避けるため）。
 */
export { createSqlIndexStore } from "./index-store.js";
export type { QueryableColumn, SqlColumnType } from "./schema.js";
export { entryTableName, ensureSchema, ftsTableName, queryableColumns } from "./schema.js";
