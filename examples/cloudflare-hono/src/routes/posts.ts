import { Hono } from "hono";
import type { Env } from "../lib/cms";
import { makeCms } from "../lib/cms";

const posts = new Hono<{ Bindings: Env }>();

posts.get("/", async (c) => {
  const cms = makeCms(c.env);
  const items = await cms.posts.list();
  return c.json({ items });
});

posts.get("/:slug", async (c) => {
  const cms = makeCms(c.env);
  const slug = c.req.param("slug");
  const post = await cms.posts.get(slug);
  if (!post) return c.json({ error: "Not Found" }, 404);
  const html = await post.html();
  return c.json({ html, item: post });
});

export default posts;
