import { Client } from "@notionhq/client";

export interface NotionEnv {
  NOTION_TOKEN: string;
}

/** 環境変数のAPIキーでNotionクライアントを生成する。 */
export function createClient(env: Pick<NotionEnv, "NOTION_TOKEN">): Client {
  return new Client({ auth: env.NOTION_TOKEN });
}
