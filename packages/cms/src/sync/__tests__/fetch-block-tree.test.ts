import type { BlockObjectResponse } from "@notionhq/client";
import { describe, expect, it, vi } from "vitest";

import type { BlockChildrenListResult, NotionBlocksClientLike } from "../fetch-block-tree.js";
import { fetchBlockTree } from "../fetch-block-tree.js";
import type { RateLimiter } from "../rate-limiter.js";
import { createRateLimiter } from "../rate-limiter.js";

function block(id: string, hasChildren = false): BlockObjectResponse {
  return {
    object: "block",
    id,
    type: "paragraph",
    has_children: hasChildren,
    paragraph: { rich_text: [] },
  } as unknown as BlockObjectResponse;
}

type ListFn = (args: {
  block_id: string;
  page_size?: number;
  start_cursor?: string;
}) => Promise<BlockChildrenListResult>;

function makeClient(
  pages: Record<string, BlockObjectResponse[]>,
  listImpl?: ListFn,
): NotionBlocksClientLike {
  return {
    blocks: {
      children: {
        list:
          listImpl ??
          (async ({ block_id }) => ({
            results: pages[block_id] ?? [],
            next_cursor: null,
            has_more: false,
          })),
      },
    },
  };
}

describe("fetchBlockTree", () => {
  it("子ブロックを取得する", async () => {
    const client = makeClient({
      root: [block("a"), block("b")],
    });
    const rateLimiter = createRateLimiter({ requestsPerSecond: 1000 });
    const result = await fetchBlockTree(client, "root", { rateLimiter });
    expect(result.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("has_children なブロックは再帰的に子を取得する", async () => {
    const client = makeClient({
      root: [block("parent", true)],
      parent: [block("child")],
    });
    const rateLimiter = createRateLimiter({ requestsPerSecond: 1000 });
    const result = await fetchBlockTree(client, "root", { rateLimiter });
    expect(result[0]?.children?.map((c) => c.id)).toEqual(["child"]);
  });

  it("has_children が false のブロックは子取得を呼ばない", async () => {
    const list = vi.fn(async ({ block_id }: { block_id: string }) => ({
      results: block_id === "root" ? [block("leaf", false)] : [],
      next_cursor: null,
      has_more: false,
    })) as unknown as NotionBlocksClientLike["blocks"]["children"]["list"];
    const client = makeClient({}, list);
    const rateLimiter = createRateLimiter({ requestsPerSecond: 1000 });
    await fetchBlockTree(client, "root", { rateLimiter });
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("ページネーションで全件取得する", async () => {
    let call = 0;
    const list = vi.fn(async () => {
      call++;
      if (call === 1) {
        return {
          results: [block("a")],
          next_cursor: "cursor-2",
          has_more: true,
        };
      }
      return { results: [block("b")], next_cursor: null, has_more: false };
    }) as unknown as NotionBlocksClientLike["blocks"]["children"]["list"];
    const client = makeClient({}, list);
    const rateLimiter = createRateLimiter({ requestsPerSecond: 1000 });
    const result = await fetchBlockTree(client, "root", { rateLimiter });
    expect(result.map((b) => b.id)).toEqual(["a", "b"]);
  });

  it("partial block(is_full_block=false 相当)は除外する", async () => {
    const list = vi.fn(async () => ({
      results: [
        block("full"),
        { object: "block", id: "partial" }, // isFullBlock が false になる不完全な形状
      ],
      next_cursor: null,
      has_more: false,
    })) as unknown as NotionBlocksClientLike["blocks"]["children"]["list"];
    const client = makeClient({}, list);
    const rateLimiter = createRateLimiter({ requestsPerSecond: 1000 });
    const result = await fetchBlockTree(client, "root", { rateLimiter });
    expect(result.map((b) => b.id)).toEqual(["full"]);
  });

  it("rateLimiter 経由で呼ばれる(直列化)", async () => {
    const schedule: RateLimiter["schedule"] = vi.fn((task) => task());
    const client = makeClient({ root: [block("a")] });
    await fetchBlockTree(client, "root", {
      rateLimiter: { schedule },
    });
    expect(schedule).toHaveBeenCalledTimes(1);
  });
});
