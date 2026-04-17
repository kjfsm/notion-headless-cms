import type { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

/** Notionデータソースをカーソルページネーションで最後まで取得する。 */
export async function queryAllPages(
	client: Client,
	dataSourceId: string,
): Promise<PageObjectResponse[]> {
	const pages: PageObjectResponse[] = [];
	let cursor: string | undefined;
	let hasMore = true;

	while (hasMore) {
		const response = await client.dataSources.query({
			data_source_id: dataSourceId,
			start_cursor: cursor,
		});

		pages.push(...(response.results as PageObjectResponse[]));
		hasMore = response.has_more;
		cursor = response.next_cursor ?? undefined;
	}

	return pages;
}

/** スラッグプロパティで絞り込んでページを取得する。存在しない場合はnullを返す。 */
export async function queryPageBySlug(
	client: Client,
	dataSourceId: string,
	slug: string,
	slugPropName: string,
): Promise<PageObjectResponse | null> {
	const res = await client.dataSources.query({
		data_source_id: dataSourceId,
		filter: {
			property: slugPropName,
			rich_text: { equals: slug },
		},
	});

	return (res.results[0] as PageObjectResponse | undefined) ?? null;
}
