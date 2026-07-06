import { describe, expect, it } from "vitest";

import { deepEqualJson } from "../deep-equal-json.js";

describe("deepEqualJson", () => {
  it("プリミティブの一致/不一致を判定する", () => {
    expect(deepEqualJson("a", "a")).toBe(true);
    expect(deepEqualJson("a", "b")).toBe(false);
    expect(deepEqualJson(1, 1)).toBe(true);
    expect(deepEqualJson(true, false)).toBe(false);
    expect(deepEqualJson(null, null)).toBe(true);
  });

  it("キー順序が異なっても等価なオブジェクトは一致と判定する", () => {
    expect(deepEqualJson({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it("キー数・値が異なるオブジェクトは不一致と判定する", () => {
    expect(deepEqualJson({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqualJson({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("ネストした配列・オブジェクトを再帰的に比較する", () => {
    expect(
      deepEqualJson(
        { tags: ["a", "b"], meta: { title: "x" } },
        { tags: ["a", "b"], meta: { title: "x" } },
      ),
    ).toBe(true);
    expect(
      deepEqualJson(
        { tags: ["a", "b"], meta: { title: "x" } },
        { tags: ["a", "c"], meta: { title: "x" } },
      ),
    ).toBe(false);
  });

  it("配列の長さが異なる場合は不一致と判定する", () => {
    expect(deepEqualJson(["a"], ["a", "b"])).toBe(false);
  });

  it("オブジェクトと配列を比較すると不一致と判定する", () => {
    expect(deepEqualJson({}, [])).toBe(false);
  });
});
