import { Hono } from "hono";
import type { Env } from "../lib/cms";
import { createCMS } from "../lib/cms";

const posts = new Hono<{ Bindings: Env }>();

posts.get("/", async (c) => {
	const cms = createCMS(c.env);
	const { items } = await cms.cached.list();
	return c.json({ items });
});

posts.get("/:slug", async (c) => {
	const cms = createCMS(c.env);
	const slug = c.req.param("slug");
	const entry = await cms.cached.get(slug);
	if (!entry) return c.json({ error: "Not Found" }, 404);
	return c.json({ html: entry.html, item: entry.item });
});

export default posts;
