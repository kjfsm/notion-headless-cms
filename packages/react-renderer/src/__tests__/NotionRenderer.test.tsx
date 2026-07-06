import type { ParagraphBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NotionBlocks } from "../NotionBlocks.js";
import { NotionRenderer } from "../NotionRenderer.js";
import type { BlockComponentProps, NotionBlock } from "../types.js";

const imageBlock = (id: string, url: string): NotionBlock =>
  ({
    object: "block",
    id,
    type: "image",
    has_children: false,
    image: {
      type: "external",
      external: { url },
      caption: [],
    },
  }) as unknown as NotionBlock;

const linkToPageBlock = (id: string, pageId: string): NotionBlock =>
  ({
    object: "block",
    id,
    type: "link_to_page",
    has_children: false,
    link_to_page: { type: "page_id", page_id: pageId },
  }) as unknown as NotionBlock;

const equation = (id: string, expr: string): NotionBlock =>
  ({
    object: "block",
    id,
    type: "equation",
    has_children: false,
    equation: { expression: expr },
  }) as unknown as NotionBlock;

const codeBlock = (
  id: string,
  source: string,
  lang = "typescript",
  cachedHtml?: string,
  captionText?: string,
): NotionBlock =>
  ({
    object: "block",
    id,
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
      caption: captionText
        ? [
            {
              type: "text",
              plain_text: captionText,
              href: null,
              text: { content: captionText, link: null },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: "default",
              },
            },
          ]
        : [],
      ...(cachedHtml !== undefined && { __cachedHtml: cachedHtml }),
    },
  }) as unknown as NotionBlock;

