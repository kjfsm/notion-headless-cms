import type { RuntimeSortInput } from "../query/where.js";
import { evaluateWhere, sortByMeta } from "../query/where.js";
import type { IndexEntry } from "../types/collection-index.js";
import type { JsonValue } from "../types/json-value.js";
import type { ListResult } from "../types/query.js";

const DEFAULT_LIMIT = 20;

export interface ListRuntimeParams {
  readonly where?: Record<string, Record<string, JsonValue>>;
  readonly sort?: readonly RuntimeSortInput[];
  readonly cursor?: string;
  readonly limit?: number;
}

/** `upsertEntry` に渡す入力。全文検索用のプレーンテキストを任意で同梱する。 */
export type IndexUpsertInput = IndexEntry & { readonly searchText?: string };

export interface IndexWriteResult {
  /** 1 回でも書き込みが発生したか。 */
  readonly wrote: boolean;
  /** 発行した書き込み操作数（予算計測・コスト見積り用。実装依存）。 */
  readonly writes: number;
}

export interface IndexStore {
  findEntry(collection: string, slug: string): Promise<IndexEntry | null>;
  listEntries(collection: string, params: ListRuntimeParams): Promise<ListResult<IndexEntry>>;
  /** listed 問わず全件（buildPageIndex の内部リンク解決用）。 */
  listAllEntries(collection: string): Promise<readonly IndexEntry[]>;
  /** listed 問わず全 slug（reconcile の突合用）。 */
  listSlugs(collection: string): Promise<readonly string[]>;
  /** `searchText`（`upsertEntry` で渡した本文平文）に対する全文検索。`where`/`sort`/`cursor`/`limit` も併用できる。 */
  search(
    collection: string,
    query: string,
    params: ListRuntimeParams,
  ): Promise<ListResult<IndexEntry>>;
  /**
   * 該当 slug の entry を追加/更新する。差分が無ければ書き込みをスキップする。
   * `knownExisting` に呼び出し側が直前に読んだ現行値（存在しなければ null）を渡すと
   * 再読み込みを省略できる（省略時 = undefined は内部で読み直す）。
   */
  upsertEntry(
    collection: string,
    entry: IndexUpsertInput,
    knownExisting?: IndexEntry | null,
  ): Promise<IndexWriteResult>;
  removeEntry(collection: string, slug: string): Promise<IndexWriteResult>;
}

interface StoredRecord {
  readonly entry: IndexEntry;
  readonly searchText?: string;
}

function paginate(items: readonly IndexEntry[], params: ListRuntimeParams): ListResult<IndexEntry> {
  const offset = params.cursor ? Math.max(0, Number.parseInt(params.cursor, 10) || 0) : 0;
  const limit = Math.max(0, params.limit ?? DEFAULT_LIMIT);
  const page = items.slice(offset, offset + limit);
  const hasMore = offset + limit < items.length;
  return {
    items: page,
    nextCursor: hasMore ? String(offset + limit) : null,
    hasMore,
    total: items.length,
  };
}

/**
 * ゼロバインディング環境（KV/R2/D1 いずれも無い）向けの in-memory `IndexStore`。
 * Workers 等 SQLite が使えないランタイムのフォールバックとしても使う。
 * プロセス内 `Map` のみで完結するため、プロセス再起動・cold start のたびに消える
 * （永続化・スケールを要する用途は `@notion-headless-cms/sql` の D1/SQLite/libSQL 実装を使う）。
 */
export function memoryIndexStore(): IndexStore {
  const collections = new Map<string, Map<string, StoredRecord>>();

  function collectionMap(collection: string): Map<string, StoredRecord> {
    let map = collections.get(collection);
    if (!map) {
      map = new Map();
      collections.set(collection, map);
    }
    return map;
  }

  function filterAndSort(entries: readonly IndexEntry[], params: ListRuntimeParams): IndexEntry[] {
    const filtered = entries.filter((e) =>
      evaluateWhere(e.meta as Record<string, JsonValue>, params.where),
    );
    return sortByMeta(filtered, params.sort, (e) => e.meta as Record<string, JsonValue>);
  }

  return {
    async findEntry(collection, slug) {
      return collectionMap(collection).get(slug)?.entry ?? null;
    },

    async listEntries(collection, params) {
      const listed = [...collectionMap(collection).values()]
        .map((r) => r.entry)
        .filter((e) => e.listed);
      return paginate(filterAndSort(listed, params), params);
    },

    async listAllEntries(collection) {
      return [...collectionMap(collection).values()].map((r) => r.entry);
    },

    async listSlugs(collection) {
      return [...collectionMap(collection).keys()];
    },

    async search(collection, query, params) {
      const q = query.toLowerCase();
      const matched = [...collectionMap(collection).values()]
        .filter((r) => r.entry.listed && r.searchText?.toLowerCase().includes(q))
        .map((r) => r.entry);
      return paginate(filterAndSort(matched, params), params);
    },

    async upsertEntry(collection, entry, knownExisting) {
      const map = collectionMap(collection);
      const existing =
        knownExisting !== undefined ? knownExisting : (map.get(entry.slug)?.entry ?? null);
      if (existing && existing.version === entry.version) {
        return { wrote: false, writes: 0 }; // Notion 側で何も変わっていない
      }
      const { searchText, ...indexEntry } = entry;
      map.set(entry.slug, { entry: indexEntry, searchText });
      return { wrote: true, writes: 1 };
    },

    async removeEntry(collection, slug) {
      const map = collectionMap(collection);
      if (!map.has(slug)) return { wrote: false, writes: 0 };
      map.delete(slug);
      return { wrote: true, writes: 1 };
    },
  };
}
