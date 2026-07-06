import { describe, expect, it } from "vitest";

import { renderEmbedIframe, renderOgpShell } from "../embeds.js";

describe("renderOgpShell", () => {
  it("fetch せずホスト名 + URL のシェルを返す(data-nhc-ogp-url 属性つき)", () => {
    const html = renderOgpShell("https://example.com/article", "bookmark");
    expect(html).toContain('data-nhc-ogp-url="https://example.com/article"');
    expect(html).toContain("example.com");
    expect(html).toContain('class="nhc-bookmark-block"');
  });

  it("caption があれば付与する", () => {
    const html = renderOgpShell("https://example.com", "bookmark", "説明文");
    expect(html).toContain("説明文");
  });

  it("variant ごとにクラス名を変える", () => {
    expect(renderOgpShell("https://example.com", "embed")).toContain("nhc-embed-block");
    expect(renderOgpShell("https://example.com", "link_preview")).toContain(
      "nhc-link_preview-block",
    );
  });
});

describe("renderEmbedIframe", () => {
  it("YouTube の動画 URL は embed iframe に変換する(fetch しない)", () => {
    const html = renderEmbedIframe("https://www.youtube.com/watch?v=abc12345678");
    expect(html).toContain('src="https://www.youtube.com/embed/abc12345678"');
    expect(html).toContain("<iframe");
  });

  it("youtu.be の短縮 URL にも対応する", () => {
    const html = renderEmbedIframe("https://youtu.be/abc12345678");
    expect(html).toContain("https://www.youtube.com/embed/abc12345678");
  });

  it("動画 ID を抽出できない YouTube URL(チャンネル等)は null を返す", () => {
    expect(renderEmbedIframe("https://www.youtube.com/@somechannel")).toBeNull();
  });

  it("allowedEmbedHosts に一致するホストは iframe を生成する", () => {
    const html = renderEmbedIframe("https://player.vimeo.com/video/1", ["vimeo.com"]);
    expect(html).toContain('src="https://player.vimeo.com/video/1"');
  });

  it("allowlist に無いホストは iframe を生成せず null を返す(サニタイズ)", () => {
    expect(renderEmbedIframe("https://evil.example.com/x", ["vimeo.com"])).toBeNull();
  });

  it("allowedEmbedHosts を省略すると allowlist は空(YouTube 以外は null)", () => {
    expect(renderEmbedIframe("https://player.vimeo.com/video/1")).toBeNull();
  });

  it("iframe には sandbox 属性が必ず付く", () => {
    const html = renderEmbedIframe("https://player.vimeo.com/video/1", ["vimeo.com"]);
    expect(html).toContain("sandbox=");
  });

  it("iframe の sandbox は allow-same-origin を含まない(allow-scripts との併用は sandbox 無効化のアンチパターン)", () => {
    const html = renderEmbedIframe("https://player.vimeo.com/video/1", ["vimeo.com"]);
    expect(html).not.toContain("allow-same-origin");
  });
});
