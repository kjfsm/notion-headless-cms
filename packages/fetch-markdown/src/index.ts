import type { ContentFetcher } from "@notion-headless-cms/notion-orm";
import { fetchPageMarkdown } from "@notion-headless-cms/notion-orm";

export type MarkdownFetcherOptions = Record<string, never>;

/**
 * Notion Markdown 取得 API (`GET /v1/pages/{id}/markdown`) を公式 SDK 経由で
 * 1 リクエストで叩く取得戦略。
 * Cloudflare Workers Free プランの 50 subrequest/invocation 上限に引っかからない。
 *
 * - `loadMarkdown`: 公式 SDK の `client.pages.retrieveMarkdown` を使う。
 *   リトライ・レート制限・Notion-Version は notion-orm の Client 構築側で固定。
 * - `loadNotionBlocks`: 実装しない (`source/blocks_unsupported`)。
 *   React 描画には `@notion-headless-cms/fetch-markdown/react` の `<Renderer />` を使う。
 */
export function markdownFetcher(
  _opts: MarkdownFetcherOptions = {},
): ContentFetcher {
  return {
    kind: "markdown",
    async loadMarkdown(client, pageId) {
      return fetchPageMarkdown(client, pageId);
    },
  };
}
