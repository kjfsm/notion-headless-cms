import { describe, expect, it, vi } from "vitest";
import { notionEmbed } from "../index";
import { steamProvider } from "../providers/steam";
import type { BlockHandler, BlockObjectResponse } from "../types";

vi.mock("@notion-headless-cms/renderer", () => ({
  renderMarkdown: vi.fn(
    async (md: string, opts?: { allowDangerousHtml?: boolean }) => {
      return `[allowDangerousHtml=${opts?.allowDangerousHtml ?? false}]${md}`;
    },
  ),
}));

const ctx = { client: undefined, pageId: "p" };

const baseBlock = {
  object: "block" as const,
  id: "x",
  parent: { type: "page_id" as const, page_id: "p" },
  created_time: "",
  last_edited_time: "",
  created_by: { object: "user" as const, id: "u" },
  last_edited_by: { object: "user" as const, id: "u" },
  has_children: false,
  archived: false,
  in_trash: false,
};

const text = (s: string) => ({
  type: "text" as const,
  text: { content: s, link: null },
  annotations: {
    bold: false,
    italic: false,
    strikethrough: false,
    underline: false,
    code: false,
    color: "default" as const,
  },
  plain_text: s,
  href: null,
});

/** blocks マップから handler を取り出す。未登録なら throw する。 */
function getHandler(
  blocks: Record<string, BlockHandler>,
  key: string,
): BlockHandler {
  const h = blocks[key];
  if (!h) throw new Error(`handler not registered: ${key}`);
  return h;
}

/** テスト用に作った疑似 block を BlockObjectResponse として渡すための共通キャスト。 */
function asBlock(b: unknown): BlockObjectResponse {
  return b as BlockObjectResponse;
}

