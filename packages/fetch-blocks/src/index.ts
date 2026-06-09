import type { BlockHandler } from "@notion-headless-cms/markdown-html";
import { Transformer } from "@notion-headless-cms/markdown-html";
import type {
  ContentFetcher,
  FetchBlockTreeOgpOptions,
  NotionBlockTreeNode,
} from "@notion-headless-cms/notion-orm";
import { fetchBlockTree } from "@notion-headless-cms/notion-orm";

// createCMS など利用側が ogp オプションを型付きで渡せるよう re-export する。
export type { FetchBlockTreeOgpOptions } from "@notion-headless-cms/notion-orm";

export interface BlocksFetcherOptions {
  /**
   * 同時に展開する子ブロックの最大数。デフォルト 3。
   * Notion API のレート制限 (3 req/s) に抵触しないよう抑制する。
   */
  concurrency?: number;
  /** カスタムブロックハンドラーのマップ。`Transformer` (notion-to-md) に渡る。 */
  blocks?: Record<string, BlockHandler>;
  /** embed / bookmark / link_preview ブロックの OGP 取得設定。 */
  ogp?: FetchBlockTreeOgpOptions;
}

/**
 * Notion `blocks.children.list` を再帰的に呼ぶ既定の取得戦略。
 * BlockObjectResponse ツリーを返すため `@notion-headless-cms/react-renderer` の
 * `NotionRenderer` で高忠実度に描画できる。
 *
 * ⚠️ ネストが深い大きなページでは Cloudflare Workers Free プランの
 * 50 subrequest/invocation 上限を超えうる。その場合は
 * `@notion-headless-cms/fetch-markdown` の `markdownFetcher()` を検討する。
 */
export function blocksFetcher(opts: BlocksFetcherOptions = {}): ContentFetcher {
  const blocks = opts.blocks;
  const ogp = opts.ogp;
  const concurrency = opts.concurrency;
  return {
    kind: "blocks",
    async loadMarkdown(client, pageId) {
      const transformer = new Transformer(blocks ? { blocks } : undefined);
      return transformer.transform(client, pageId);
    },
    async loadNotionBlocks(client, pageId): Promise<NotionBlockTreeNode[]> {
      return fetchBlockTree(client, pageId, {
        ...(ogp ? { ogp } : {}),
        ...(concurrency !== undefined ? { concurrency } : {}),
      });
    },
  };
}
