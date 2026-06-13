import {
  type BlockObjectResponse,
  type Client,
  collectPaginatedAPI,
  isFullBlock,
} from "@notionhq/client";

/** NotionページIDに紐づく子ブロック一覧をすべて取得する。 */
export async function getBlocks(
  client: Client,
  pageId: string,
): Promise<BlockObjectResponse[]> {
  const results = await collectPaginatedAPI(client.blocks.children.list, {
    block_id: pageId,
  });
  return results.filter(isFullBlock);
}
