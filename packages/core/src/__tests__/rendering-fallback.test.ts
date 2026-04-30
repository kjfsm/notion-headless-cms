/**
 * renderer フォールバックの失敗パスを独立してテストする。
 * vi.mock はファイル先頭にホイストされるため、このファイルを分離することで
 * 他テストへのモジュール ID 汚染を防いでいる。
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@notion-headless-cms/renderer", () => {
  throw new Error("renderer package not installed");
});

import { isCMSError } from "../errors";
import type { RenderContext } from "../rendering";
import { buildCachedItemContent } from "../rendering";
import type { BaseContentItem } from "../types/index";

function makeItem(): BaseContentItem {
  return {
    id: "page-1",
    slug: "test-post",
    lastEditedTime: "2024-01-01T00:00:00Z",
  };
}

function makeContext(
  overrides: Partial<RenderContext<BaseContentItem>> = {},
): RenderContext<BaseContentItem> {
  return {
    source: {
      name: "mock",
      async list() {
        return [];
      },
      async loadMarkdown() {
        return "# Hello";
      },
      async loadBlocks() {
        return [];
      },
      getLastModified(item) {
        return item.lastEditedTime;
      },
      getListVersion() {
        return "";
      },
    },
    rendererFn: undefined,
    imgCache: {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
    },
    imgCacheName: "test",
    hasImageCache: false,
    imageProxyBase: "/api/images",
    contentConfig: undefined,
    hooks: {},
    logger: undefined,
    ...overrides,
  };
}

describe("loadDefaultRenderer — import 失敗時のフォールバック", () => {
  it("@notion-headless-cms/renderer の import が失敗すると core/config_invalid CMSError をスローする", async () => {
    const item = makeItem();
    const ctx = makeContext({ rendererFn: undefined });
    await expect(buildCachedItemContent(item, ctx)).rejects.toSatisfy(
      (err: unknown) => isCMSError(err) && err.code === "core/config_invalid",
    );
  });
});
