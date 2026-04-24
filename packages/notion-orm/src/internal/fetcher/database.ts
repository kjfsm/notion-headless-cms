import type { Client, PageObjectResponse } from "@notionhq/client";
import { paginate } from "./pagination.js";

/** Notionデータソースをカーソルページネーションで最後まで取得する。 */
export async function queryAllPages(
	client: Client,
	dataSourceId: string,
): Promise<PageObjectResponse[]> {
	return paginate<PageObjectResponse>(async (cursor) => {
		const response = await client.dataSources.query({
			data_source_id: dataSourceId,
			start_cursor: cursor,
		});
		return {
			results: response.results as PageObjectResponse[],
			has_more: response.has_more,
			next_cursor: response.next_cursor,
		};
	});
}

/** スラッグプロパティで絞り込んでページを取得する。存在しない場合はnullを返す。 */
export async function queryPageBySlug(
	client: Client,
	dataSourceId: string,
	slug: string,
	slugPropName: string,
	slugPropType?: string,
): Promise<PageObjectResponse | null> {
	const filter =
		slugPropType === "title"
			? { property: slugPropName, title: { equals: slug } }
			: { property: slugPropName, rich_text: { equals: slug } };

	const res = await client.dataSources.query({
		data_source_id: dataSourceId,
		filter,
	});

	return (res.results[0] as PageObjectResponse | undefined) ?? null;
}
