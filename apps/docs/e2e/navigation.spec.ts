import { expect, test } from "@playwright/test";

test("ランディング (/) が表示される", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  // home ページが Notion から取得できない環境では /docs にリダイレクト
  // どちらでも 200 になるが、本文要素は存在するはず。
  await expect(page.locator("main, article")).toBeVisible();
});

test("ドキュメント一覧 (/docs) が表示される", async ({ page }) => {
  const response = await page.goto("/docs");
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toContainText("ドキュメント");
});

test("クイックスタート (/docs/ja/quickstart) が表示される", async ({ page }) => {
  const response = await page.goto("/docs/ja/quickstart");
  expect(response?.status()).toBe(200);
  await expect(page.locator("article h1")).toBeVisible();
});

test("存在しない md パスは 404", async ({ page }) => {
  const response = await page.goto("/docs/ja/does-not-exist");
  expect(response?.status()).toBe(404);
});
