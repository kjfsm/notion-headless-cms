import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotionBlock } from "../types.js";

const codeBlock = (
  source: string,
  lang = "typescript",
  cachedHtml?: string,
): NotionBlock =>
  ({
    object: "block",
    id: "code-1",
    type: "code",
    has_children: false,
    code: {
      rich_text: [
        {
          type: "text",
          plain_text: source,
          href: null,
          text: { content: source, link: null },
          annotations: {
            bold: false,
            italic: false,
            strikethrough: false,
            underline: false,
            code: false,
            color: "default",
          },
        },
      ],
      language: lang,
      caption: [],
      ...(cachedHtml !== undefined && { __cachedHtml: cachedHtml }),
    },
  }) as unknown as NotionBlock;

describe("Code (クライアント遅延 shiki)", () => {
  afterEach(() => {
    vi.doUnmock("shiki");
    vi.resetModules();
  });

  it("__cachedHtml が無い場合、水和後に shiki でハイライトして置換する", async () => {
    vi.doMock("shiki", () => ({
      createHighlighter: vi.fn().mockResolvedValue({
        codeToHtml: () =>
          '<pre class="shiki"><code><span data-line="">highlighted</span></code></pre>',
        getLoadedLanguages: () => ["typescript"],
        loadLanguage: vi.fn(),
      }),
    }));
    vi.doMock("shiki/engine/javascript", () => ({
      createJavaScriptRegexEngine: () => ({}),
    }));

    const { Code: FreshCode } = await import("../blocks/Code.js");
    const { container } = render(
      <FreshCode block={codeBlock("const x = 1;") as never} />,
    );

    // 水和前は素の <pre> フォールバック。
    expect(container.querySelector(".shiki")).toBeNull();

    await waitFor(() => {
      expect(container.querySelector(".shiki")).not.toBeNull();
    });
    expect(container.textContent).toContain("highlighted");
  });

  it("shiki が未インストール(動的 import 失敗)なら素の <pre> のまま", async () => {
    vi.doMock("shiki", () => {
      throw new Error("Cannot find module 'shiki'");
    });

    const { Code: FreshCode } = await import("../blocks/Code.js");
    const { container } = render(
      <FreshCode block={codeBlock("const x = 1;") as never} />,
    );

    await Promise.resolve();
    expect(container.querySelector(".shiki")).toBeNull();
    expect(container.querySelector("pre[data-language]")).not.toBeNull();
  });

  it("__cachedHtml があればクライアント shiki を呼ばず即座にそれを描画する", async () => {
    const highlight = vi.fn();
    vi.doMock("shiki", () => ({
      createHighlighter: highlight,
    }));

    const { Code: FreshCode } = await import("../blocks/Code.js");
    const html = '<pre class="shiki"><code>cached</code></pre>';
    const { container } = render(
      <FreshCode
        block={codeBlock("const x = 1;", "typescript", html) as never}
      />,
    );

    expect(container.querySelector(".shiki")).not.toBeNull();
    await Promise.resolve();
    expect(highlight).not.toHaveBeenCalled();
  });
});
