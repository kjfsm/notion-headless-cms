import type {
  IndexEntry,
  IndexStore,
  IndexUpsertInput,
  IndexWriteResult,
  JsonValue,
  ListRuntimeParams,
  SchemaDef,
} from "@notion-headless-cms/cms";
import type { Kysely } from "kysely";
import { sql } from "kysely";

import { entryTableName, ensureSchema, ftsTableName, queryableColumns } from "./schema.js";
import type { QueryableColumn } from "./schema.js";
import { applySort, applyWhere } from "./where-to-sql.js";

const DEFAULT_LIMIT = 20;

interface EntryRow {
  readonly slug: string;
  readonly version: string;
  readonly listed: number;
  readonly meta: string;
}

function rowToEntry(row: EntryRow): IndexEntry {
  return {
    slug: row.slug,
    version: row.version,
    listed: Boolean(row.listed),
    meta: JSON.parse(row.meta) as JsonValue,
  };
}

function toColumnValue(column: QueryableColumn, raw: JsonValue | undefined): unknown {
  if (raw === undefined || raw === null) return null;
  if (column.type === "integer") return raw ? 1 : 0; // checkbox のみ integer 型（boolean → 0/1）
  if (Array.isArray(raw)) return JSON.stringify(raw); // multiSelect は JSON 配列を TEXT で保持
  return raw;
}

function offsetOf(cursor: string | undefined): number {
  return cursor ? Math.max(0, Number.parseInt(cursor, 10) || 0) : 0;
}

/**
 * Kysely(D1/better-sqlite3/libSQL いずれも SQLite 系）で `IndexStore` を実装する。
 * per-collection の実テーブル(`cms_entry_<collection>`)＋FTS5 仮想テーブル(`cms_fts_<collection>`)
 * を初回アクセス時に用意する（`ensureSchema`、以後はキャッシュして再実行しない）。
 *
 * `meta` 列には返却ペイロードそのもの（`IndexEntry.meta`）を JSON で保持し、`prop_*` 列は
 * where/sort の pushdown 専用の派生値（読み出しには使わない）。FTS5 は本文が R2 由来で
 * content テーブルを持てないため、トリガではなく `upsertEntry`/`removeEntry` 内で明示的に
 * 二重書きする（emdash の外部コンテンツ FTS5 とは異なる方式）。
 */
