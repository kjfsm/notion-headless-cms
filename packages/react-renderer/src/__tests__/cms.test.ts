import type { NormalizedBlock } from "@notion-headless-cms/cms";
import { describe, expect, it } from "vitest";
import { denormalizeBlocks, toPageLinkMap } from "../cms.js";

describe("denormalizeBlocks", () => {
  it("id/type/data を BlockObjectResponse 互換の形に復元する", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "b1",
        type: "paragraph",
        data: { rich_text: [], color: "default" },
      },
    ];
    const result = denormalizeBlocks(blocks);
    expect(result[0]?.id).toBe("b1");
    expect(result[0]?.type).toBe("paragraph");
    // biome-ignore lint/suspicious/noExplicitAny: 動的キーアクセスのためのテスト内キャスト。
    expect((result[0] as any).paragraph).toEqual({
      rich_text: [],
      color: "default",
    });
    expect(result[0]?.has_children).toBe(false);
  });

  it("children を再帰的に変換し has_children を true にする", () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "parent",
        type: "bulleted_list_item",
        data: { rich_text: [], color: "default" },
        children: [
          {
            id: "child",
            type: "paragraph",
            data: { rich_text: [], color: "default" },
          },
        ],
      },
    ];
    const result = denormalizeBlocks(blocks);
    expect(result[0]?.has_children).toBe(true);
    expect(result[0]?.children?.[0]?.id).toBe("child");
  });

  it("未対応ブロック(unsupported)も変換できる", () => {
    const blocks: NormalizedBlock[] = [
      { id: "u1", type: "unsupported", data: { type: "unsupported", raw: {} } },
    ];
    const result = denormalizeBlocks(blocks);
    expect(result[0]?.type).toBe("unsupported");
  });
});

describe("toPageLinkMap", () => {
  it("ResolvedLink を PageLinkMap 形式(title は null→undefined)に変換する", () => {
    const links = {
      abc123: { href: "/posts/hello", title: "Hello" },
      def456: { href: "/posts/other", title: null },
    };
    const result = toPageLinkMap(links);
    expect(result.abc123).toEqual({ href: "/posts/hello", title: "Hello" });
    expect(result.def456).toEqual({ href: "/posts/other", title: undefined });
  });

  it("空マップは空マップを返す", () => {
    expect(toPageLinkMap({})).toEqual({});
  });
});
