import { Client } from "@notionhq/client";

export interface NotionEnv {
  NOTION_TOKEN: string;
}

/**
 * Markdown 取得 API (`/pages/{id}/markdown`) は 2026-03-11 以降の Notion-Version で
 * 提供される。SDK の Client コンストラクタで指定して固定する。
 * このバージョンは既存の `databases` / `blocks` 系 API とも互換。
 */
const DEFAULT_NOTION_VERSION = "2026-03-11";

/** 環境変数のAPIキーでNotionクライアントを生成する。 */
export function createClient(env: Pick<NotionEnv, "NOTION_TOKEN">): Client {
  return new Client({
    auth: env.NOTION_TOKEN,
    notionVersion: DEFAULT_NOTION_VERSION,
  });
}
