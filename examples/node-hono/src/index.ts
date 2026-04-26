import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cms } from "./lib/cms.js";

const app = new Hono();

/**
 * 一覧: 本文なし (getList)
 * GET /posts
 */
app.get("/posts", async (c) => {
	const items = await cms.posts.getList();
	return c.json({ items });
});

/**
 * 単件 + 本文 blocks + 遅延 html (getItem)
 * GET /posts/:slug
 */
app.get("/posts/:slug", async (c) => {
	const post = await cms.posts.getItem(c.req.param("slug"));
	if (!post) return c.json({ error: "Not Found" }, 404);
	const [html, markdown, blocks] = await Promise.all([
		post.content.html(),
		post.content.markdown(),
		post.content.blocks(),
	]);
	return c.json({
		item: { id: post.id, slug: post.slug, status: post.status },
		blocks,
		html,
		markdown,
	});
});

/**
 * useSWR fetcher 向け: メタデータのみ
 * GET /posts/:slug/meta
 */
app.get("/posts/:slug/meta", async (c) => {
	const meta = await cms.posts.getItemMeta(c.req.param("slug"));
	if (!meta) return c.json({ error: "Not Found" }, 404);
	return c.json(meta);
});

/**
 * useSWR fetcher 向け: 本文ペイロード
 * GET /posts/:slug/content
 */
app.get("/posts/:slug/content", async (c) => {
	const content = await cms.posts.getItemContent(c.req.param("slug"));
	if (!content) return c.json({ error: "Not Found" }, 404);
	return c.json(content);
});

/**
 * useSWR の再検証トリガ向け: 差分判定（メタのみ）
 * GET /posts/:slug/check?since=...
 */
app.get("/posts/:slug/check", async (c) => {
	const since = c.req.query("since");
	if (!since) return c.json({ error: "since required" }, 400);
	const result = await cms.posts.checkForUpdate({
		slug: c.req.param("slug"),
		since,
	});
	return c.json(result);
});

/**
 * 前後記事のナビゲーション
 * GET /posts/:slug/adjacent
 */
app.get("/posts/:slug/adjacent", async (c) => {
	const { prev, next } = await cms.posts.adjacent(c.req.param("slug"));
	return c.json({ prev, next });
});

/**
 * $handler をそのまま `/api/cms/*` にマウント (画像プロキシ / revalidate)
 *   - GET  /api/cms/images/:hash  → 画像プロキシ
 *   - POST /api/cms/revalidate    → Webhook
 */
const handler = cms.$handler({ basePath: "/api/cms" });
app.all("/api/cms/*", (c) => handler(c.req.raw));

/**
 * ヘルスチェック
 */
app.get("/", (c) => c.json({ ok: true, collections: cms.$collections }));

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port });
console.log(`Server running at http://localhost:${port}`);
