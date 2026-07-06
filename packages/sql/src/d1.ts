import type { D1Database } from "@cloudflare/workers-types";
import type { IndexStore, SchemaDef } from "@notion-headless-cms/cms";
import { Kysely } from "kysely";
import { D1Dialect } from "kysely-d1";

import { createSqlIndexStore } from "./index-store.js";

/**
 * Cloudflare Workers 向け D1 を使う `IndexStore`（`wrangler.toml` の `d1_databases` で
 * binding した `env.DB` をそのまま渡す）。
 *
 * D1 は対話型トランザクションに対応しない（`kysely-d1` も `.transaction()` を提供しない）ため、
 * `index-store.ts` の書き込みは非トランザクションの逐次実行になる。読者リクエスト中は Notion API
 * を呼ばない北極星と同様、書き込みは常に `SyncCoordinatorCore` の単一直列キュー経由のみで発生する
 * 前提のため、これで整合性は保たれる。
 *
 * @example
 * export default {
 *   async fetch(req, env) {
 *     const cms = createCMS({ schema, stores: { index: d1IndexStore(env.DB, schema) } });
 *     return cms.fetch(req);
 *   },
 * };
 */
// biome-ignore lint/suspicious/noExplicitAny: コレクションごとに動的な列集合を持つため静的 Database 型を持てない（index-store.ts と同じ意図）。
export function d1IndexStore(database: D1Database, schema: SchemaDef): IndexStore {
  const db = new Kysely<any>({ dialect: new D1Dialect({ database }) });
  return createSqlIndexStore(db, schema);
}
