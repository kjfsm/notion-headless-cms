import type { NormalizedBlock } from "../types/entry-snapshot.js";
import type { JsonValue } from "../types/json-value.js";
import { walkBlocks } from "./blocks.js";

/** Notion のページ ID 表記ゆれ（ダッシュあり/なし・大小文字）を統一する（v2 `normalizePageId` を移植）。 */
export function normalizePageId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}

export interface PageIndexEntry {
  readonly collection: string;
  readonly slug: string;
  readonly title: string | null;
}

/** 正規化 pageId → コレクション/slug の逆引きマップ。同期エンジンが全ページを走査して構築する。 */
export type PageIndex = Readonly<Record<string, PageIndexEntry>>;

function collectMentionedPageIds(value: JsonValue, out: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectMentionedPageIds(item, out);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const record = value as Record<string, JsonValue>;
  if (record.type === "mention") {
    const mention = record.mention as Record<string, JsonValue> | undefined;
    if (mention?.type === "page") {
      const page = mention.page as Record<string, JsonValue> | undefined;
      if (typeof page?.id === "string") out.add(page.id);
    }
  }
  for (const value2 of Object.values(record))
    collectMentionedPageIds(value2, out);
}

function linkToPageId(block: NormalizedBlock): string | null {
  if (block.type !== "link_to_page") return null;
  const data = block.data as Record<string, JsonValue>;
  if (typeof data.page_id === "string") return data.page_id;
  return null;
}

/**
 * block tree 内の内部リンク(`link_to_page` ブロック・インライン page mention)を抽出し、
 * `pageIndex` を使って href/title に解決する。純関数、I/O なし。
 */
export function resolvePageLinks(
  blocks: readonly NormalizedBlock[],
  pageIndex: PageIndex,
): Record<string, { href: string; title: string | null }> {
  const pageIds = new Set<string>();
  walkBlocks(blocks, (block) => {
    const linked = linkToPageId(block);
    if (linked) pageIds.add(linked);
    collectMentionedPageIds(block.data, pageIds);
  });

  const result: Record<string, { href: string; title: string | null }> = {};
  for (const pageId of pageIds) {
    const normalized = normalizePageId(pageId);
    const entry = pageIndex[normalized];
    if (entry) {
      result[normalized] = {
        href: `/${entry.collection}/${entry.slug}`,
        title: entry.title,
      };
    }
  }
  return result;
}
