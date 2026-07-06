import { describe, expectTypeOf, it } from "vitest";

import { prop } from "../types/property.js";
import type { WhereInput } from "../types/query.js";

const properties = {
  title: prop.title(),
  status: prop.status(["draft", "published"] as const),
  tags: prop.multiSelect(),
  publishedAt: prop.date(),
  views: prop.number(),
  featured: prop.checkbox(),
  related: prop.relation("posts"),
};

type Where = WhereInput<typeof properties>;

describe("プロパティ型からの where 演算子導出", () => {
  it("multiSelect には has/hasAny/hasAll が使える", () => {
    const where: Where = { tags: { has: "tech" } };
    expectTypeOf(where.tags).toEqualTypeOf<
      { has?: string; hasAny?: readonly string[]; hasAll?: readonly string[] } | undefined
    >();
  });

  it("number には比較演算子が使える", () => {
    const where: Where = { views: { gte: 10 } };
    expectTypeOf(where.views?.gte).toEqualTypeOf<number | undefined>();
  });

  it("date には範囲演算子が使える", () => {
    const where: Where = { publishedAt: { after: "2026-01-01" } };
    expectTypeOf(where.publishedAt?.after).toEqualTypeOf<string | undefined>();
  });

  // コンパイルエラー検証(ts-expect-error)が目的で、実行時の expect は不要
  // oxlint-disable-next-line vitest/expect-expect
  it("型に合わない演算子はコンパイルエラーになる", () => {
    const where: Where = {
      // @ts-expect-error: number プロパティに has 演算子は使えない
      views: { has: "x" },
    };
    void where;
  });

  // コンパイルエラー検証(ts-expect-error)が目的で、実行時の expect は不要
  // oxlint-disable-next-line vitest/expect-expect
  it("relation は演算子を持たないため where のキーに現れない", () => {
    const where: Where = {};
    // @ts-expect-error: relation は QueryableKeys から除外されている
    where.related = { equals: "x" };
    void where;
  });
});
