import type { ContentFetcher } from "@notion-headless-cms/notion-orm";
import { fetchPageMarkdown } from "@notion-headless-cms/notion-orm";

export interface MarkdownFetcherOptions {
  /**
   * Notion API バージョン (`Notion-Version` ヘッダ)。
   * Markdown export (`pages/{id}.md`) は 2025-09-03 系で提供。
   */
  notionVersion?: string;
}

const DEFAULT_NOTION_VERSION = "2025-09-03";

/**
 * Notion Markdown export API (`GET /v1/pages/{id}.md`) を 1 リクエストで叩く取得戦略。
 * Cloudflare Workers Free プランの 50 subrequest/invocation 上限に引っかからない。
 *
 * - `loadMarkdown`: 1 subrequest で全文 markdown を返す。
 * - `loadNotionBlocks`: 実装しない (`source/blocks_unsupported`)。
 *   React 描画には `@notion-headless-cms/fetch-markdown/react` の `<Renderer />` を使う。
 */
export function markdownFetcher(
  opts: MarkdownFetcherOptions = {},
): ContentFetcher {
  const notionVersion = opts.notionVersion ?? DEFAULT_NOTION_VERSION;
  return {
    kind: "markdown",
    async loadMarkdown(_client, pageId, ctx) {
      return fetchPageMarkdown(ctx.token, pageId, notionVersion);
    },
  };
}
