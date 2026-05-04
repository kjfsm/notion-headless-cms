import fs from "node:fs";
import { test } from "@playwright/test";

test.beforeAll(() => {
  fs.mkdirSync("screenshots", { recursive: true });
});

test("トップページ（ブログ一覧）", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: "screenshots/top.png", fullPage: true });
});

test("ブログプレビュー（記事詳細）", async ({ page }) => {
  await page.goto("/");
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