const para = (id: string, text: string, children?: NotionBlock[]): NotionBlock =>
  ({
    object: "block",
    id,
    type: "paragraph",
    has_children: (children?.length ?? 0) > 0,
    children,
    paragraph: {
      rich_text: [
        {
          type: "text",
          plain_text: text,
          href: null,
          text: { content: text, link: null },
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
      color: "default",
    },
  }) as unknown as NotionBlock;

const bullet = (id: string, text: string): NotionBlock =>
  ({
    object: "block",
    id,
    type: "bulleted_list_item",
    has_children: false,
    bulleted_list_item: {
      rich_text: [
        {
          type: "text",
          plain_text: text,
          href: null,
          text: { content: text, link: null },
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
      color: "default",
    },
  }) as unknown as NotionBlock;

const callout = (id: string, text: string, emoji = "💡"): NotionBlock =>
  ({
    object: "block",
    id,
    type: "callout",
    has_children: false,
    callout: {
      rich_text: [
        {
          type: "text",
          plain_text: text,
          href: null,
          text: { content: text, link: null },
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
      icon: { type: "emoji", emoji },
      color: "default",
    },
  }) as unknown as NotionBlock;

function CustomParagraph({ block }: BlockComponentProps<ParagraphBlockObjectResponse>) {
  return (
    <>
      <p data-testid="custom">{block.paragraph.rich_text[0]?.plain_text}</p>
      {block.children ? <NotionBlocks blocks={block.children} /> : null}
    </>
  );
}

describe("NotionRenderer", () => {
  it("paragraph を描画する", () => {
    const { container } = render(<NotionRenderer blocks={[para("p1", "hello")]} />);
    expect(container.textContent).toContain("hello");
  });

  it("連続する bulleted_list_item を 1 つの ul にまとめる", () => {
    const { container } = render(
      <NotionRenderer blocks={[bullet("a", "one"), bullet("b", "two")]} />,
    );
    const uls = container.querySelectorAll("ul");
    expect(uls).toHaveLength(1);
    expect(uls[0]?.querySelectorAll("li")).toHaveLength(2);
  });

  it("段落を間に挟むと ul は分割される", () => {
    const { container } = render(
      <NotionRenderer blocks={[bullet("a", "one"), para("p", "x"), bullet("b", "two")]} />,
    );
    expect(container.querySelectorAll("ul")).toHaveLength(2);
  });

  it("未対応 block type は Unsupported に落ちる", () => {
    const unsupported = {
      object: "block",
      id: "u1",
      type: "unknown_future_block",
      has_children: false,
    } as unknown as NotionBlock;
    const { container } = render(<NotionRenderer blocks={[unsupported]} />);
    expect(container.textContent).toContain("Unsupported");
  });

  it("デフォルトの Equation は SSR では原文を <pre> で出す", () => {
    const { container } = render(<NotionRenderer blocks={[equation("e1", "E = mc^2")]} />);
    expect(container.textContent).toContain("E = mc^2");
  });

  describe("URL / DOM 差替（拡張ポイント）", () => {
    it("resolveImageUrl を渡すと Image ブロックの src が変換される", () => {
      const block = imageBlock("img1", "https://notion.so/original.png");
      const { container } = render(
        <NotionRenderer blocks={[block]} resolveImageUrl={() => "/proxy/image.png"} />,
      );
      const img = container.querySelector("img");
      expect(img?.getAttribute("src")).toBe("/proxy/image.png");
    });

    it("resolvePageUrl を渡すと LinkToPage の href が変換される", () => {
      const block = linkToPageBlock("ltp1", "page-id-abc");
      const { container } = render(
        <NotionRenderer blocks={[block]} resolvePageUrl={(id) => `/pages/${id}`} />,
      );
      const link = container.querySelector("a");
      expect(link?.getAttribute("href")).toBe("/pages/page-id-abc");
    });

    it("Image スロットを渡すと img 要素が差し替えコンポーネントで描画される", () => {
      const block = imageBlock("img2", "https://notion.so/photo.png");
      const CustomImg = (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
        // biome-ignore lint/performance/noImgElement lint/a11y/useAltText: テスト用スタブ
        <img data-testid="custom-img" {...props} />
      );
      const { container } = render(<NotionRenderer blocks={[block]} Image={CustomImg} />);
      expect(container.querySelector("[data-testid='custom-img']")).not.toBeNull();
    });

    it("Link スロットを渡すと LinkToPage の a 要素が差し替えコンポーネントで描画される", () => {
      const block = linkToPageBlock("ltp2", "page-id-xyz");
      const CustomLink = (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a data-testid="custom-link" {...props} />
      );
      const { container } = render(<NotionRenderer blocks={[block]} Link={CustomLink} />);
      expect(container.querySelector("[data-testid='custom-link']")).not.toBeNull();
    });
  });

  describe("Code ブロック", () => {
    it("デフォルトは <pre> でソースを表示する", () => {
      const { container } = render(<NotionRenderer blocks={[codeBlock("c1", "const x = 1;")]} />);
      expect(container.querySelector("pre")).not.toBeNull();
      expect(container.textContent).toContain("const x = 1;");
    });

    it("caption がある場合は <pre> パスでも表示する", () => {
      const { container } = render(
        <NotionRenderer
          blocks={[codeBlock("c1b", "const x = 1;", "typescript", undefined, "サンプル")]}
        />,
      );
      expect(container.textContent).toContain("サンプル");
    });

    it("__cachedHtml があれば dangerouslySetInnerHTML で描画する", () => {
      const html = '<div class="shiki"><span>highlighted</span></div>';
      const { container } = render(
        <NotionRenderer blocks={[codeBlock("c2", "let y = 2;", "typescript", html)]} />,
      );
      expect(container.querySelector(".shiki")).not.toBeNull();
      expect(container.textContent).toContain("highlighted");
    });

    it("__cachedHtml + caption の両方を描画する", () => {
      const html = '<div class="shiki"><span>highlighted</span></div>';
      const { container } = render(
        <NotionRenderer blocks={[codeBlock("c3", "let z = 3;", "typescript", html, "注釈")]} />,
      );
      expect(container.querySelector(".shiki")).not.toBeNull();
      expect(container.textContent).toContain("注釈");
    });

    it("ヘッダーに言語ラベルとコピーボタンを出す", () => {
      const { container } = render(
        <NotionRenderer blocks={[codeBlock("c4", "const x = 1;", "typescript")]} />,
      );
      expect(container.textContent).toContain("typescript");
      expect(container.querySelector('[data-slot="copy-button"]')).not.toBeNull();
    });

    it("fallback で行番号用の data-line を出す", () => {
      const { container } = render(
        <NotionRenderer blocks={[codeBlock("c5", "const a = 1;\nconst b = 2;", "typescript")]} />,
      );
      expect(container.querySelector("code[data-line-numbers]")).not.toBeNull();
      expect(container.querySelectorAll("[data-line]").length).toBe(2);
    });
  });

  describe("Callout ブロック", () => {
    it("公式 Callout（Alert）で本文とアイコンを描画する", () => {
      const { container } = render(<NotionRenderer blocks={[callout("co1", "メモ本文", "💡")]} />);
      expect(container.querySelector('[role="alert"]')).not.toBeNull();
      expect(container.textContent).toContain("メモ本文");
      expect(container.textContent).toContain("💡");
    });
  });

  describe("Notion 拡張対応", () => {
    const heading = (
      id: string,
      type: "heading_1" | "heading_2" | "heading_3",
      text: string,
    ): NotionBlock =>
      ({
        object: "block",
        id,
        type,
        has_children: false,
        [type]: {
          rich_text: [
            {
              type: "text",
              plain_text: text,
              href: null,
              text: { content: text, link: null },
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
          color: "default",
          is_toggleable: false,
        },
      }) as unknown as NotionBlock;

    const toc: NotionBlock = {
      object: "block",
      id: "toc",
      type: "table_of_contents",
      has_children: false,
      table_of_contents: { color: "default" },
    } as unknown as NotionBlock;

    const numbered = (id: string, text: string, children?: NotionBlock[]): NotionBlock =>
      ({
        object: "block",
        id,
        type: "numbered_list_item",
        has_children: (children?.length ?? 0) > 0,
        children,
        numbered_list_item: {
          rich_text: [
            {
              type: "text",
              plain_text: text,
              href: null,
              text: { content: text, link: null },
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
          color: "default",
        },
      }) as unknown as NotionBlock;

    it("paragraph の color が class に出る", () => {
      const block = {
        ...para("p", "x"),
        paragraph: {
          ...(para("p", "x") as unknown as { paragraph: object }).paragraph,
          color: "blue_background",
        },
      } as unknown as NotionBlock;
      const { container } = render(<NotionRenderer blocks={[block]} />);
      const root = container.querySelector(".notion-renderer > div");
      expect(root?.className).toContain("bg-blue-100");
    });

    it("heading に id={block.id} が出力される", () => {
      const { container } = render(
        <NotionRenderer blocks={[heading("h1id", "heading_2", "Title")]} />,
      );
      expect(container.querySelector("h2")?.id).toBe("h1id");
    });

    it("TableOfContents が headings を描画する", () => {
      const { container } = render(
        <NotionRenderer blocks={[heading("h-a", "heading_1", "Alpha"), toc]} />,
      );
      const links = container.querySelectorAll("[aria-label='table of contents'] a");
      expect(links.length).toBe(1);
      expect(links[0]?.getAttribute("href")).toBe("#h-a");
      expect(links[0]?.textContent).toBe("Alpha");
    });

    it("入れ子 numbered list で list-style が切り替わる", () => {
      const inner = numbered("ni", "child");
      const outer = numbered("no", "parent", [inner]);
      const { container } = render(<NotionRenderer blocks={[outer]} />);
      const ols = container.querySelectorAll("ol");
      expect(ols[0]?.className).toContain("list-decimal");
      expect(ols[1]?.className).toContain("list-[lower-alpha]");
    });

    it("LinkToPage が resolvePageTitle を反映する", () => {
      const block = linkToPageBlock("ltp", "page-x");
      const { container } = render(
        <NotionRenderer blocks={[block]} resolvePageTitle={(id) => `Title:${id}`} />,
      );
      expect(container.textContent).toContain("Title:page-x");
    });
  });

  it("Context 経由で components が子ブロックに伝播する", () => {
    const parent = para("parent", "parent-text", [para("child", "child-text")]);
    const { container } = render(
      <NotionRenderer blocks={[parent]} components={{ Paragraph: CustomParagraph }} />,
    );
    const customs = container.querySelectorAll("[data-testid='custom']");
    expect(customs.length).toBeGreaterThanOrEqual(2);
  });
});
