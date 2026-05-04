import fs from "node:fs";
import { test } from "@playwright/test";

test.beforeAll(() => {
  fs.mkdirSync("screenshots", { recursive: true });
});

// node-express は JSON API サーバーのため、ブラウザ上の JSON レスポンスをキャプチャする
test("投稿一覧 API", async ({ page }) => {
  await page.goto("/posts");
  await page.screenshot({ path: "screenshots/posts.png", fullPage: true });
});