describe("notionEmbed()", () => {
  it("renderer と blocks を返す", () => {
    const result = notionEmbed();
    expect(typeof result.renderer).toBe("function");
    expect(typeof result.blocks).toBe("object");
  });

  it("blocks に主要なハンドラが登録されている", () => {
    const { blocks } = notionEmbed();
    const expected = [
      "paragraph",
      "heading_1",
      "heading_2",
      "heading_3",
      "bulleted_list_item",
      "numbered_list_item",
      "quote",
      "to_do",
      "callout",
      "toggle",
      "bookmark",
      "link_preview",
      "embed",
      "video",
      "audio",
      "pdf",
      "image",
    ];
    for (const key of expected) {
      expect(blocks[key]).toBeDefined();
      expect(typeof blocks[key]).toBe("function");
    }
  });

  it("renderer は allowDangerousHtml: true で renderMarkdown を呼ぶ", async () => {
    const { renderer } = notionEmbed({ providers: [steamProvider()] });
    const html = await renderer("# Hello");
    expect(html).toContain("[allowDangerousHtml=true]");
  });

  it("rendererOpts の rehypePlugins とマージできる", async () => {
    const { renderer } = notionEmbed();
    const result = await renderer("Hello", { rehypePlugins: [] });
    expect(typeof result).toBe("string");
  });

  it("ogp=false を渡すと bookmark が fetch を呼ばない", async () => {
    const { blocks } = notionEmbed({ ogp: false });
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await getHandler(blocks, "bookmark")(
      asBlock({
        ...baseBlock,
        type: "bookmark",
        bookmark: { url: "https://example.com", caption: [] },
      }),
      ctx,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("ogp=true を指定しても fetch を行う", async () => {
    const { blocks } = notionEmbed({ ogp: true });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("<html></html>", { status: 200 }));
    await getHandler(blocks, "bookmark")(
      asBlock({
        ...baseBlock,
        type: "bookmark",
        bookmark: { url: "https://example.com", caption: [] },
      }),
      ctx,
    );
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  describe("各ハンドラを実行できる", () => {
    const { blocks } = notionEmbed();

    it("paragraph", async () => {
      const html = await getHandler(blocks, "paragraph")(
        asBlock({
          ...baseBlock,
          type: "paragraph",
          paragraph: {
            rich_text: [text("p")],
            color: "default",
            icon: null,
          },
        }),
        ctx,
      );
      expect(html).toContain("<p>p</p>");
    });

    it("heading_1 / heading_2 / heading_3", async () => {
      const make = (level: 1 | 2 | 3) =>
        asBlock({
          ...baseBlock,
          type: `heading_${level}`,
          [`heading_${level}`]: {
            rich_text: [text(`H${level}`)],
            color: "default",
            is_toggleable: false,
          },
        });
      expect(await getHandler(blocks, "heading_1")(make(1), ctx)).toContain(
        "<h1>",
      );
      expect(await getHandler(blocks, "heading_2")(make(2), ctx)).toContain(
        "<h2>",
      );
      expect(await getHandler(blocks, "heading_3")(make(3), ctx)).toContain(
        "<h3>",
      );
    });

    it("bulleted_list_item / numbered_list_item", async () => {
      expect(
        await getHandler(blocks, "bulleted_list_item")(
          asBlock({
            ...baseBlock,
            type: "bulleted_list_item",
            bulleted_list_item: { rich_text: [text("a")], color: "default" },
          }),
          ctx,
        ),
      ).toContain("<li>");
      expect(
        await getHandler(blocks, "numbered_list_item")(
          asBlock({
            ...baseBlock,
            type: "numbered_list_item",
            numbered_list_item: { rich_text: [text("b")], color: "default" },
          }),
          ctx,
        ),
      ).toContain("<li>");
    });

    it("quote / to_do", async () => {
      expect(
        await getHandler(blocks, "quote")(
          asBlock({
            ...baseBlock,
            type: "quote",
            quote: { rich_text: [text("q")], color: "default" },
          }),
          ctx,
        ),
      ).toContain("nhc-quote");
      expect(
        await getHandler(blocks, "to_do")(
          asBlock({
            ...baseBlock,
            type: "to_do",
            to_do: {
              rich_text: [text("t")],
              checked: false,
              color: "default",
            },
          }),
          ctx,
        ),
      ).toContain("nhc-todo");
    });

    it("callout / toggle", async () => {
      expect(
        await getHandler(blocks, "callout")(
          asBlock({
            ...baseBlock,
            type: "callout",
            callout: {
              rich_text: [text("c")],
              color: "default",
              icon: { type: "emoji", emoji: "💡" },
            },
          }),
          ctx,
        ),
      ).toContain("nhc-callout");
      expect(
        await getHandler(blocks, "toggle")(
          asBlock({
            ...baseBlock,
            type: "toggle",
            toggle: { rich_text: [text("t")], color: "default" },
          }),
          ctx,
        ),
      ).toContain("<details");
    });

    it("link_preview / embed", async () => {
      expect(
        await getHandler(blocks, "link_preview")(
          asBlock({
            ...baseBlock,
            type: "link_preview",
            link_preview: { url: "https://example.com" },
          }),
          ctx,
        ),
      ).toContain("nhc-link-preview");
      expect(
        await getHandler(blocks, "embed")(
          asBlock({
            ...baseBlock,
            type: "embed",
            embed: { url: "https://example.com", caption: [] },
          }),
          ctx,
        ),
      ).toContain("nhc-embed");
    });

    it("video / audio / pdf / image", async () => {
      const ext = (url: string) => ({
        type: "external" as const,
        external: { url },
      });
      expect(
        await getHandler(blocks, "video")(
          asBlock({
            ...baseBlock,
            type: "video",
            video: { ...ext("https://x/v.mp4"), caption: [] },
          }),
          ctx,
        ),
      ).toContain("nhc-video");
      expect(
        await getHandler(blocks, "audio")(
          asBlock({
            ...baseBlock,
            type: "audio",
            audio: ext("https://x/a.mp3"),
          }),
          ctx,
        ),
      ).toContain("<audio");
      expect(
        await getHandler(blocks, "pdf")(
          asBlock({
            ...baseBlock,
            type: "pdf",
            pdf: ext("https://x/p.pdf"),
          }),
          ctx,
        ),
      ).toContain("nhc-pdf");
      expect(
        await getHandler(blocks, "image")(
          asBlock({
            ...baseBlock,
            type: "image",
            image: { ...ext("https://x/i.png"), caption: [] },
          }),
          ctx,
        ),
      ).toContain("nhc-image");
    });
  });
});
