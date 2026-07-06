import { describe, expect, it } from "vitest";

import { safeHref, safeIframeSrc, safeMediaSrc } from "../lib/safe-url.js";

describe("safeHref", () => {
  it("http(s)/mailto/tel と相対系を許可する", () => {
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("http://example.com")).toBe("http://example.com");
    expect(safeHref("mailto:foo@example.com")).toBe("mailto:foo@example.com");
    expect(safeHref("tel:+81-3-0000-0000")).toBe("tel:+81-3-0000-0000");
    expect(safeHref("/path/to")).toBe("/path/to");
    expect(safeHref("#anchor")).toBe("#anchor");
    expect(safeHref("?q=1")).toBe("?q=1");
    expect(safeHref("//cdn.example.com/x")).toBe("//cdn.example.com/x");
    expect(safeHref("relative/path")).toBe("relative/path");
  });

  it("javascript:/data:/vbscript: 等の危険スキームは undefined", () => {
    expect(safeHref("javascript:alert(1)")).toBeUndefined();
    expect(safeHref("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeHref("vbscript:msgbox(1)")).toBeUndefined();
    expect(safeHref("blob:https://x/y")).toBeUndefined();
  });

  it("空白を挟んだスキーム回避も弾く", () => {
    expect(safeHref("java\tscript:alert(1)")).toBeUndefined();
    expect(safeHref("java\nscript:alert(1)")).toBeUndefined();
    expect(safeHref("  javascript:alert(1)")).toBeUndefined();
  });

  it("空文字・null・undefined は undefined", () => {
    expect(safeHref("")).toBeUndefined();
    expect(safeHref("   ")).toBeUndefined();
    expect(safeHref(null)).toBeUndefined();
    expect(safeHref(undefined)).toBeUndefined();
  });
});

describe("safeMediaSrc", () => {
  it("http(s)/data:/相対系を許可する", () => {
    expect(safeMediaSrc("https://example.com/a.png")).toBe("https://example.com/a.png");
    expect(safeMediaSrc("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(safeMediaSrc("/img/a.png")).toBe("/img/a.png");
    expect(safeMediaSrc("//cdn.example.com/a.png")).toBe("//cdn.example.com/a.png");
  });

  it("javascript:/vbscript: は undefined", () => {
    expect(safeMediaSrc("javascript:alert(1)")).toBeUndefined();
    expect(safeMediaSrc("vbscript:msgbox(1)")).toBeUndefined();
    expect(safeMediaSrc("")).toBeUndefined();
    expect(safeMediaSrc(null)).toBeUndefined();
  });
});

describe("safeIframeSrc", () => {
  it("http(s)/プロトコル相対のみ許可する", () => {
    expect(safeIframeSrc("https://www.youtube.com/embed/xxx")).toBe(
      "https://www.youtube.com/embed/xxx",
    );
    expect(safeIframeSrc("http://example.com")).toBe("http://example.com");
    expect(safeIframeSrc("//player.vimeo.com/video/1")).toBe("//player.vimeo.com/video/1");
  });

  it("data:/javascript:/blob:/相対 は undefined(スクリプト実行/同一オリジンを避ける)", () => {
    expect(safeIframeSrc("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeIframeSrc("javascript:alert(1)")).toBeUndefined();
    expect(safeIframeSrc("blob:https://x/y")).toBeUndefined();
    expect(safeIframeSrc("/relative/embed")).toBeUndefined();
    expect(safeIframeSrc("")).toBeUndefined();
    expect(safeIframeSrc(null)).toBeUndefined();
  });
});
