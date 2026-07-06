import { describe, expect, it, vi } from "vitest";

import type { NormalizedBlock } from "../../types/entry-snapshot.js";
import { createShikiTransform, normalizeShikiLang } from "../shiki.js";

function codeBlock(
  source: string,
  language = "ts",
  extra?: Record<string, unknown>,
): NormalizedBlock {
  return {
    id: "code-1",
    type: "code",
    data: {
      language,
      rich_text: [{ plain_text: source }],
      ...extra,
    },
  };
}

describe("normalizeShikiLang", () => {
  it("Notion の plain text 系表記を text に正規化する", () => {
    expect(normalizeShikiLang("Plain Text")).toBe("text");
    expect(normalizeShikiLang("")).toBe("text");
    expect(normalizeShikiLang("TypeScript")).toBe("typescript");
  });
});

describe("createShikiTransform", () => {
  it("code ブロックに __cachedHtml を焼き込む(highlight 注入)", async () => {
    const highlight = vi.fn().mockResolvedValue("<pre>highlighted</pre>");
    const transform = createShikiTransform({ highlight });
    const blocks = [codeBlock("const x = 1;", "ts")];

    const result = await transform.transform(blocks);

    expect(highlight).toHaveBeenCalledWith("const x = 1;", "ts");
    expect((result[0]!.data as { __cachedHtml?: string }).__cachedHtml).toBe(
      "<pre>highlighted</pre>",
    );
  });

  it("code 以外のブロックは素通しする", async () => {
    const highlight = vi.fn();
    const transform = createShikiTransform({ highlight });
    const blocks: NormalizedBlock[] = [{ id: "p1", type: "paragraph", data: { rich_text: [] } }];
    const result = await transform.transform(blocks);
    expect(result).toBe(blocks);
    expect(highlight).not.toHaveBeenCalled();
  });

  it("highlight が null を返したブロックは素通しする(失敗フォールバック)", async () => {
    const highlight = vi.fn().mockResolvedValue(null);
    const transform = createShikiTransform({ highlight });
    const blocks = [codeBlock("broken", "unknown-lang")];
    const result = await transform.transform(blocks);
    expect(result[0]).toBe(blocks[0]);
  });

  it("既に __cachedHtml があるブロックは再ハイライトしない", async () => {
    const highlight = vi.fn();
    const transform = createShikiTransform({ highlight });
    const blocks = [codeBlock("x", "ts", { __cachedHtml: "<pre>cached</pre>" })];
    const result = await transform.transform(blocks);
    expect(result).toBe(blocks);
    expect(highlight).not.toHaveBeenCalled();
  });

  it("maxCodeLength を超える code はスキップする(CPU 予算対策)", async () => {
    const highlight = vi.fn();
    const transform = createShikiTransform({ highlight, maxCodeLength: 5 });
    const blocks = [codeBlock("123456789", "ts")];
    const result = await transform.transform(blocks);
    expect(result).toBe(blocks);
    expect(highlight).not.toHaveBeenCalled();
  });

  it("children を再帰的に処理する", async () => {
    const highlight = vi.fn().mockResolvedValue("<pre>h</pre>");
    const transform = createShikiTransform({ highlight });
    const blocks: NormalizedBlock[] = [
      {
        id: "toggle-1",
        type: "toggle",
        data: { rich_text: [] },
        children: [codeBlock("nested", "js")],
      },
    ];
    const result = await transform.transform(blocks);
    const childData = result[0]?.children?.[0]?.data as {
      __cachedHtml?: string;
    };
    expect(childData.__cachedHtml).toBe("<pre>h</pre>");
  });

  it("shiki 未インストール環境では動的 import が失敗し全ブロックを素通しする", async () => {
    vi.doMock("shiki", () => {
      throw new Error("Cannot find module 'shiki'");
    });
    const transform = createShikiTransform();
    const blocks = [codeBlock("const x = 1;", "ts")];
    const result = await transform.transform(blocks);
    expect(result).toBe(blocks);
    vi.doUnmock("shiki");
  });
});
