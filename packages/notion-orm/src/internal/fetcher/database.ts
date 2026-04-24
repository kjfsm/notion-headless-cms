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
): Promise<PageObjectResponse | null> {
	const filter = { property: slugPropName, rich_text: { equals: slug } };

	const res = await client.dataSources.query({
		data_source_id: dataSourceId,
		filter,
	});

	return (res.results[0] as PageObjectResponse | undefined) ?? null;
}

/**
 * 任意の rich_text プロパティで絞り込んでページを取得する。
 * Core が `findByProp` を通じて slug ルックアップに使用する。
 */
export async function queryPageByProp(
	client: Client,
	dataSourceId: string,
	notionPropName: string,
	value: string,
): Promise<PageObjectResponse | null> {
	const filter = { property: notionPropName, rich_text: { equals: value } };

	const res = await client.dataSources.query({
		data_source_id: dataSourceId,
		filter,
	});

	return (res.results[0] as PageObjectResponse | undefined) ?? null;
}
