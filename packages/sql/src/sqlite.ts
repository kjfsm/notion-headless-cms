import type { IndexStore, SchemaDef } from "@notion-headless-cms/cms";
import type { Database as BetterSqlite3Database } from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";

import { createSqlIndexStore } from "./index-store.js";

/**
 * Node ランタイム向け SQLite(`better-sqlite3`)を使う `IndexStore`。
 * `better-sqlite3` はネイティブアドオンのため、`node:sqlite`(Node24 の experimental)
 * や Workers では使えない（Workers は `./d1` を使う）。
 *
 * @example
 * import Database from "better-sqlite3";
 * const cms = createCMS({ schema, stores: { index: sqliteIndexStore(new Database("./data.db"), schema) } });
 */
// biome-ignore lint/suspicious/noExplicitAny: コレクションごとに動的な列集合を持つため静的 Database 型を持てない（index-store.ts と同じ意図）。
export function sqliteIndexStore(database: BetterSqlite3Database, schema: SchemaDef): IndexStore {
  const db = new Kysely<any>({ dialect: new SqliteDialect({ database }) });
  return createSqlIndexStore(db, schema);
}
