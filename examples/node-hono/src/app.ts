import { Hono } from "hono";
import { cms } from "./lib/cms.js";

export const app = new Hono();

app.get("/posts", async (c) => {
	const items = await cms.posts.list();
	return c.json({ items });
});

app.get("/posts/:slug", async (c) => {
	const post = await cms.posts.get(c.req.param("slug"));
	if (!post) return c.json({ error: "Not Found" }, 404);
	const [html, markdown] = await Promise.all([
		post.render(),
		post.render({ format: "markdown" }),
	]);
	return c.json({
		item: { id: post.id, slug: post.slug, status: post.status },
		html,
		markdown,
	});
});

app.get("/posts/:slug/adjacent", async (c) => {
	const { prev, next } = await cms.posts.cache.adjacent(c.req.param("slug"));
	return c.json({ prev, next });
});

const handler = cms.$handler({ basePath: "/api/cms" });
app.all("/api/cms/*", (c) => handler(c.req.raw));

app.get("/", (c) => c.json({ ok: true, collections: cms.$collections }));
