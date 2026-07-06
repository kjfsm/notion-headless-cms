import type { BlockObjectResponse } from "@notionhq/client";

import type { NormalizedBlock } from "../types/entry-snapshot.js";
import type { JsonValue } from "../types/json-value.js";

/**
 * 再帰的に取得済みの block tree(`fetchBlockTree` 等が既に children を埋め込んだもの)。
 * `BlockObjectResponse` はブロック種別ごとの判別可能ユニオンなので、interface extends
 * ではなく交差型で `children` を足す(ユニオンの各メンバーに分配される)。
 */
export type FetchedBlock = BlockObjectResponse & { children?: FetchedBlock[] };

/**
 * Notion の `[block.type]` サブオブジェクトはそれ自体 JSON 互換な形をしているため、
 * ブロック種別ごとに個別のフィールド定義を持たず、そのまま `data` に格納する。
 * 未知のブロック種別（Notion API が新種を追加した場合）は `{ type: "unsupported", raw }` にする。
 */
function extractBlockData(block: FetchedBlock): JsonValue {
  const payload = (block as unknown as Record<string, unknown>)[block.type];
  if (payload === undefined) {
    return { type: "unsupported", raw: block as unknown as JsonValue };
  }
  return payload as JsonValue;
}

/**
 * 再帰取得済みの block tree を正規化する（純関数、I/O なし）。
 * 全ブロック種を網羅し、未対応ブロックも `unsupported` として保持する。
 */
export function normalizeBlock(block: FetchedBlock): NormalizedBlock {
  const children = block.children;
  return {
    id: block.id,
    type: block.type,
    data: extractBlockData(block),
    ...(children && children.length > 0 ? { children: children.map(normalizeBlock) } : {}),
  };
}

export function normalizeBlockTree(blocks: readonly FetchedBlock[]): NormalizedBlock[] {
  return blocks.map(normalizeBlock);
}

/** 正規化済み block tree を幅優先に近い形で走査する（links/images 抽出の共通ヘルパー）。 */
export function walkBlocks(
  blocks: readonly NormalizedBlock[],
  visit: (block: NormalizedBlock) => void,
): void {
  for (const block of blocks) {
    visit(block);
    if (block.children) walkBlocks(block.children, visit);
  }
}
