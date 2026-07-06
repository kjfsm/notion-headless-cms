import type { PageIndex, PageIndexEntry } from "../pipeline/links.js";
import { normalizePageId } from "../pipeline/links.js";
import type { IndexStore } from "../store/index-store.js";
import type { SchemaDef } from "../types/collection.js";
import type { JsonValue } from "../types/json-value.js";

function findTitleKey(
  properties: Record<string, { kind: string }>,
): string | undefined {
  return Object.entries(properties).find(
    ([, def]) => def.kind === "title",
  )?.[0];
}

/**
 * スキーマ全体の index マニフェストから、内部リンク解決用の `PageIndex`
 * （正規化 pageId → collection/slug/title）を読み取り専用で組み立てる（KV 書き込みゼロ）。
 * `IndexEntry.meta` には各コレクションのドライバが `id`（正規化 pageId）を必ず含める
 * （`notion-driver.ts` の `meta` 構成）ため、ここでは meta を読むだけで済む。
 */
export async function buildPageIndex(
  schema: SchemaDef,
  indexStore: IndexStore,
): Promise<PageIndex> {
  const result: Record<string, PageIndexEntry> = {};
  for (const [collection, def] of Object.entries(schema.collections)) {
    // slug 未設定コレクション(page id アドレス)は URL ルーティングしないため、
    // 内部リンク解決対象から除外する。
    if (!def.slug) continue;
    const titleKey = findTitleKey(def.properties);
    const entries = await indexStore.listAllEntries(collection);
    for (const entry of entries) {
      const meta = entry.meta as Record<string, JsonValue> | null;
      const id = meta && typeof meta.id === "string" ? meta.id : null;
      if (!id) continue;
      const title =
        titleKey && meta && typeof meta[titleKey] === "string"
          ? (meta[titleKey] as string)
          : null;
      result[normalizePageId(id)] = { collection, slug: entry.slug, title };
    }
  }
  return result;
}

export interface MemoizedPageIndex {
  /** キャッシュ済みならそれを返し、無ければ `buildPageIndex` を実行してキャッシュする。 */
  readonly pageIndex: () => Promise<PageIndex>;
  /**
   * 書き込みメソッドがキャッシュ無効化を発火するようラップした `IndexStore`。
   * コレクションドライバにはこちらを渡す(素の `indexStore` を渡すと無効化が効かない)。
   */
  readonly indexStore: IndexStore;
}

/**
 * `buildPageIndex` は全コレクションの manifest を丸ごと読み直す重い処理で、
 * これを entry 同期ごとに毎回実行すると N 件同期で O(N × コレクション数) の
 * KV 読み取り+全件 JSON.parse が発生してしまう(#11)。
 *
 * manifest への実書き込み(`upsertEntry`/`removeEntry` が `wrote: true` を返した
 * 場合)があった時だけキャッシュを無効化することで、書き込みが無い限り安全に
 * 使い回せる。`buildPageIndex` が失敗した場合もキャッシュせず次回再実行する。
 */
export function createMemoizedPageIndex(
  schema: SchemaDef,
  indexStore: IndexStore,
): MemoizedPageIndex {
  let cached: Promise<PageIndex> | null = null;

  function invalidate(): void {
    cached = null;
  }

  const trackedIndexStore: IndexStore = {
    findEntry: (collection, slug) => indexStore.findEntry(collection, slug),
    listEntries: (collection, params) =>
      indexStore.listEntries(collection, params),
    listAllEntries: (collection) => indexStore.listAllEntries(collection),
    listSlugs: (collection) => indexStore.listSlugs(collection),
    async upsertEntry(collection, entry, knownExisting) {
      const result = await indexStore.upsertEntry(
        collection,
        entry,
        knownExisting,
      );
      if (result.wrote) invalidate();
      return result;
    },
    async removeEntry(collection, slug) {
      const result = await indexStore.removeEntry(collection, slug);
      if (result.wrote) invalidate();
      return result;
    },
  };

  return {
    indexStore: trackedIndexStore,
    pageIndex() {
      if (!cached) {
        cached = buildPageIndex(schema, indexStore).catch((err) => {
          invalidate();
          throw err;
        });
      }
      return cached;
    },
  };
}
