import { describe, expect, it } from "vitest";
import {
  CMSError,
  isCMSError,
  isCMSErrorInNamespace,
  matchCMSError,
} from "../errors.js";
import { defineCollection } from "../types/collection.js";
import { prop } from "../types/property.js";

describe("CMSError", () => {
  it("code と context を保持する", () => {
    const err = new CMSError({
      code: "schema/invalid_property",
      message: "test",
      context: { operation: "test" },
    });
    expect(err.is("schema/invalid_property")).toBe(true);
    expect(err.inNamespace("schema/")).toBe(true);
    expect(isCMSError(err)).toBe(true);
    expect(isCMSErrorInNamespace(err, "query/")).toBe(false);
  });

  it("matchCMSError でコードごとに分岐できる", () => {
    const err = new CMSError({
      code: "schema/status_property_required",
      message: "test",
      context: { operation: "test" },
    });
    const result = matchCMSError(err, {
      "schema/status_property_required": () => "handled",
      _: () => "fallback",
    });
    expect(result).toBe("handled");
  });

  it("published/accessible 指定時に statusProperty がなければ CMSError を投げる", () => {
    expect(() =>
      defineCollection({
        dataSourceId: "ds",
        slug: "slug",
        properties: { slug: prop.richText() },
        published: ["published"] as never,
      }),
    ).toThrow(CMSError);
  });

  it("statusProperty が status 型でなければ CMSError を投げる", () => {
    expect(() =>
      defineCollection({
        dataSourceId: "ds",
        slug: "slug",
        properties: {
          slug: prop.richText(),
          status: prop.select(["a"] as const),
        },
        statusProperty: "status" as never,
        published: ["a"] as never,
      }),
    ).toThrow(CMSError);
  });
});
