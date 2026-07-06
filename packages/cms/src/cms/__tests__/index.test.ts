import { describe, expect, it } from "vitest";
import { createCMS, createContentCMS } from "../index.js";

describe("createContentCMS", () => {
  it("createCMS(v3)の別名であり、同一の関数を指す", () => {
    // @notion-headless-cms/client(v2)にも引数・戻り値が別物の同名 createCMS が
    // 存在するため、import 元を明示的に区別したい利用者向けの別名(README 参照)。
    expect(createContentCMS).toBe(createCMS);
  });
});
