import { describe, expect, it } from "vitest";

import { getDocEntry, listDocEntries } from "../lib/markdown/load";

describe("markdown loader", () => {
  it("docs/ja 配下の md を 1 件以上ロードできる (glob パスが正しいことの保証)", () => {
    const entries = listDocEntries("ja");
    expect(entries.length).toBeGreaterThan(0);
  });

  it("quickstart は frontmatter とともに取得できる", () => {
    const entry = getDocEntry("ja", "quickstart");
    expect(entry).not.toBeNull();
    expect(entry?.frontmatter.title).toBe("クイックスタート");
    expect(entry?.frontmatter.category).toBe("はじめに");
    expect(entry?.frontmatter.order).toBe(1);
    expect(entry?.body).toContain("クイックスタート");
  });

  it("recipes 配下も階層構造で取得できる", () => {
    const entry = getDocEntry("ja", "recipes/cloudflare-workers");
    expect(entry).not.toBeNull();
    expect(entry?.frontmatter.category).toBe("レシピ");
  });

  it("category ごとに並び、order でソートされる", () => {
    const entries = listDocEntries("ja");
    const hajimeni = entries.filter((e) => e.frontmatter.category === "はじめに");
    const guide = entries.filter((e) => e.frontmatter.category === "ガイド");
    expect(hajimeni.length).toBeGreaterThan(0);
    expect(guide.length).toBeGreaterThan(0);
    // ガイド内が order 昇順
    for (let i = 1; i < guide.length; i++) {
      const prev = guide[i - 1]?.frontmatter.order ?? 100;
      const cur = guide[i]?.frontmatter.order ?? 100;
      expect(cur).toBeGreaterThanOrEqual(prev);
    }
  });
});
