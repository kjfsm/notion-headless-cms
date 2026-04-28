import type { BookmarkBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderBookmark } from "../../handlers/bookmark";
import { clearOgpCache } from "../../ogp";

function makeBlock(
  url: string,
  caption: BookmarkBlockObjectResponse["bookmark"]["caption"] = [],
): BookmarkBlockObjectResponse {
  return {
    object: "block",
    id: "block-id",
    parent: { type: "page_id", page_id: "page-id" },
    created_time: "",
    last_edited_time: "",
    created_by: { object: "user", id: "user-id" },
    last_edited_by: { object: "user", id: "user-id" },
    has_children: false,
    archived: false,
    in_trash: false,
    type: "bookmark",
    bookmark: { url, caption },
  };
}

describe("renderBookmark", () => {
  beforeEach(() => clearOgpCache());
  afterEach(() => {
    vi.restoreAllMocks();
    clearOgpCache();
  });

  it("nhc-bookmark クラスの <a> タグを返す", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html></html>", { status: 200 }),
    );
    const html = await renderBookmark(makeBlock("https://example.com"));
    // OGP なし時は nhc-bookmark--no-ogp も付くため前方一致で確認
    expect(html).toContain('class="nhc-bookmark');
    expect(html).toContain('href="https://example.com"');
  });

  it("OGP が取得できれば title / description / image を表示する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        `<html><head>
					<meta property="og:title" content="OGP Title" />
					<meta property="og:description" content="OGP Desc" />
					<meta property="og:image" content="https://example.com/img.png" />
					<meta property="og:site_name" content="My Site" />
				</head></html>`,
        { status: 200 },
      ),
    );
    const html = await renderBookmark(makeBlock("https://example.com"));
    expect(html).toContain("OGP Title");
    expect(html).toContain("OGP Desc");
    expect(html).toContain("https://example.com/img.png");
    expect(html).toContain("My Site");
    expect(html).toContain('class="nhc-bookmark__cover"');
  });

  it("OGP 画像がなければ cover セクションを出力しない", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        `<html><head><meta property="og:title" content="No Image" /></head></html>`,
        { status: 200 },
      ),
    );
    const html = await renderBookmark(makeBlock("https://example.com/no-img"));
    expect(html).not.toContain("nhc-bookmark__cover");
  });

  it("ogpOptions=false のとき OGP を取得しない (fetch を呼ばない)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const html = await renderBookmark(makeBlock("https://example.com"), false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(html).toContain("nhc-bookmark");
  });

  it("OGP が失敗したときホスト名をタイトルとして使う", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));
    const html = await renderBookmark(makeBlock("https://example.com/fail"));
    expect(html).toContain("example.com");
    expect(html).not.toContain(">https://example.com/fail<");
  });

  it("OGP が失敗したとき nhc-bookmark--no-ogp クラスが付く", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));
    const html = await renderBookmark(makeBlock("https://example.com/fail"));
    expect(html).toContain("nhc-bookmark--no-ogp");
  });

  it("OGP が取得できたとき nhc-bookmark--no-ogp クラスが付かない", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        `<html><head><meta property="og:title" content="タイトル" /></head></html>`,
        { status: 200 },
      ),
    );
    const html = await renderBookmark(makeBlock("https://example.com"));
    expect(html).not.toContain("nhc-bookmark--no-ogp");
  });

  it("無効な URL でも例外を throw しない", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));
    await expect(
      renderBookmark(makeBlock("not-a-valid-url")),
    ).resolves.toContain("nhc-bookmark");
  });

  it("nhc-bookmark__url に短縮 URL を表示する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html></html>", { status: 200 }),
    );
    const html = await renderBookmark(makeBlock("https://example.com/path"));
    expect(html).toContain('class="nhc-bookmark__url"');
    expect(html).toContain("example.com/path");
  });

  it("target=_blank と rel=noopener noreferrer を付与する", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html></html>", { status: 200 }),
    );
    const html = await renderBookmark(makeBlock("https://example.com"));
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("caption があれば nhc-bookmark__caption を出す", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html></html>", { status: 200 }),
    );
    const caption: BookmarkBlockObjectResponse["bookmark"]["caption"] = [
      {
        type: "text",
        text: { content: "メモ", link: null },
        annotations: {
          bold: false,
          italic: false,
          strikethrough: false,
          underline: false,
          code: false,
          color: "default",
        },
        plain_text: "メモ",
        href: null,
      },
    ];
    const block = makeBlock("https://example.com", caption);
    const html = await renderBookmark(block);
    expect(html).toContain("nhc-bookmark__caption");
    expect(html).toContain("メモ");
  });

  it("ogpOptions にカスタム設定を渡せる", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html></html>", { status: 200 }),
    );
    const html = await renderBookmark(makeBlock("https://example.com/custom"), {
      ttlMs: 1000,
    });
    expect(html).toContain("nhc-bookmark");
  });

  it("XSS インジェクションをエスケープする", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        `<html><head><meta property="og:title" content='<script>alert(1)</script>' /></head></html>`,
        { status: 200 },
      ),
    );
    const html = await renderBookmark(makeBlock("https://example.com/xss"));
    expect(html).not.toContain("<script>");
  });
});
