import { describe, expect, it, vi } from "vitest";
import { defineCollection } from "../types/config";
import type { BaseContentItem } from "../types/content";
import type { DataSource } from "../types/data-source";

// Issue #314 (M3): defineCollection<T>() で slugField / statusField が keyof T で
// 型ガードされ、誤フィールド名 (例: "slag") は **型エラー** になることを保証する。
// 型レベルの assertion なので、本ファイルは「型エラーが出ない構成 = 正しい」ことを示す。

interface PostItem extends BaseContentItem {
  authorName?: string | null;
}

function makeSource(): DataSource<PostItem> {
  return {
    name: "fake",
    list: vi.fn().mockResolvedValue([]),
    loadBlocks: vi.fn().mockResolvedValue([]),
    loadMarkdown: vi.fn().mockResolvedValue(""),
    getLastModified: (item) => item.lastEditedTime,
    getListVersion: () => "",
  };
}

describe("defineCollection (Issue #314 / M3)", () => {
  it("正しいフィールド名で受理する", () => {
    const def = defineCollection<PostItem>({
      source: makeSource(),
      slugField: "slug",
      statusField: "status",
    });
    expect(def.slugField).toBe("slug");
    expect(def.statusField).toBe("status");
  });

  it("@ts-expect-error: 存在しない slugField はコンパイルエラー", () => {
    defineCollection<PostItem>({
      source: makeSource(),
      // @ts-expect-error - "slag" は keyof PostItem に存在しない
      slugField: "slag",
    });
  });

  it("@ts-expect-error: 存在しない statusField はコンパイルエラー", () => {
    defineCollection<PostItem>({
      source: makeSource(),
      slugField: "slug",
      // @ts-expect-error - "stat" は keyof PostItem に存在しない
      statusField: "stat",
    });
  });

  it("authorName のような T 固有フィールドも slugField として受理する", () => {
    const def = defineCollection<PostItem>({
      source: makeSource(),
      slugField: "authorName",
    });
    expect(def.slugField).toBe("authorName");
  });
});
