import { CMSError } from "@notion-headless-cms/core";

const NOTION_API_BASE = "https://api.notion.com/v1";

/**
 * Notion Markdown export API を呼び出してページ本文を 1 リクエストで取得する。
 * Cloudflare Workers Free プランの 50 subrequest 制限を回避する用途。
 *
 * 参考: https://developers.notion.com/guides/data-apis/working-with-markdown-content
 */
export async function fetchPageMarkdown(
  token: string,
  pageId: string,
  notionVersion: string,
): Promise<string> {
  const url = `${NOTION_API_BASE}/pages/${pageId}.md`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": notionVersion,
      },
    });
  } catch (cause) {
    throw new CMSError({
      code: "source/load_markdown_failed",
      message: "Failed to call Notion Markdown export API.",
      cause,
      context: {
        operation: "fetchPageMarkdown",
        pageId,
      },
    });
  }
  if (!res.ok) {
    const body = await safeText(res);
    throw new CMSError({
      code: "source/load_markdown_failed",
      message: `Notion Markdown export API returned HTTP ${res.status}.`,
      context: {
        operation: "fetchPageMarkdown",
        pageId,
        status: res.status,
        body,
      },
    });
  }
  // API は text/markdown を返す
  return res.text();
}

async function safeText(res: Response): Promise<string> {
  try {
    const t = await res.text();
    return t.slice(0, 500);
  } catch {
    return "";
  }
}
