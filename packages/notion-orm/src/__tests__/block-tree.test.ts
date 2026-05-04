import type { Client } from "@notionhq/client";
import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it, vi } from "vitest";
import { fetchBlockTree } from "../block-tree";

// 最小のブロック生成ヘルパ。型は厳密だが、テストでは id と has_children のみ参照する
const block = (id: string, hasChildren = false): BlockObjectResponse =>
  ({
    object: "block",
    id,
    parent: { type: "page_id", page_id: "root" },
    created_time: "2024-01-01T00:00:00.000Z",
    last_edited_time: "2024-01-01T00:00:00.000Z",
    created_by: { object: "user", id: "u" },
    last_edited_by: { object: "user", id: "u" },
    has_children: hasChildren,
    archived: false,
    in_trash: false,
    type: "paragraph",
    paragraph: { rich_text: [], color: "default" },
  }) as unknown as BlockObjectResponse;

const makeClient = (
  childrenByParent: Record<string, BlockObjectResponse[]>,
): Client => {
  const list = vi.fn(async ({ block_id }: { block_id: string }) => ({
    results: childrenByParent[block_id] ?? [],
    has_more: false,
    next_cursor: null,
  }));
  return {
    blocks: { children: { list } },
  } as unknown as Client;
};

describe("fetchBlockTree", () => {
  it("has_children が false のブロックは children を持たない", async () => {
    const client = makeClient({
      page1: [block("a"), block("b")],
    });
    const tree = await fetchBlockTree(client, "page1");
    expect(tree).toHaveLength(2);
    expect(tree[0]?.children).toBeUndefined();
    expect(tree[1]?.children).toBeUndefined();
  });

  it("has_children のブロックは再帰的に展開される", async () => {
    const client = makeClient({
      page1: [block("toggle", true)],
      toggle: [block("nested")],
    });
    const tree = await fetchBlockTree(client, "page1");
    expect(tree[0]?.id).toBe("toggle");
    expect(tree[0]?.children).toHaveLength(1);
    expect(tree[0]?.children?.[0]?.id).toBe("nested");
  });

  it("多段ネストが深さ優先で解決される", async () => {
    const client = makeClient({
      page1: [block("l1", true)],
      l1: [block("l2", true)],
      l2: [block("l3")],
    });
    const tree = await fetchBlockTree(client, "page1");
    expect(tree[0]?.children?.[0]?.children?.[0]?.id).toBe("l3");
  });
});
