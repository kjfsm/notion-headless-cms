import type { RichTextItemResponse } from "@notionhq/client";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NotionContext } from "../context";
import { Mention } from "../rich-text/Mention";

type MentionItem = Extract<RichTextItemResponse, { type: "mention" }>;

const pageMention = (id: string, plain = ""): MentionItem =>
  ({
    type: "mention",
    plain_text: plain,
    href: null,
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: "default",
    },
    mention: { type: "page", page: { id } },
  }) as unknown as MentionItem;

const renderWith = (
  item: MentionItem,
  ctx: Parameters<typeof NotionContext.Provider>[0]["value"] = {
    components: {},
  },
) =>
  render(
    <NotionContext.Provider value={ctx}>
      <Mention item={item} />
    </NotionContext.Provider>,
  );

describe("Mention（page）", () => {
  const id = "11111111-1111-1111-1111-111111111111";

  it("resolvePageUrl 未指定なら従来どおりリンク化せず素の表示", () => {
    const { container } = renderWith(pageMention(id, "My Page"));
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("My Page");
  });

  it("resolvePageUrl が解決できればリンク化し、resolvePageTitle を表示に使う", () => {
    const { container } = renderWith(pageMention(id, "plain"), {
      components: {},
      resolvePageUrl: () => "/posts/my-page",
      resolvePageTitle: () => "解決済みタイトル",
    });
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/posts/my-page");
    expect(a?.textContent).toContain("解決済みタイトル");
  });

  it("resolvePageUrl が undefined を返したらフォールバック表示", () => {
    const { container } = renderWith(pageMention(id, "plain"), {
      components: {},
      resolvePageUrl: () => undefined,
    });
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("plain");
  });

  it("pageLinks（シリアライズ可能マップ）で解決しリンク化する", () => {
    // pageLinks のキーは正規化済み pageId（ダッシュ除去 + 小文字化）
    const key = id.replace(/-/g, "").toLowerCase();
    const { container } = renderWith(pageMention(id, "plain"), {
      components: {},
      pageLinks: { [key]: { href: "/posts/x", title: "マップ由来" } },
    });
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/posts/x");
    expect(a?.textContent).toContain("マップ由来");
  });

  it("javascript: な resolvePageUrl はリンク化せずフォールバック表示する", () => {
    const { container } = renderWith(pageMention(id, "plain"), {
      components: {},
      resolvePageUrl: () => "javascript:alert(1)",
    });
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("plain");
  });
});

const linkMention = (opts: { href: string; iconUrl?: string; title?: string }): MentionItem =>
  ({
    type: "mention",
    plain_text: opts.title ?? "",
    href: null,
    annotations: {
      bold: false,
      italic: false,
      strikethrough: false,
      underline: false,
      code: false,
      color: "default",
    },
    mention: {
      type: "link_mention",
      link_mention: {
        href: opts.href,
        icon_url: opts.iconUrl,
        title: opts.title,
      },
    },
  }) as unknown as MentionItem;

describe("Mention（link_mention）のスキーム検証", () => {
  it("正常な http(s) href はリンク化する", () => {
    const { container } = renderWith(linkMention({ href: "https://example.com", title: "Ex" }));
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://example.com");
  });

  it("javascript: href はリンク化せず span で表示する", () => {
    const { container } = renderWith(linkMention({ href: "javascript:alert(1)", title: "Danger" }));
    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toContain("Danger");
  });

  it("javascript: な icon_url は img として描画しない", () => {
    const { container } = renderWith(
      linkMention({
        href: "https://example.com",
        iconUrl: "javascript:alert(1)",
        title: "Ex",
      }),
    );
    expect(container.querySelector("img")).toBeNull();
  });
});
