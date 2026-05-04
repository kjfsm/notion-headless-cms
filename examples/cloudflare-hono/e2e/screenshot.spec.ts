import fs from "node:fs";
import { test } from "@playwright/test";

test.beforeAll(() => {
  fs.mkdirSync("screenshots", { recursive: true });
});

test("トップページ", async ({ page }) => {
  await page.goto("/ui");
  await page.screenshot({ path: "screenshots/top.png", fullPage: true });
});

test("ブログ一覧", async ({ page }) => {
  await page.goto("/ui/posts");
  await page.screenshot({ path: "screenshots/posts.png", fullPage: true });
});

test("ブログプレビュー（記事詳細）", async ({ page }) => {
  await page.goto("/ui/posts");
  const firstPost = page.locator("a[href*='/posts/']").first();
  if ((await firstPost.count()) === 0) {
    test.skip();
    return;
  }
  await firstPost.click();
  await page.screenshot({
    path: "screenshots/post-detail.png",
    fullPage: true,
  });
});
