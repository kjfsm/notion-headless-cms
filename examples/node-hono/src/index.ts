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
	const [html, markdown] = await Promise.all([
		post.content.html(),
		post.content.markdown(),
	]);
	return c.json({
		item: { id: post.id, slug: post.slug, status: post.status },
		blocks: post.content.blocks,
		html,
		markdown,
	});
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
