import type { NormalizedBlock, ResolvedLink } from "@notion-headless-cms/cms";

import type { NotionBlock, PageLinkMap } from "./types.js";

/**
 * `@notion-headless-cms/cms` の正規化 block(`NormalizedBlock`)を、react-renderer が
 * 期待する `NotionBlock`(Notion API の `BlockObjectResponse` 形状)へ変換する。
 *
 * 同期パイプライン(`normalizeBlock`)は `block[block.type]` のサブオブジェクトを
 * そのまま `data` に保持しているため、既存のブロックコンポーネント約 30 種を
 * 一切変更せずに再利用できる。`created_time` 等のブロックコンポーネントが参照しない
 * フィールドはダミー値で埋める(型適合のための境界変換であり、実データではない)。
 *
 * @example
 * ```tsx
 * const post = await cms.posts.find(slug);
 * return (
 *   <NotionRenderer
 *     blocks={denormalizeBlocks(post.blocks)}
 *     pageLinks={toPageLinkMap(post.links)}
 *   />
 * );
 * ```
 */
export function denormalizeBlocks(blocks: readonly NormalizedBlock[]): NotionBlock[] {
  return blocks.map(denormalizeBlock);
}

const DUMMY_USER = { object: "user", id: "" } as const;

function denormalizeBlock(block: NormalizedBlock): NotionBlock {
  const children = block.children ? denormalizeBlocks(block.children) : undefined;
  const reconstructed = {
    object: "block",
    id: block.id,
    type: block.type,
    [block.type]: block.data,
    has_children: Boolean(block.children?.length),
    archived: false,
    in_trash: false,
    created_time: "",
    created_by: DUMMY_USER,
    last_edited_time: "",
    last_edited_by: DUMMY_USER,
    parent: { type: "page_id", page_id: "" },
    ...(children ? { children } : {}),
  };
  return reconstructed as unknown as NotionBlock;
}

/**
 * `EntrySnapshot.links`(正規化 pageId → 解決済みリンク)を、
 * `NotionRenderer` の `pageLinks` プロップにそのまま渡せる形へ変換する。
 */
export function toPageLinkMap(links: Readonly<Record<string, ResolvedLink>>): PageLinkMap {
  const result: PageLinkMap = {};
  for (const [pageId, link] of Object.entries(links)) {
    result[pageId] = { href: link.href, title: link.title ?? undefined };
  }
  return result;
}
