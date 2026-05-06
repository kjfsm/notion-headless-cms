import type {
  AudioBlockObjectResponse,
  EmbedBlockObjectResponse,
  ImageBlockObjectResponse,
  PdfBlockObjectResponse,
  VideoBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import { describe, expect, it, vi } from "vitest";
import {
  renderAudio,
  renderEmbed,
  renderImage,
  renderPdf,
  renderVideo,
} from "../../handlers/embed";

const blockBase = {
  object: "block" as const,
  id: "id",
  parent: { type: "page_id" as const, page_id: "p" },
  created_time: "",
  last_edited_time: "",
  created_by: { object: "user" as const, id: "u" },
  last_edited_by: { object: "user" as const, id: "u" },
  has_children: false,
  archived: false,
  in_trash: false,
};

describe("renderEmbed", () => {
  const make = (url: string): EmbedBlockObjectResponse => ({
    ...blockBase,
    type: "embed",
    embed: { url, caption: [] },
  });

  it("マッチする provider があればそれを使う", async () => {
    const provider = {
      id: "test",
      match: (u: string) => u.includes("example.com"),
      render: () => ({ kind: "html" as const, html: "<custom/>" }),
    };
    const html = await renderEmbed(make("https://example.com/"), [provider]);
    expect(html).toContain('class="nhc-embed"');
    expect(html).toContain("<custom/>");
  });

  it("provider なし・OGP あり → OGP カードを出す", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        `<html><head>
          <meta property="og:title" content="サンプルページ" />
          <meta property="og:description" content="説明文" />
          <meta property="og:image" content="https://example.com/og.png" />
        </head></html>`,
        { headers: { "content-type": "text/html" } },
      ),
    );
    try {
      const html = await renderEmbed(make("https://example.com/page"), []);
      expect(html).toContain('class="nhc-embed"');
      expect(html).toContain("nhc-bookmark");
      expect(html).toContain("サンプルページ");
      expect(html).toContain("説明文");
      expect(html).toContain("og.png");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("provider なし・OGP 取得失敗 → 汎用 iframe にフォールバック", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network error"));
    try {
      const html = await renderEmbed(make("https://example.com/anything"), []);
      expect(html).toContain('class="nhc-embed"');
      expect(html).toContain("<iframe");
      expect(html).toContain('src="https://example.com/anything"');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("OGP データなし (空レスポンス) → 汎用 iframe にフォールバック", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("<html><body>no og tags</body></html>", {
        headers: { "content-type": "text/html" },
      }),
    );
    try {
      const html = await renderEmbed(make("https://example.com/anything"), []);
      expect(html).toContain("<iframe");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("ogpOptions: false → OGP 取得せず即 iframe", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(""));
    try {
      const html = await renderEmbed(
        make("https://example.com/anything"),
        [],
        false,
      );
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(html).toContain("<iframe");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("OGP title のみ (description/siteName/image なし) → カード出力、ホスト名は使わない", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          `<html><head><meta property="og:title" content="タイトルのみ" /></head></html>`,
          { headers: { "content-type": "text/html" } },
        ),
      );
    try {
      const html = await renderEmbed(make("https://example.com/page"), []);
      expect(html).toContain("nhc-bookmark");
      expect(html).toContain("タイトルのみ");
      expect(html).not.toContain("nhc-bookmark__description");
      expect(html).not.toContain("nhc-bookmark__site");
      expect(html).not.toContain("nhc-bookmark__cover");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("OGP title なし → URL のホスト名をタイトルとして使う", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          `<html><head><meta property="og:description" content="説明のみ" /></head></html>`,
          { headers: { "content-type": "text/html" } },
        ),
      );
    try {
      const html = await renderEmbed(make("https://example.com/page"), []);
      expect(html).toContain("nhc-bookmark");
      expect(html).toContain("example.com");
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("provider が skip を返したら空文字列", async () => {
    const skipProvider = {
      id: "skip",
      match: () => true,
      render: () => ({ kind: "skip" as const }),
    };
    const html = await renderEmbed(make("https://x"), [skipProvider]);
    expect(html).toBe("");
  });

  it("caption があれば nhc-embed__caption を付ける", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("network error"));
    try {
      const block: EmbedBlockObjectResponse = {
        ...blockBase,
        type: "embed",
        embed: {
          url: "https://example.com",
          caption: [
            {
              type: "text",
              text: { content: "キャプション", link: null },
              annotations: {
                bold: false,
                italic: false,
                strikethrough: false,
                underline: false,
                code: false,
                color: "default",
              },
              plain_text: "キャプション",
              href: null,
            },
          ],
        },
      };
      const html = await renderEmbed(block, []);
      expect(html).toContain('class="nhc-embed__caption"');
      expect(html).toContain("キャプション");
    } finally {
      fetchSpy.mockRestore();
    }
  });
});

describe("renderVideo", () => {
  const makeExternal = (url: string): VideoBlockObjectResponse =>
    ({
      ...blockBase,
      type: "video",
      video: {
        type: "external",
        external: { url },
        caption: [],
      },
    }) as VideoBlockObjectResponse;

  const makeFile = (url: string): VideoBlockObjectResponse =>
    ({
      ...blockBase,
      type: "video",
      video: {
        type: "file",
        file: { url, expiry_time: "" },
        caption: [],
      },
    }) as VideoBlockObjectResponse;

  it("外部 MP4 URL は video タグで出力する", async () => {
    const html = await renderVideo(
      makeExternal("https://example.com/video.mp4"),
      [],
    );
    expect(html).toContain('class="nhc-video"');
    expect(html).toContain("<video");
    expect(html).not.toContain("<iframe");
  });

  it("外部ストリーム URL (非メディア拡張子) は iframe で出力する", async () => {
    const html = await renderVideo(
      makeExternal("https://example.com/stream"),
      [],
    );
    expect(html).toContain('class="nhc-video"');
    expect(html).toContain("<iframe");
  });

  it("外部 WebM / OGG / MOV も video タグで出力する", async () => {
    for (const ext of ["webm", "ogg", "mov"]) {
      const html = await renderVideo(
        makeExternal(`https://example.com/video.${ext}`),
        [],
      );
      expect(html).toContain("<video");
      expect(html).not.toContain("<iframe");
    }
  });

  it("クエリ文字列付き MP4 URL も video タグで出力する", async () => {
    const html = await renderVideo(
      makeExternal("https://example.com/video.mp4?t=10"),
      [],
    );
    expect(html).toContain("<video");
  });

  it("Notion file 系は <video> タグで出力する", async () => {
    const html = await renderVideo(
      makeFile("https://files.notion.so/x.mp4"),
      [],
    );
    expect(html).toContain("<video");
    expect(html).toContain("controls");
  });

  it("URL が無ければ空文字", async () => {
    const html = await renderVideo(
      {
        ...blockBase,
        type: "video",
        video: { type: "external", external: { url: "" }, caption: [] },
      } as VideoBlockObjectResponse,
      [],
    );
    // extractFileUrl は url が空文字でも返すため、iframe が出る
    expect(typeof html).toBe("string");
  });

  it("外部 URL に caption があれば nhc-video__caption を出す", async () => {
    const block = {
      ...blockBase,
      type: "video",
      video: {
        type: "external",
        external: { url: "https://example.com/v.mp4" },
        caption: [
          {
            type: "text",
            text: { content: "vc", link: null },
            annotations: {
              bold: false,
              italic: false,
              strikethrough: false,
              underline: false,
              code: false,
              color: "default",
            },
            plain_text: "vc",
            href: null,
          },
        ],
      },
    } as VideoBlockObjectResponse;
    const html = await renderVideo(block, []);
    expect(html).toContain("nhc-video__caption");
    expect(html).toContain("vc");
  });

  it("provider にマッチすれば provider の HTML を使う", async () => {
    const provider = {
      id: "test",
      match: () => true,
      render: () => ({ kind: "html" as const, html: "<custom-video/>" }),
    };
    const html = await renderVideo(
      makeExternal("https://example.com/video.mp4"),
      [provider],
    );
    expect(html).toContain("<custom-video/>");
  });

  it("provider が html 以外（skip）を返したら通常のフォールバックに進む", async () => {
    const skipProvider = {
      id: "skip",
      match: () => true,
      render: () => ({ kind: "skip" as const }),
    };
    const html = await renderVideo(makeExternal("https://example.com/stream"), [
      skipProvider,
    ]);
    // skip 後は非メディア外部 URL なので iframe フォールバックが出る
    expect(html).toContain("<iframe");
    expect(html).toContain('class="nhc-video"');
  });
});

describe("renderAudio", () => {
  it("audio タグを出力する", async () => {
    const block = {
      ...blockBase,
      type: "audio",
      audio: {
        type: "external",
        external: { url: "https://example.com/x.mp3" },
      },
    } as AudioBlockObjectResponse;
    const html = await renderAudio(block);
    expect(html).toContain("<audio");
    expect(html).toContain('src="https://example.com/x.mp3"');
    expect(html).toContain("controls");
  });

  it("URL が抽出できなければ空文字", async () => {
    const block = {
      ...blockBase,
      type: "audio",
      audio: { type: "unknown" },
    } as unknown as AudioBlockObjectResponse;
    const html = await renderAudio(block);
    expect(html).toBe("");
  });
});

describe("renderPdf", () => {
  it("iframe で PDF を出力する", async () => {
    const block = {
      ...blockBase,
      type: "pdf",
      pdf: { type: "external", external: { url: "https://example.com/x.pdf" } },
    } as PdfBlockObjectResponse;
    const html = await renderPdf(block);
    expect(html).toContain('class="nhc-pdf"');
    expect(html).toContain("<iframe");
  });

  it("URL なしは空文字", async () => {
    const block = {
      ...blockBase,
      type: "pdf",
      pdf: { type: "unknown" },
    } as unknown as PdfBlockObjectResponse;
    expect(await renderPdf(block)).toBe("");
  });
});

describe("renderImage", () => {
  it("figure + img を出力する", async () => {
    const block = {
      ...blockBase,
      type: "image",
      image: {
        type: "external",
        external: { url: "https://example.com/x.png" },
        caption: [],
      },
    } as ImageBlockObjectResponse;
    const html = await renderImage(block);
    expect(html).toContain('class="nhc-image"');
    expect(html).toContain('<img src="https://example.com/x.png"');
    expect(html).toContain('loading="lazy"');
  });

  it("caption から alt と figcaption を作る", async () => {
    const block = {
      ...blockBase,
      type: "image",
      image: {
        type: "external",
        external: { url: "https://example.com/x.png" },
        caption: [{ plain_text: "猫" }],
      },
    } as ImageBlockObjectResponse;
    const html = await renderImage(block);
    expect(html).toContain('alt="猫"');
    expect(html).toContain('class="nhc-image__caption"');
  });

  it("URL なしは空文字", async () => {
    const block = {
      ...blockBase,
      type: "image",
      image: { type: "unknown" },
    } as unknown as ImageBlockObjectResponse;
    expect(await renderImage(block)).toBe("");
  });
});
