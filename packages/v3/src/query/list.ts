import type { IndexStore } from "../store/index-store.js";
import type { IndexEntry } from "../types/collection-index.js";
import type { JsonValue } from "../types/json-value.js";
import type { ListResult } from "../types/query.js";
import type { RuntimeSortInput } from "./where.js";
import { evaluateWhere, sortByMeta } from "./where.js";

export interface ListRuntimeParams {
  readonly where?: Record<string, Record<string, JsonValue>>;
  readonly sort?: readonly RuntimeSortInput[];
  readonly cursor?: string;
  readonly limit?: number;
}

const DEFAULT_LIMIT = 20;

/**
 * KV の index doc を Worker 内で評価する。読者リクエスト処理中に Notion API を
 * 呼ばない(#437 の北極星)。`published` の既定絞り込みは `listed: true` の
 * エントリのみを対象にすることで実現する(#438 の公開ポリシー設計)。
 */
export async function listEntries(
  indexStore: IndexStore,
  collection: string,
  params: ListRuntimeParams = {},
): Promise<ListResult<IndexEntry>> {
  const shards = await indexStore.listShards(collection);
  const listed = shards.flatMap((s) => s.entries).filter((e) => e.listed);
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
  const limit = params.limit ?? DEFAULT_LIMIT;
  const page = sorted.slice(offset, offset + limit);
  const hasMore = offset + limit < sorted.length;

  return {
    items: page,
    nextCursor: hasMore ? String(offset + limit) : null,
    hasMore,
  };
}
