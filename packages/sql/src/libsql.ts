import type { LibsqlDialectConfig } from "@libsql/kysely-libsql";
import { LibsqlDialect } from "@libsql/kysely-libsql";
import type { IndexStore, SchemaDef } from "@notion-headless-cms/cms";
import { Kysely } from "kysely";

import { createSqlIndexStore } from "./index-store.js";

/**
 * libSQL(Turso 等)を使う `IndexStore`。ローカル埋め込み利用時は `{ url: "file:./data.db" }` や
 * `{ url: ":memory:" }`、リモート利用時は `{ url: "libsql://...", authToken }` を渡す。
 * D1 と異なり対話型トランザクションに対応する。
 *
 * @example
 * const cms = createCMS({ schema, stores: { index: libsqlIndexStore({ url: "file:./data.db" }, schema) } });
 */
// biome-ignore lint/suspicious/noExplicitAny: コレクションごとに動的な列集合を持つため静的 Database 型を持てない（index-store.ts と同じ意図）。
export function libsqlIndexStore(config: LibsqlDialectConfig, schema: SchemaDef): IndexStore {
  const db = new Kysely<any>({ dialect: new LibsqlDialect(config) });
  return createSqlIndexStore(db, schema);
}
