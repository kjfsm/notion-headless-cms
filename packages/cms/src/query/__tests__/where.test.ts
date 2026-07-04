import { describe, expect, it } from "vitest";
import { evaluateWhere, sortByMeta } from "../where.js";

describe("evaluateWhere", () => {
  it("where 未指定は常に true", () => {
    expect(evaluateWhere({ title: "a" }, undefined)).toBe(true);
  });

  it("equals", () => {
    expect(
      evaluateWhere(
        { status: "published" },
        { status: { equals: "published" } },
      ),
    ).toBe(true);
    expect(
      evaluateWhere({ status: "draft" }, { status: { equals: "published" } }),
    ).toBe(false);
  });

  it("contains / startsWith", () => {
    expect(
      evaluateWhere({ title: "Hello World" }, { title: { contains: "World" } }),
    ).toBe(true);
    expect(
      evaluateWhere(
        { title: "Hello World" },
        { title: { startsWith: "Hello" } },
      ),
    ).toBe(true);
    expect(
      evaluateWhere(
        { title: "Hello World" },
        { title: { startsWith: "World" } },
      ),
    ).toBe(false);
  });

  it("has / hasAny / hasAll (multiSelect)", () => {
    const meta = { tags: ["tech", "life"] };
    expect(evaluateWhere(meta, { tags: { has: "tech" } })).toBe(true);
    expect(evaluateWhere(meta, { tags: { has: "food" } })).toBe(false);
    expect(evaluateWhere(meta, { tags: { hasAny: ["food", "tech"] } })).toBe(
      true,
    );
    expect(evaluateWhere(meta, { tags: { hasAll: ["tech", "life"] } })).toBe(
      true,
    );
    expect(evaluateWhere(meta, { tags: { hasAll: ["tech", "food"] } })).toBe(
      false,
    );
  });

  it("number 比較演算子", () => {
    const meta = { views: 10 };
    expect(evaluateWhere(meta, { views: { gt: 5 } })).toBe(true);
    expect(evaluateWhere(meta, { views: { gte: 10 } })).toBe(true);
    expect(evaluateWhere(meta, { views: { lt: 5 } })).toBe(false);
    expect(evaluateWhere(meta, { views: { lte: 10 } })).toBe(true);
  });

  it("date 範囲演算子", () => {
    const meta = { publishedAt: "2026-06-01" };
    expect(evaluateWhere(meta, { publishedAt: { after: "2026-01-01" } })).toBe(
      true,
    );
    expect(evaluateWhere(meta, { publishedAt: { before: "2026-01-01" } })).toBe(
      false,
    );
    expect(
      evaluateWhere(meta, { publishedAt: { onOrAfter: "2026-06-01" } }),
    ).toBe(true);
  });

  it("in", () => {
    expect(
      evaluateWhere(
        { status: "draft" },
        { status: { in: ["draft", "review"] } },
      ),
    ).toBe(true);
    expect(
      evaluateWhere(
        { status: "published" },
        { status: { in: ["draft", "review"] } },
      ),
    ).toBe(false);
  });

  it("複数キーは AND 条件", () => {
    const meta = { status: "published", views: 10 };
    expect(
      evaluateWhere(meta, {
        status: { equals: "published" },
        views: { gt: 5 },
      }),
    ).toBe(true);
    expect(
      evaluateWhere(meta, {
        status: { equals: "published" },
        views: { gt: 50 },
      }),
    ).toBe(false);
  });
});

describe("sortByMeta", () => {
  it("数値昇順", () => {
    const items = [{ v: 3 }, { v: 1 }, { v: 2 }];
    const sorted = sortByMeta(items, [{ by: "v", direction: "asc" }], (i) => i);
    expect(sorted.map((i) => i.v)).toEqual([1, 2, 3]);
  });

  it("文字列降順", () => {
    const items = [{ v: "a" }, { v: "c" }, { v: "b" }];
    const sorted = sortByMeta(
      items,
      [{ by: "v", direction: "desc" }],
      (i) => i,
    );
    expect(sorted.map((i) => i.v)).toEqual(["c", "b", "a"]);
  });

  it("sort 未指定は入力順を保つ(新しい配列を返す)", () => {
    const items = [{ v: 1 }, { v: 2 }];
    const sorted = sortByMeta(items, undefined, (i) => i);
    expect(sorted).toEqual(items);
    expect(sorted).not.toBe(items);
  });

  it("複数キーのタイブレーク", () => {
    const items = [
      { category: "a", order: 2 },
      { category: "a", order: 1 },
      { category: "b", order: 1 },
    ];
    const sorted = sortByMeta(
      items,
      [
        { by: "category", direction: "asc" },
        { by: "order", direction: "asc" },
      ],
      (i) => i,
    );
    expect(sorted).toEqual([
      { category: "a", order: 1 },
      { category: "a", order: 2 },
      { category: "b", order: 1 },
    ]);
  });
});
