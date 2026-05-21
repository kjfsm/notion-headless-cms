import { CMSError, isCMSError } from "@notion-headless-cms/core";
import { describe, expect, it } from "vitest";
import {
  validateCMSConfig,
  validateCreateClientOptions,
  validateNotionSourceConfig,
} from "../index";

const validAdapter = {
  collections: {
    posts: {
      source: { list: async () => [] },
      slugField: "slug",
    },
  },
};

describe("validateCreateClientOptions", () => {
  it("有効な設定はそのまま返す", () => {
    const opts = {
      sources: { notion: validAdapter },
      swr: { ttlMs: 60_000 },
      imageProxyBase: "/api/images",
      logLevel: "info" as const,
    };
    expect(validateCreateClientOptions(opts)).toBe(opts);
  });

  it("空 sources は許容するが、空アダプタはエラー", () => {
    // sources 自体が未指定なら createClient 側で別エラーになるので zod レベルでは通す
    expect(() => validateCreateClientOptions({})).not.toThrow();

    expect(() =>
      validateCreateClientOptions({
        sources: { notion: { collections: {} } },
      }),
    ).toThrowError(CMSError);
  });

  it("logLevel が不正な値だとエラー", () => {
    try {
      validateCreateClientOptions({
        sources: { notion: validAdapter },
        logLevel: "trace",
      });
      throw new Error("should have thrown");
    } catch (err) {
      expect(isCMSError(err)).toBe(true);
      if (isCMSError(err)) {
        expect(err.code).toBe("core/schema_invalid");
        expect(err.message).toContain("logLevel");
      }
    }
  });

  it("swr.ttlMs が負だとエラー", () => {
    expect(() =>
      validateCreateClientOptions({
        sources: { notion: validAdapter },
        swr: { ttlMs: -1 },
      }),
    ).toThrowError(CMSError);
  });

  it("rateLimiter.maxConcurrent は正整数のみ許容", () => {
    expect(() =>
      validateCreateClientOptions({
        sources: { notion: validAdapter },
        rateLimiter: { maxConcurrent: 0 },
      }),
    ).toThrowError(CMSError);
  });

  it("collection.slugField が空文字だとエラー", () => {
    expect(() =>
      validateCreateClientOptions({
        sources: {
          notion: {
            collections: {
              posts: { source: {}, slugField: "" },
            },
          },
        },
      }),
    ).toThrowError(CMSError);
  });
});

describe("validateNotionSourceConfig", () => {
  const validSchema = {
    posts: {
      dataSourceId: "db_id",
      slugField: "slug",
      properties: {},
    },
  };

  it("有効な設定はそのまま返す", () => {
    const opts = { schema: validSchema, token: "secret" };
    expect(validateNotionSourceConfig(opts)).toBe(opts);
  });

  it("token が空だとエラー", () => {
    expect(() =>
      validateNotionSourceConfig({ schema: validSchema, token: "" }),
    ).toThrowError(CMSError);
  });

  it("schema が空オブジェクトだとエラー", () => {
    expect(() =>
      validateNotionSourceConfig({ schema: {}, token: "secret" }),
    ).toThrowError(CMSError);
  });

  it("schema entry に dataSourceId が無いとエラー", () => {
    expect(() =>
      validateNotionSourceConfig({
        schema: { posts: { slugField: "slug", properties: {} } },
        token: "secret",
      }),
    ).toThrowError(CMSError);
  });
});

describe("validateCMSConfig", () => {
  it("有効な設定はそのまま返す", () => {
    const config = {
      output: "./generated/nhc.ts",
      collections: {
        posts: { databaseId: "abc" },
      },
    };
    expect(validateCMSConfig(config)).toBe(config);
  });

  it("output 未指定だとエラー", () => {
    expect(() =>
      validateCMSConfig({
        collections: { posts: { databaseId: "abc" } },
      }),
    ).toThrowError(CMSError);
  });

  it("collections が空だとエラー", () => {
    expect(() =>
      validateCMSConfig({
        output: "./out.ts",
        collections: {},
      }),
    ).toThrowError(CMSError);
  });

  it("collections[*] に databaseId / dbName のどちらも無いとエラー", () => {
    expect(() =>
      validateCMSConfig({
        output: "./out.ts",
        collections: { posts: { slugField: "slug" } },
      }),
    ).toThrowError(CMSError);
  });

  it("CMSError.code は core/schema_invalid", () => {
    try {
      validateCMSConfig({ collections: {} });
    } catch (err) {
      expect(isCMSError(err)).toBe(true);
      if (isCMSError(err)) {
        expect(err.code).toBe("core/schema_invalid");
      }
    }
  });
});
