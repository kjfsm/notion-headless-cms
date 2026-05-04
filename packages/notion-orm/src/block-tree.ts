import type { Client } from "@notionhq/client";
import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { getBlocks } from "./internal/fetcher/blocks.js";

/**
 * children を再帰的に解決済みのブロック木。
 * react-renderer など「ページ全体を 1 ツリーで受け取りたい」描画側が消費する。
 */
export type NotionBlockTreeNode = BlockObjectResponse & {
  children?: NotionBlockTreeNode[];
};

/**
 * ページ ID 配下の全ブロックを再帰的に取得し、children をネストした木として返す。
 * Notion API は `has_children` の block を別リクエストで取得する必要があるため、
 * ここで深さ優先に展開してからツリー化する。
 */
export async function fetchBlockTree(
  client: Client,
  pageId: string,
): Promise<NotionBlockTreeNode[]> {
  const blocks = await getBlocks(client, pageId);
  return Promise.all(
    blocks.map(async (block) => expandChildren(client, block)),
  );
}

async function expandChildren(
  client: Client,
  block: BlockObjectResponse,
): Promise<NotionBlockTreeNode> {
  if (!block.has_children) {
    return block;
  }
  const children = await fetchBlockTree(client, block.id);
  return { ...block, children };
}
