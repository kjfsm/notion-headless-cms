import type { RichTextItemResponse } from "@notionhq/client";
import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RichText } from "../rich-text/RichText";

const text = (
  content: string,
  overrides: Partial<RichTextItemResponse["annotations"]> = {},
  href: string | null = null,
) =>
  ({
    type: "text",
    plain_text: content,
    href,
    text: { content, link: href ? { url: href } : null },
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: "default",
      ...overrides,
    },
  }) satisfies RichTextItemResponse;

describe("RichText", () => {
  it("プレーンテキストを描画する", () => {
    const { container } = render(<RichText value={[text("hello")]} />);
    expect(container.textContent).toBe("hello");
  });

  it("bold + italic を入れ子で描画する", () => {
    const { container } = render(
      <RichText value={[text("x", { bold: true, italic: true })]} />,
    );
    expect(container.querySelector("em strong")).not.toBeNull();
  });

  it("code は <code> タグで他の装飾を抑制する", () => {
    const { container } = render(
      <RichText value={[text("x", { bold: true, code: true })]} />,
    );
    expect(container.querySelector("code")).not.toBeNull();
    expect(container.querySelector("strong")).toBeNull();
  });

  it("href があればリンクで包む", () => {
    const { container } = render(
      <RichText value={[text("x", {}, "https://example.com")]} />,
    );
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://example.com");
    expect(a?.getAttribute("target")).toBe("_blank");
  });

  it("inline equation の __cachedHtml をそのまま描画し、クライアント katex を呼ばない", async () => {
    const katexModule = await import("katex");
    const renderSpy = vi.spyOn(katexModule.default, "renderToString");
    const equationItem = {
      type: "equation",
      plain_text: "x^2",
      href: null,
      equation: {
        expression: "x^2",
        __cachedHtml: '<span class="cached-eq"/>',
      },
      annotations: {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: "default",
      },
    } as unknown as RichTextItemResponse;

    const { container } = render(<RichText value={[equationItem]} />);

    expect(container.querySelector(".cached-eq")).not.toBeNull();
    await Promise.resolve();
    expect(renderSpy).not.toHaveBeenCalled();
    renderSpy.mockRestore();
  });

  it("__cachedHtml が無い inline equation はクライアント側で katex 組版する", async () => {
    const equationItem = {
      type: "equation",
      plain_text: "y",
      href: null,
      equation: { expression: "y" },
      annotations: {
        bold: false,
        italic: false,
        strikethrough: false,
        underline: false,
        code: false,
        color: "default",
      },
    } as unknown as RichTextItemResponse;

    const { container } = render(<RichText value={[equationItem]} />);

    await waitFor(() => {
      expect(container.querySelector(".katex")).not.toBeNull();
    });
  });
});
