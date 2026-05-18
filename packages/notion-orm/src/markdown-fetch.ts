import { CMSError } from "@notion-headless-cms/core";
import type { Client } from "@notionhq/client";

/**
 * Notion Markdown 取得 API (`GET /v1/pages/:page_id/markdown`) を公式 SDK 経由で
 * 1 リクエストで叩く。Cloudflare Workers Free プランの 50 subrequest 制限を回避する用途。
 *
 * SDK の `client.pages.retrieveMarkdown` を使うため、リトライ・レート制限・
 * Notion-Version ヘッダは Client コンストラクタの設定に従う。
 * `createClient` は `notionVersion: "2026-03-11"` で固定している。
 *
 * 参考: https://developers.notion.com/guides/data-apis/working-with-markdown-content
 */
export async function fetchPageMarkdown(
  client: Client,
  pageId: string,
): Promise<string> {
  try {
    const res = await client.pages.retrieveMarkdown({ page_id: pageId });
    if (typeof res.markdown !== "string") {
      throw new CMSError({
        code: "source/load_markdown_failed",
        message:
          "Notion Markdown export API response is missing `markdown` field.",
        context: { operation: "fetchPageMarkdown", pageId },
      });
    }
    return res.markdown;
  } catch (cause) {
    if (cause instanceof CMSError) throw cause;
    throw new CMSError({
      code: "source/load_markdown_failed",
      message: "Notion Markdown export API request failed.",
      cause,
      context: { operation: "fetchPageMarkdown", pageId },
    });
  }
}
