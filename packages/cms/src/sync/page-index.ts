import type { PageIndex, PageIndexEntry } from "../pipeline/links.js";
import { normalizePageId } from "../pipeline/links.js";
import type { IndexStore } from "../store/index-store.js";
import type { SchemaDef } from "../types/collection.js";
import type { JsonValue } from "../types/json-value.js";

function findTitleKey(properties: Record<string, { kind: string }>): string | undefined {
  return Object.entries(properties).find(([, def]) => def.kind === "title")?.[0];
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
        titleKey && meta && typeof meta[titleKey] === "string" ? (meta[titleKey] as string) : null;
      result[normalizePageId(id)] = { collection, slug: entry.slug, title };
    }
  }
  return result;
}
