import { describe, expect, it } from "vitest";

import { defineCollection } from "../../types/collection.js";
import { prop } from "../../types/property.js";
import { decidePublication } from "../publication-policy.js";

const posts = defineCollection({
  dataSourceId: "ds1",
  slug: "slug",
  properties: {
    slug: prop.richText(),
    status: prop.status(["draft", "unlisted", "published"] as const),
  },
  statusProperty: "status",
  published: ["published"],
  accessible: ["unlisted", "published"],
});

describe("decidePublication", () => {
  it("published の値は accessible かつ listed", () => {
    expect(decidePublication(posts, "published")).toEqual({
      accessible: true,
      listed: true,
    });
  });

  it("accessible だが published にない値は限定公開(accessible: true, listed: false)", () => {
    expect(decidePublication(posts, "unlisted")).toEqual({
      accessible: true,
      listed: false,
    });
  });

  it("どちらにも無い値(下書き)は accessible/listed ともに false", () => {
    expect(decidePublication(posts, "draft")).toEqual({
      accessible: false,
      listed: false,
    });
  });

  it("値が undefined は accessible/listed ともに false", () => {
    expect(decidePublication(posts, undefined)).toEqual({
      accessible: false,
      listed: false,
    });
  });

  it("statusProperty 未指定のコレクションは常に公開", () => {
    const noPolicy = defineCollection({
      dataSourceId: "ds2",
      slug: "slug",
      properties: { slug: prop.richText() },
    });
    expect(decidePublication(noPolicy, undefined)).toEqual({
      accessible: true,
      listed: true,
    });
  });

  it("accessible 未指定なら published と同じ集合にフォールバックする", () => {
    const publishedOnly = defineCollection({
      dataSourceId: "ds3",
      slug: "slug",
      properties: {
        slug: prop.richText(),
        status: prop.status(["draft", "published"] as const),
      },
      statusProperty: "status",
      published: ["published"],
    });
    expect(decidePublication(publishedOnly, "published")).toEqual({
      accessible: true,
      listed: true,
    });
    expect(decidePublication(publishedOnly, "draft")).toEqual({
      accessible: false,
      listed: false,
    });
  });
});
