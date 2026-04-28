import { describe, expect, it } from "vitest";
import { isHttpUrl, normalizeUrl } from "../url-normalize";

describe("normalizeUrl", () => {
  it("通常の https URL はそのまま返す", () => {
    expect(normalizeUrl("https://example.com/path")).toBe(
      "https://example.com/path",
    );
  });

  it("前後の空白をトリムする", () => {
    expect(normalizeUrl("  https://example.com  ")).toBe("https://example.com");
  });

  it("空文字列は空文字列を返す", () => {
    expect(normalizeUrl("")).toBe("");
  });

  it("プロトコル相対 URL を https: 付きに補完する", () => {
    expect(normalizeUrl("//example.com/path")).toBe("https://example.com/path");
  });

  it("Markdown リンク記法 [label](url) から URL を抽出する", () => {
    expect(normalizeUrl("[foo](https://example.com/page)")).toBe(
      "https://example.com/page",
    );
  });

  it("[//host/path](https://host/path) 形式の壊れた URL を修正する", () => {
    expect(
      normalizeUrl("[//img.dlsite.jp/img.jpg](https://img.dlsite.jp/img.jpg)"),
    ).toBe("https://img.dlsite.jp/img.jpg");
  });

  it("空のラベル [] でも Markdown リンクを抽出できる", () => {
    expect(normalizeUrl("[](https://example.com)")).toBe("https://example.com");
  });

  it("http URL もそのまま返す", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com");
  });
});

describe("isHttpUrl", () => {
  it("https URL は true", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
  });

  it("http URL は true", () => {
    expect(isHttpUrl("http://example.com")).toBe(true);
  });

  it("プロトコル相対 URL は false", () => {
    expect(isHttpUrl("//example.com")).toBe(false);
  });

  it("Markdown リンク記法は false", () => {
    expect(isHttpUrl("[foo](https://example.com)")).toBe(false);
  });

  it("空文字列は false", () => {
    expect(isHttpUrl("")).toBe(false);
  });
});
