import type { Client } from "@notionhq/client";
import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { paginate } from "./pagination.js";

/** NotionページIDに紐づく子ブロック一覧をすべて取得する。 */
export async function getBlocks(
	client: Client,
	pageId: string,
): Promise<BlockObjectResponse[]> {
	return paginate<BlockObjectResponse>(async (cursor) => {
		const response = await client.blocks.children.list({
			block_id: pageId,
			start_cursor: cursor,
		});
		return {
			results: response.results as BlockObjectResponse[],
			has_more: response.has_more,
			next_cursor: response.next_cursor,
		};
	});
}
