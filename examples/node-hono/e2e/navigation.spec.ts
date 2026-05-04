import { expect, test } from "@playwright/test";

test("サーバーが起動して一覧ページが表示される", async ({ page }) => {
  const response = await page.goto("/ui/posts");
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toContainText("記事一覧");
});

test("詳細ページに遷移できる", async ({ page }) => {
  await page.goto("/ui/posts");
  const firstLink = page.locator("a[href*='/posts/']").first();
  if ((await firstLink.count()) === 0) {
    test.skip();
    return;
  }
  await firstLink.click();
  await expect(page.locator("article")).toBeVisible();
  expect(page.url()).toContain("/posts/");
});
