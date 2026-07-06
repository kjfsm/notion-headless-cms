import type { IndexStore, ListRuntimeParams } from "../store/index-store.js";
import type { IndexEntry } from "../types/collection-index.js";
import type { ListResult } from "../types/query.js";

export type { ListRuntimeParams } from "../store/index-store.js";

/**
 * `upsertEntry` に渡した `searchText` への全文検索。読者リクエスト処理中に Notion API を
 * 呼ばない(#437 の北極星)。`published` の既定絞り込みは `listed: true` のエントリのみを
 * 対象にすることで実現する(`listEntries` と同じ方針)。
 */
export async function searchEntries(
  indexStore: IndexStore,
  collection: string,
  query: string,
  params: ListRuntimeParams = {},
): Promise<ListResult<IndexEntry>> {
  return indexStore.search(collection, query, params);
}
