import { describe, expect, it } from "vitest";
import type { NormalizedBlock } from "../../types/entry-snapshot.js";
import { isJsonRecord, mapBlocks, mapJsonObjects } from "../walk.js";

describe("mapBlocks", () => {
  it("visit が変更したブロックだけ差し替え、無変更部分は同一参照を保つ", async () => {
    const blocks: NormalizedBlock[] = [
      { id: "a", type: "paragraph", data: { rich_text: [] } },
      {
        id: "b",
        type: "code",
        data: { language: "ts" },
        children: [{ id: "c", type: "paragraph", data: {} }],
      },
    ];

    const result = await mapBlocks(blocks, async (block) =>
      block.type === "code" && isJsonRecord(block.data)
        ? { ...block, data: { ...block.data, __cachedHtml: "<pre/>" } }
        : block,
    );

    expect(result).not.toBe(blocks);
    expect(result[0]).toBe(blocks[0]);
    expect(result[1]?.data).toEqual({ language: "ts", __cachedHtml: "<pre/>" });
    // children は再帰処理されるが中身に変更が無いので同一参照のまま。
    expect(result[1]?.children).toBe(blocks[1]?.children);
  });

  it("どのブロックも変更されなければ元の配列参照をそのまま返す", async () => {
    const blocks: NormalizedBlock[] = [
      { id: "a", type: "paragraph", data: {} },
    ];
    const result = await mapBlocks(blocks, async (block) => block);
    expect(result).toBe(blocks);
  });

  it("children の変更が親の再構築に伝播する", async () => {
    const blocks: NormalizedBlock[] = [
      {
        id: "a",
        type: "paragraph",
        data: {},
        children: [{ id: "b", type: "code", data: { language: "ts" } }],
      },
    ];
    const result = await mapBlocks(blocks, async (block) =>
      block.type === "code" ? { ...block, data: { __cachedHtml: "x" } } : block,
    );
    expect(result[0]).not.toBe(blocks[0]);
    expect(result[0]?.children?.[0]?.data).toEqual({ __cachedHtml: "x" });
  });
});

describe("mapJsonObjects", () => {
  it("深部のオブジェクトを含めて visit を適用する(caption・table_row cells 相当)", async () => {
    const data = {
      rich_text: [{ type: "equation", equation: { expression: "x^2" } }],
      caption: [{ type: "equation", equation: { expression: "y" } }],
      cells: [[{ type: "equation", equation: { expression: "z" } }]],
    };

    const result = await mapJsonObjects(data, async (obj) => {
      if (obj.type !== "equation") return null;
      const equation = obj.equation as { expression: string };
      return { ...obj, equation: { ...equation, __cachedHtml: "<html/>" } };
    });

    expect(result).toEqual({
      rich_text: [
        {
          type: "equation",
          equation: { expression: "x^2", __cachedHtml: "<html/>" },
        },
      ],
      caption: [
        {
          type: "equation",
          equation: { expression: "y", __cachedHtml: "<html/>" },
        },
      ],
      cells: [
        [
          {
            type: "equation",
            equation: { expression: "z", __cachedHtml: "<html/>" },
          },
        ],
      ],
    });
  });

  it("visit が null を返す値は元の参照のまま変更しない", async () => {
    const data = { rich_text: [{ type: "text", text: { content: "hi" } }] };
    const result = await mapJsonObjects(data, async () => null);
    expect(result).toBe(data);
  });

  it("置換されたオブジェクトの内部には再帰しない(二重適用を防ぐ)", async () => {
    let visitCount = 0;
    const data = { type: "equation", equation: { expression: "x" } };
    await mapJsonObjects(data, async (obj) => {
      visitCount++;
      if (obj.type !== "equation") return null;
      return { ...obj, equation: { expression: "x", __cachedHtml: "h" } };
    });
    // ルートの equation object 自体への訪問は 1 回だけ(置換後の内部には再訪問しない)。
    expect(visitCount).toBe(1);
  });
});