// biome-ignore lint/suspicious/noExplicitAny: dialect(D1/better-sqlite3/libSQL)非依存の Kysely インスタンスを受け取るため型消去する。
export function createSqlIndexStore(db: Kysely<any>, schemaDef: SchemaDef): IndexStore {
  let ensured: Promise<void> | null = null;
  function ensure(): Promise<void> {
    ensured ??= ensureSchema(db, schemaDef);
    return ensured;
  }

  function columnsFor(collection: string): readonly QueryableColumn[] {
    const def = schemaDef.collections[collection];
    return def ? queryableColumns(def.properties) : [];
  }

  async function readEntry(table: string, slug: string): Promise<IndexEntry | null> {
    const row = await db
      .selectFrom(table)
      .select(["slug", "version", "listed", "meta"])
      .where("slug", "=", slug)
      .executeTakeFirst();
    return row ? rowToEntry(row as EntryRow) : null;
  }

  async function runList(
    collection: string,
    // biome-ignore lint/suspicious/noExplicitAny: 同上（listEntries/search 双方から呼ぶ共通処理のため base クエリの型も消去される）。
    base: any,
    params: ListRuntimeParams,
    // search() は fts/entry テーブルを JOIN するため slug 等の列名が両テーブルに存在し曖昧になる。
    // 呼び出し側にテーブル修飾込みの select 列を指定させることで listEntries/search 両方に対応する。
    selectColumns: readonly string[],
    orderByFallback?: (qb: any) => any,
  ): Promise<{ items: IndexEntry[]; total: number }> {
    const columns = columnsFor(collection);
    const filtered = applyWhere(base, columns, params.where);
    const countRow = await filtered.select(sql<number>`count(*)`.as("count")).executeTakeFirst();
    const total = Number(countRow?.count ?? 0);

    const offset = offsetOf(params.cursor);
    const limit = Math.max(0, params.limit ?? DEFAULT_LIMIT);
    let itemsQb =
      params.sort && params.sort.length > 0
        ? applySort(filtered, columns, params.sort)
        : orderByFallback
          ? orderByFallback(filtered)
          : filtered;
    itemsQb = itemsQb.select(selectColumns).offset(offset).limit(limit);
    const rows = await itemsQb.execute();
    return { items: rows.map((r: EntryRow) => rowToEntry(r)), total };
  }

  return {
    async findEntry(collection, slug) {
      await ensure();
      return readEntry(entryTableName(collection), slug);
    },

    async listEntries(collection, params) {
      await ensure();
      const table = entryTableName(collection);
      const base = db.selectFrom(table).where("listed", "=", 1);
      const { items, total } = await runList(collection, base, params, [
        "slug",
        "version",
        "listed",
        "meta",
      ]);
      const offset = offsetOf(params.cursor);
      const limit = Math.max(0, params.limit ?? DEFAULT_LIMIT);
      return {
        items,
        nextCursor: offset + limit < total ? String(offset + limit) : null,
        hasMore: offset + limit < total,
        total,
      };
    },

    async listAllEntries(collection) {
      await ensure();
      const rows = await db
        .selectFrom(entryTableName(collection))
        .select(["slug", "version", "listed", "meta"])
        .execute();
      return rows.map((r: EntryRow) => rowToEntry(r));
    },

    async listSlugs(collection) {
      await ensure();
      const rows = await db.selectFrom(entryTableName(collection)).select(["slug"]).execute();
      return rows.map((r: { slug: string }) => r.slug);
    },

    async search(collection, query, params) {
      await ensure();
      const table = entryTableName(collection);
      const fts = ftsTableName(collection);
      const base = db
        .selectFrom(`${fts} as f`)
        .innerJoin(`${table} as e`, "e.slug", "f.slug")
        .where("e.listed", "=", 1)
        .where(sql<boolean>`f.search_text MATCH ${query}`)
        .clearSelect();

      // where/sort は素の列名(prop_*)で評価できる（fts 側に同名列が無く曖昧性が無いため）。
      // select は e/f 両方に slug 列があり曖昧になるため、テーブル修飾したエイリアスで指定する。
      const { items, total } = await runList(
        collection,
        base,
        params,
        ["e.slug as slug", "e.version as version", "e.listed as listed", "e.meta as meta"],
        (qb) => qb.orderBy(sql`bm25(${sql.raw(fts)})`, "asc"),
      );
      const offset = offsetOf(params.cursor);
      const limit = Math.max(0, params.limit ?? DEFAULT_LIMIT);
      return {
        items,
        nextCursor: offset + limit < total ? String(offset + limit) : null,
        hasMore: offset + limit < total,
        total,
      };
    },

    async upsertEntry(
      collection,
      entry: IndexUpsertInput,
      knownExisting,
    ): Promise<IndexWriteResult> {
      await ensure();
      const table = entryTableName(collection);
      const fts = ftsTableName(collection);
      const columns = columnsFor(collection);

      const existing =
        knownExisting !== undefined ? knownExisting : await readEntry(table, entry.slug);
      if (existing && existing.version === entry.version) {
        return { wrote: false, writes: 0 };
      }

      const meta = entry.meta as Record<string, JsonValue> | null;
      const values: Record<string, unknown> = {
        slug: entry.slug,
        version: entry.version,
        listed: entry.listed ? 1 : 0,
        meta: JSON.stringify(entry.meta),
      };
      for (const col of columns) {
        values[col.column] = toColumnValue(col, meta?.[col.propKey]);
      }

      await db
        .insertInto(table)
        .values(values)
        .onConflict((oc: any) => oc.column("slug").doUpdateSet(values))
        .execute();

      // FTS5 は本文が R2 由来で content テーブルを持てないため明示二重書きする(トリガ不使用)。
      // D1 は対話型トランザクション非対応だが、書き込みは SyncCoordinator の単一直列キュー経由
      // でのみ発生するため（他の書き手が同時に存在しない）、非トランザクションの逐次実行で足りる。
      await sql`DELETE FROM ${sql.raw(fts)} WHERE slug = ${entry.slug}`.execute(db);
      if (entry.searchText) {
        await db
          .insertInto(fts)
          .values({ search_text: entry.searchText, slug: entry.slug })
          .execute();
      }

      return { wrote: true, writes: 1 };
    },

    async removeEntry(collection, slug) {
      await ensure();
      const table = entryTableName(collection);
      const fts = ftsTableName(collection);
      const existing = await readEntry(table, slug);
      if (!existing) return { wrote: false, writes: 0 };

      await db.deleteFrom(table).where("slug", "=", slug).execute();
      await sql`DELETE FROM ${sql.raw(fts)} WHERE slug = ${slug}`.execute(db);
      return { wrote: true, writes: 1 };
    },
  };
}
