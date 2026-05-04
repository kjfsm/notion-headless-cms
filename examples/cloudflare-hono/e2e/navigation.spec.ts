import { expect, test } from "@playwright/test";

test("サーバーが起動して投稿一覧APIが200を返す", async ({ request }) => {
  const response = await request.get("/posts");
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toHaveProperty("items");
  expect(Array.isArray(body.items)).toBe(true);
});

test("投稿詳細APIが200を返す", async ({ request }) => {
  const listResponse = await request.get("/posts");
  const { items } = await listResponse.json();
  if (items.length === 0) {
    test.skip();
    return;
  }
  const slug = items[0].slug as string;
  const response = await request.get(`/posts/${slug}`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toHaveProperty("item");
  expect(body).toHaveProperty("html");
});
