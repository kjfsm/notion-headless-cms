import fs from "node:fs";
import { test } from "@playwright/test";

test.beforeAll(() => {
  fs.mkdirSync("screenshots", { recursive: true });
});

test("ランディングページ", async ({ page }) => {
  await page.goto("/");
  await page.screenshot({ path: "screenshots/landing.png", fullPage: true });
});

test("ドキュメント一覧", async ({ page }) => {
  await page.goto("/docs");
  await page.screenshot({ path: "screenshots/docs-index.png", fullPage: true });
});

test("ドキュメント詳細（クイックスタート）", async ({ page }) => {
  await page.goto("/docs/ja/quickstart");
  await page.screenshot({
    path: "screenshots/docs-quickstart.png",
    fullPage: true,
  });
});
