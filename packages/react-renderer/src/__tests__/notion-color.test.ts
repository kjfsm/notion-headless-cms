import { describe, expect, it } from "vitest";

import { notionBlockColorClass, notionInlineColorClass } from "../lib/notion-color";

describe("notionInlineColorClass", () => {
  it("default を空文字に倒す", () => {
    expect(notionInlineColorClass("default")).toBe("");
    expect(notionInlineColorClass(undefined)).toBe("");
  });

  it("foreground は text-* クラスのみ", () => {
    expect(notionInlineColorClass("red")).toBe("text-red-600");
    expect(notionInlineColorClass("blue")).toBe("text-blue-600");
  });

  it("background は bg-* + rounded + 横 padding を返す", () => {
    expect(notionInlineColorClass("blue_background")).toBe("bg-blue-100 rounded px-1");
  });
});

describe("notionBlockColorClass", () => {
  it("background は厚めの padding を付ける", () => {
    expect(notionBlockColorClass("red_background")).toBe("bg-red-100 rounded px-3 py-2");
  });

  it("foreground は inline と同じ class", () => {
    expect(notionBlockColorClass("purple")).toBe("text-purple-600");
  });
});
