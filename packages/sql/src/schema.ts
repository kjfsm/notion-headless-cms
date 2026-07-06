import { CMSError } from "@notion-headless-cms/cms";
import type { CollectionDef, PropDef, PropertyMap, SchemaDef } from "@notion-headless-cms/cms";
import type { Kysely } from "kysely";
import { sql } from "kysely";

export type SqlColumnType = "text" | "real" | "integer";

export interface QueryableColumn {
  readonly propKey: string;
  readonly column: string;
  readonly type: SqlColumnType;
}

/**
 * `where`/`sort` に使える演算子を持つプロパティ種別だけ実カラムを生成する
 * （`types/query.ts` の `OperatorsForProp` と対応。formula/rollup/relation/people/files/uniqueId
 * は演算子を持たないため実カラム化せず、`meta` JSON にのみ保持する）。
 */
function columnTypeFor(def: PropDef): SqlColumnType | null {
  switch (def.kind) {
    case "title":
    case "richText":
    case "url":
    case "select":
    case "status":
    case "multiSelect": // JSON 配列を TEXT で保持し、has/hasAny/hasAll は json_each で評価する
    case "date":
    case "createdTime":
      return "text";
    case "number":
      return "real";
    case "checkbox":
      return "integer";
    default:
      return null;
  }
}

/**
 * プロパティキーを SQL 列名へ変換する。`slug`/`version`/`listed`/`meta` という
 * 予約列名と Notion プロパティキーが衝突しうる（例: `properties: { slug: prop.richText() }`）ため
 * `prop_` を必ず前置する。TS のオブジェクトキーは任意の文字列を取りうるため、
 * SQL 識別子として安全な文字だけに正規化する。
 */
function sanitizeColumnKey(key: string): string {
  const sanitized = key.replace(/[^a-zA-Z0-9_]/g, "_");
  if (!sanitized || /^[0-9]/.test(sanitized)) {
    throw new CMSError({
      code: "sql/invalid_property_key",
      message: `プロパティキー "${key}" から安全な SQL 列名を生成できません`,
      context: { operation: "sanitizeColumnKey", key },
    });
  }
  return `prop_${sanitized}`;
}

/** コレクションの `properties` から実カラム化対象を抽出する。列名衝突は早期に CMSError で検出する。 */
export function queryableColumns(properties: PropertyMap): readonly QueryableColumn[] {
  const seenBy = new Map<string, string>(); // column -> propKey
  const result: QueryableColumn[] = [];
  for (const [propKey, def] of Object.entries(properties)) {
    const type = columnTypeFor(def);
    if (!type) continue;
    const column = sanitizeColumnKey(propKey);
    const conflictingKey = seenBy.get(column);
    if (conflictingKey) {
      throw new CMSError({
        code: "sql/column_name_collision",
        message: `プロパティ "${propKey}" と "${conflictingKey}" が同じ SQL 列名 "${column}" に競合しています`,
        context: { operation: "queryableColumns", propKey, column },
      });
    }
    seenBy.set(column, propKey);
    result.push({ propKey, column, type });
  }
  return result;
}

export function entryTableName(collection: string): string {
  return `cms_entry_${collection}`;
}

export function ftsTableName(collection: string): string {
  return `cms_fts_${collection}`;
}

/**
 * `PRAGMA table_info` で既存列名を読む。D1/better-sqlite3/libSQL いずれも SQLite 系
 * （v1 は SQLite 系のみ対応）なので同じ PRAGMA が使える。Kysely 標準の introspector は
 * D1 が許可しない `pragma_table_info` の cross-join を内部で使うため使わない
 * （emdash の `d1-introspector.ts` が同じ制約を回避している）。
 */
// biome-ignore lint/suspicious/noExplicitAny: Kysely インスタンスは dialect(D1/better-sqlite3/libSQL)非依存で受け取るため型消去する。
async function existingColumns(db: Kysely<any>, table: string): Promise<Set<string>> {
  try {
    const rows = await sql<{ name: string }>`PRAGMA table_info(${sql.raw(table)})`.execute(db);
    return new Set(rows.rows.map((r) => r.name));
  } catch {
    return new Set(); // テーブル未作成
  }
}

// biome-ignore lint/suspicious/noExplicitAny: 同上。
async function ensureCollectionSchema(
  db: Kysely<any>,
  collection: string,
  def: CollectionDef,
): Promise<void> {
  const table = entryTableName(collection);
  const columns = queryableColumns(def.properties);
  const existing = await existingColumns(db, table);

  if (existing.size === 0) {
    let builder = db.schema
      .createTable(table)
      .ifNotExists()
      .addColumn("slug", "text", (c) => c.primaryKey())
      .addColumn("version", "text", (c) => c.notNull())
      .addColumn("listed", "integer", (c) => c.notNull())
      .addColumn("meta", "text", (c) => c.notNull());
    for (const col of columns) {
      builder = builder.addColumn(col.column, col.type);
    }
    await builder.execute();
    await db.schema
      .createIndex(`idx_${table}_listed`)
      .ifNotExists()
      .on(table)
      .column("listed")
      .execute();
  } else {
    // 既存コレクションへのプロパティ追加は ALTER TABLE ADD COLUMN で追従する（削除はしない）。
    for (const col of columns) {
      if (!existing.has(col.column)) {
        await db.schema.alterTable(table).addColumn(col.column, col.type).execute();
      }
    }
  }

  const fts = ftsTableName(collection);
  await sql`CREATE VIRTUAL TABLE IF NOT EXISTS ${sql.raw(fts)} USING fts5(search_text, slug UNINDEXED, tokenize='trigram')`.execute(
    db,
  );
}

/**
 * スキーマ全コレクション分の実テーブル(`cms_entry_<collection>`)と FTS5 仮想テーブルを用意する。
 * 初回は CREATE TABLE、プロパティ追加時は不足列を ALTER TABLE ADD COLUMN で追従する。
 * `createSqlIndexStore` が最初の呼び出し時に自動実行するため、通常は明示呼び出し不要。
 */
// biome-ignore lint/suspicious/noExplicitAny: 同上。
export async function ensureSchema(db: Kysely<any>, schemaDef: SchemaDef): Promise<void> {
  for (const [collection, def] of Object.entries(schemaDef.collections)) {
    await ensureCollectionSchema(db, collection, def);
  }
}
