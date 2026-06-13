import {
  type Client,
  collectPaginatedAPI,
  isFullPage,
  type PageObjectResponse,
} from "@notionhq/client";

/** Notionデータソースをカーソルページネーションで最後まで取得する。 */
export async function queryAllPages(
  client: Client,
  dataSourceId: string,
): Promise<PageObjectResponse[]> {
  // partial ページ（権限不足等で薄いレスポンス）を除外する
  const results = await collectPaginatedAPI(client.dataSources.query, {
    data_source_id: dataSourceId,
  });
  return results.filter(isFullPage);
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

  return res.results.find(isFullPage) ?? null;
}
