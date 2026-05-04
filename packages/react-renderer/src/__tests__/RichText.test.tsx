import type { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RichText } from "../rich-text/RichText";

const text = (
  content: string,
  overrides: Partial<RichTextItemResponse["annotations"]> = {},
  href: string | null = null,
): RichTextItemResponse =>
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
  }) as unknown as RichTextItemResponse;

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
});
