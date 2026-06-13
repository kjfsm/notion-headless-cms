import type { LinkPreviewBlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it, vi } from "vitest";
import { renderLinkPreview } from "../../handlers/link-preview";

vi.mock("../../ogp", () => ({
  fetchOgp: vi.fn().mockResolvedValue({}),
}));

function makeBlock(url: string): LinkPreviewBlockObjectResponse {
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
    type: "link_preview",
    link_preview: { url },
  };
}

describe("renderLinkPreview", () => {
  it("nhc-link-preview クラスの <a> タグを返す", async () => {
    const html = await renderLinkPreview(
      makeBlock("https://example.com"),
      false,
    );
    expect(html).toContain('class="nhc-link-preview"');
    expect(html).toContain('href="https://example.com"');
  });

  it("🔗 アイコンを含む", async () => {
    const html = await renderLinkPreview(
      makeBlock("https://example.com"),
      false,
    );
    expect(html).toContain("🔗");
  });

  it("ラベルはプロトコル部分を除いた URL", async () => {
    const html = await renderLinkPreview(
      makeBlock("https://example.com/path"),
      false,
    );
    expect(html).toContain(
      '<span class="nhc-link-preview__label">example.com/path</span>',
    );
  });

  it("target=_blank と rel=noopener noreferrer を付与する", async () => {
    const html = await renderLinkPreview(
      makeBlock("https://example.com"),
      false,
    );
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("プロトコル相対 URL を正規化する", async () => {
    const html = await renderLinkPreview(
      makeBlock("//example.com/path"),
      false,
    );
    expect(html).toContain('href="https://example.com/path"');
  });

  it("XSS URL をエスケープする", async () => {
    const html = await renderLinkPreview(
      makeBlock("https://example.com/?a=1&b=<script>"),
      false,
    );
    expect(html).not.toContain("<script>");
  });

  describe("OGP あり", () => {
    it("OGP カードを出力する", async () => {
      const { fetchOgp } = await import("../../ogp");
      vi.mocked(fetchOgp).mockResolvedValueOnce({
        title: "サンプルページ",
        description: "説明文",
        image: "https://example.com/og.png",
        siteName: "Example",
      });

      const html = await renderLinkPreview(makeBlock("https://example.com"));
      expect(html).toContain("nhc-link-preview--ogp");
      expect(html).toContain("サンプルページ");
      expect(html).toContain('loading="lazy"');
      expect(html).toContain("https://example.com/og.png");
    });

    it("OGP fetch 失敗時はシンプル表示にフォールバックする", async () => {
      const { fetchOgp } = await import("../../ogp");
      vi.mocked(fetchOgp).mockRejectedValueOnce(new Error("fetch failed"));

      const html = await renderLinkPreview(makeBlock("https://example.com"));
      expect(html).toContain("🔗");
      expect(html).not.toContain("nhc-link-preview--ogp");
    });
  });
});
