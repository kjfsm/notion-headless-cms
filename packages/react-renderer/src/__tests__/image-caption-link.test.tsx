/** @vitest-environment happy-dom */
import type { RichTextItemResponse } from "@notionhq/client/build/src/api-endpoints";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NotionRenderer } from "../NotionRenderer.js";
import type { NotionBlock } from "../types.js";

const link = (content: string, url: string): RichTextItemResponse =>
  ({
    type: "text",
    text: { content, link: { url } },
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: "default",
    },
    plain_text: content,
    href: url,
  }) as RichTextItemResponse;

const makeImage = (caption: RichTextItemResponse[]): NotionBlock =>
  ({
    object: "block",
    id: "b1",
    type: "image",
    has_children: false,
    image: {
      type: "external",
      external: { url: "https://example.com/x.png" },
      caption,
    },
  }) as unknown as NotionBlock;

describe("Image caption リンク", () => {
  afterEach(() => cleanup());

  it("caption が単一 URL のみのとき画像をリンクで包み caption を出さない", () => {
    const block = makeImage([
      link("https://example.com/dest", "https://example.com/dest"),
    ]);
    const { container } = render(<NotionRenderer blocks={[block]} />);
    const anchor = container.querySelector("figure > a");
    expect(anchor).not.toBeNull();
    expect(anchor?.getAttribute("href")).toBe("https://example.com/dest");
    expect(anchor?.querySelector("img")).not.toBeNull();
    // ズーム用 Dialog trigger (button) と figcaption は出さない
    expect(container.querySelector("button")).toBeNull();
    expect(container.querySelector("figcaption")).toBeNull();
  });

  it("caption が通常テキストならリンクで包まず caption を描画する", () => {
    const block = makeImage([link("元サイト", "https://example.com/")]);
    const { container } = render(<NotionRenderer blocks={[block]} />);
    expect(container.querySelector("figure > a")).toBeNull();
    expect(container.querySelector("figcaption")).not.toBeNull();
  });
});
