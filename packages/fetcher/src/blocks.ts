import type { Client } from "@notionhq/client";
import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";

/** Notionブロックの子要素をカーソルページネーションで最後まで取得する。 */
async function listAllBlockChildren(
	client: Client,
	blockId: string,
): Promise<BlockObjectResponse[]> {
	const blocks: BlockObjectResponse[] = [];
	let cursor: string | undefined;
	let hasMore = true;

	while (hasMore) {
		const response = await client.blocks.children.list({
			block_id: blockId,
			start_cursor: cursor,
		});

		blocks.push(...(response.results as BlockObjectResponse[]));
		hasMore = response.has_more;
		cursor = response.next_cursor ?? undefined;
	}

	return blocks;
}

/** NotionページIDに紐づく子ブロック一覧をすべて取得する。 */
export async function getBlocks(
	client: Client,
	pageId: string,
): Promise<BlockObjectResponse[]> {
	return listAllBlockChildren(client, pageId);
}
