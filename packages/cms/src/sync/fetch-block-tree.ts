import type { BlockObjectResponse } from "@notionhq/client";
import { isFullBlock } from "@notionhq/client";

import type { FetchedBlock } from "../pipeline/blocks.js";
import type { RateLimiter } from "./rate-limiter.js";
import type { RetryConfig } from "./retry.js";
import { withRetry } from "./retry.js";

/** `client.blocks.children.list` が返す最小形状（構造型、モック可能）。 */
export interface BlockChildrenListResult {
  readonly results: readonly BlockObjectResponse[];
  readonly next_cursor: string | null;
  readonly has_more: boolean;
}

export interface NotionBlocksClientLike {
  blocks: {
    children: {
      list(args: {
        block_id: string;
        page_size?: number;
        start_cursor?: string;
      }): Promise<BlockChildrenListResult>;
    };
  };
}

export interface FetchBlockTreeOptions {
  readonly rateLimiter: RateLimiter;
  readonly retry?: RetryConfig;
  readonly pageSize?: number;
}

async function listAllChildren(
  client: NotionBlocksClientLike,
  blockId: string,
  opts: FetchBlockTreeOptions,
): Promise<FetchedBlock[]> {
  const results: FetchedBlock[] = [];
  let cursor: string | undefined;
  do {
    const res = await withRetry(
      () =>
        opts.rateLimiter.schedule(() =>
          client.blocks.children.list({
            block_id: blockId,
            page_size: opts.pageSize ?? 100,
            start_cursor: cursor,
          }),
        ),
      opts.retry,
    );
    results.push(...res.results.filter(isFullBlock));
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return results;
}

/**
 * `blockId`(通常はページ ID)配下の子ブロックを再帰的に取得する。
 * `has_children: true` のブロックのみ子取得を行い、全 Notion 呼び出しは
 * 共有 `RateLimiter`(3req/s)+ `withRetry` 経由にする(#441 の直列化)。
 */
export async function fetchBlockTree(
  client: NotionBlocksClientLike,
  blockId: string,
  opts: FetchBlockTreeOptions,
): Promise<FetchedBlock[]> {
  const children = await listAllChildren(client, blockId, opts);
  return Promise.all(
    children.map(async (child) => {
      if (!child.has_children) return child;
      const nested = await fetchBlockTree(client, child.id, opts);
      return { ...child, children: nested };
    }),
  );
}
