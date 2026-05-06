/**
 * embedRehypePlugins を通して provider の HTML が正しく出力されることを検証する。
 */

import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { genericIframeProvider } from "../providers/generic-iframe";
import { embedRehypePlugins } from "../rehype/rehype-sanitize-embeds";

async function renderWithPlugins(
  markdown: string,
  providers = [] as Parameters<typeof embedRehypePlugins>[0]["providers"],
): Promise<string> {
  const rehypePlugins = await embedRehypePlugins({ providers });

  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    // rehypePlugins は [plugin, options] 配列なので個別 use ではなくまとめて適用する
    .use(rehypePlugins)
    .use(rehypeStringify);

  const result = await processor.process(markdown);
  return String(result);
}

describe("genericIframeProvider の iframe 通過", () => {
  const provider = genericIframeProvider({
    allowedHosts: ["trusted.example"],
    width: 640,
    height: 360,
  });
  const iframeHtml = `<iframe src="https://trusted.example/embed" width="640" height="360" frameborder="0"></iframe>`;

  it("許可ホストの <iframe> が出力に残る", async () => {
    const result = await renderWithPlugins(iframeHtml, [provider]);
    expect(result).toContain("<iframe");
    expect(result).toContain("trusted.example/embed");
  });

  it("width / height 属性が保持される", async () => {
    const result = await renderWithPlugins(iframeHtml, [provider]);
    expect(result).toContain('width="640"');
    expect(result).toContain('height="360"');
  });
});

describe("<iframe> の frameborder / allowfullscreen 属性保持", () => {
  // rehype-sanitize のスキーマに HAST プロパティ名 (frameBorder/allowFullScreen) を
  // 使わないと、これらの属性が sanitize で削除されてしまう。
  const youtubeHtml = `<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ" width="560" height="315" frameborder="0" allowfullscreen></iframe>`;

  it("allowfullscreen 属性が保持される", async () => {
    const result = await renderWithPlugins(youtubeHtml);
    expect(result).toContain("allowfullscreen");
  });

  it("frameborder 属性が保持される", async () => {
    const result = await renderWithPlugins(youtubeHtml);
    expect(result).toContain('frameborder="0"');
  });
});

describe("XSS の排除", () => {
  it("<script> タグはサニタイズされる", async () => {
    const result = await renderWithPlugins(`<script>alert('xss')</script>`);
    expect(result).not.toContain("<script>");
  });

  it("javascript: href はサニタイズされる", async () => {
    const result = await renderWithPlugins(
      `<a href="javascript:alert(1)">click</a>`,
    );
    expect(result).not.toContain("javascript:");
  });
});

describe("nhc-* クラスの保持", () => {
  it("notionEmbed が出す class 属性 (nhc-bookmark / nhc-mention など) を sanitize で剥がさない", async () => {
    const html = `<a class="nhc-bookmark" href="https://example.com"><div class="nhc-bookmark__main"><p class="nhc-bookmark__title">Title</p></div></a>`;
    const result = await renderWithPlugins(html);
    expect(result).toContain('class="nhc-bookmark"');
    expect(result).toContain('class="nhc-bookmark__main"');
    expect(result).toContain('class="nhc-bookmark__title"');
  });

  it("nhc-mention のアイコン img と <strong> タイトルが残る", async () => {
    const html = `<a class="nhc-mention nhc-mention--link" href="https://x"><img class="nhc-mention__icon nhc-mention__icon--image" src="https://example.com/icon.png" alt="" /><span class="nhc-mention__provider">YouTube</span><strong class="nhc-mention__title">Foo</strong></a>`;
    const result = await renderWithPlugins(html);
    expect(result).toContain('class="nhc-mention nhc-mention--link"');
    expect(result).toContain(
      'class="nhc-mention__icon nhc-mention__icon--image"',
    );
    expect(result).toContain('src="https://example.com/icon.png"');
    expect(result).toContain('class="nhc-mention__provider"');
    expect(result).toContain("YouTube");
    expect(result).toContain('class="nhc-mention__title"');
  });
});
