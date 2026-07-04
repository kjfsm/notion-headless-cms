import type { IndexStore, ListRuntimeParams } from "../store/index-store.js";
import type { IndexEntry } from "../types/collection-index.js";
import type { ListResult } from "../types/query.js";

export type { ListRuntimeParams } from "../store/index-store.js";

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
  return indexStore.listEntries(collection, params);
}
