import type { RuntimeSortInput } from "../query/where.js";
import { evaluateWhere, sortByMeta } from "../query/where.js";
import type { IndexEntry } from "../types/collection-index.js";
import type { JsonValue } from "../types/json-value.js";
import type { ListResult } from "../types/query.js";
import { deepEqualJson } from "./deep-equal-json.js";
import type { DocStore } from "./types.js";

const DEFAULT_LIMIT = 20;

export interface ListRuntimeParams {
  readonly where?: Record<string, Record<string, JsonValue>>;
  readonly sort?: readonly RuntimeSortInput[];
  readonly cursor?: string;
  readonly limit?: number;
}

export interface IndexStore {
  findEntry(collection: string, slug: string): Promise<IndexEntry | null>;
  listEntries(
    collection: string,
    params: ListRuntimeParams,
  ): Promise<ListResult<IndexEntry>>;
  /** listed 問わず全件（buildPageIndex の内部リンク解決用）。 */
  listAllEntries(collection: string): Promise<readonly IndexEntry[]>;
  /** listed 問わず全 slug（reconcile の突合用）。 */
  listSlugs(collection: string): Promise<readonly string[]>;
  /**
   * 該当 slug の entry を追加/更新する。差分が無ければ書き込みをスキップする。
   * `knownExisting` に呼び出し側が直前に読んだ現行値（存在しなければ null）を渡すと
   * 点キーの再読み込みを省略できる（省略時 = undefined は内部で読み直す）。
   *
   * `writes` は実際に発行した KV 書き込み操作数（0=スキップ / 1=点キーのみ /
   * 2=点キー+マニフェスト）。無料枠（1日1000 write）の予算計測に使う。
   */
  upsertEntry(
    collection: string,
    entry: IndexEntry,
    knownExisting?: IndexEntry | null,
  ): Promise<IndexWriteResult>;
  removeEntry(collection: string, slug: string): Promise<IndexWriteResult>;
}

export interface IndexWriteResult {
  /** 1 回でも KV 書き込みが発生したか。 */
  readonly wrote: boolean;
  /** 発行した KV 書き込み操作数（delete も 1 回として数える）。 */
  readonly writes: number;
}

function pointKey(collection: string, slug: string): string {
  return `entry-index:${collection}:${slug}`;
}

function manifestKey(collection: string): string {
  return `list-index:${collection}`;
}

/**
 * notion-driver.ts の `syncEntry` は meta に `lastEditedTime`(= version と同じ値)を
 * 必ず含める。これを含めたまま比較すると、version が変わるたび(= 内容編集のたび)に
 * 必ず meta も不一致になり、マニフェスト書き込みスキップが機能しなくなる。version は
 * 別途比較済みなので、ここでは lastEditedTime を除いた meta 同士を比較する。
 */
function metaForManifestComparison(meta: JsonValue): JsonValue {
  if (
    meta !== null &&
    typeof meta === "object" &&
    !Array.isArray(meta) &&
    "lastEditedTime" in meta
  ) {
    const { lastEditedTime: _lastEditedTime, ...rest } = meta as Record<
      string,
      JsonValue
    >;
    return rest;
  }
  return meta;
}

/**
 * KV(想定)上のコレクション index 読み書き。2 種類のキーに分離する:
 *
 * - 点読みキー(`entry-index:{collection}:{slug}`): `find()` 用。version が変わる
 *   たび(= Notion 側で何か変更があるたび)に必ず書く。`versionedCache` が version を
 *   キャッシュキーに使うため、これが古いと find() が古いコンテンツを返し続ける。
 * - 一覧マニフェストキー(`list-index:{collection}`): `list()`/`listAllEntries()`/
 *   `listSlugs()` 用。コレクション全件を 1 キーに JSON 配列で持つ。`listed`/`meta` が
 *   実際に変わった時だけ書く(本文ブロックだけの編集は version は進むが meta/listed は
 *   変わらないことがほとんどのため、ここをスキップして KV 書き込み予算を節約する)。
 *
 * 同一コレクションへの並行書き込みは `SyncCoordinatorCore.runChunk()` が変更を
 * 1 件ずつ順次処理するため発生しない(マニフェストの read-modify-write レースは無い)。
 */
export function createIndexStore(docs: DocStore): IndexStore {
  async function readManifest(collection: string): Promise<IndexEntry[]> {
    const raw = await docs.get(manifestKey(collection));
    return raw ? (JSON.parse(raw) as IndexEntry[]) : [];
  }

  async function findEntry(
    collection: string,
    slug: string,
  ): Promise<IndexEntry | null> {
    const raw = await docs.get(pointKey(collection, slug));
    return raw ? (JSON.parse(raw) as IndexEntry) : null;
  }

  return {
    findEntry,
    async listEntries(collection, params) {
      const listed = (await readManifest(collection)).filter((e) => e.listed);
      const filtered = listed.filter((e) =>
        evaluateWhere(e.meta as Record<string, JsonValue>, params.where),
      );
      const sorted = sortByMeta(
        filtered,
        params.sort,
        (e) => e.meta as Record<string, JsonValue>,
      );

      const offset = params.cursor
        ? Math.max(0, Number.parseInt(params.cursor, 10) || 0)
        : 0;
      const limit = Math.max(0, params.limit ?? DEFAULT_LIMIT);
      const page = sorted.slice(offset, offset + limit);
      const hasMore = offset + limit < sorted.length;

      return {
        items: page,
        nextCursor: hasMore ? String(offset + limit) : null,
        hasMore,
      };
    },
    async listAllEntries(collection) {
      return readManifest(collection);
    },
    async listSlugs(collection) {
      return (await readManifest(collection)).map((e) => e.slug);
    },
    async upsertEntry(collection, entry, knownExisting) {
      const existing =
        knownExisting !== undefined
          ? knownExisting
          : await findEntry(collection, entry.slug);
      if (existing && existing.version === entry.version) {
        return { wrote: false, writes: 0 }; // Notion 側で何も変わっていない
      }

      await docs.put(pointKey(collection, entry.slug), JSON.stringify(entry));
      let writes = 1;

      const manifestChanged =
        !existing ||
        existing.listed !== entry.listed ||
        !deepEqualJson(
          metaForManifestComparison(existing.meta),
          metaForManifestComparison(entry.meta),
        );
      if (manifestChanged) {
        const manifest = await readManifest(collection);
        const idx = manifest.findIndex((e) => e.slug === entry.slug);
        const next =
          idx === -1
            ? [...manifest, entry]
            : manifest.map((e, i) => (i === idx ? entry : e));
        await docs.put(manifestKey(collection), JSON.stringify(next));
        writes += 1;
      }
      return { wrote: true, writes };
    },
    async removeEntry(collection, slug) {
      const existing = await findEntry(collection, slug);
      if (!existing) return { wrote: false, writes: 0 };
      await docs.delete(pointKey(collection, slug));
      const manifest = await readManifest(collection);
      await docs.put(
        manifestKey(collection),
        JSON.stringify(manifest.filter((e) => e.slug !== slug)),
      );
      return { wrote: true, writes: 2 };
    },
  };
}
