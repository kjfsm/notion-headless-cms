import { renderBlocksToHtml } from "@notion-headless-cms/cms/html";
import { Hono } from "hono";

import type { Env } from "../lib/cms.js";
import { makeCms } from "../lib/cms.js";

const posts = new Hono<{ Bindings: Env }>();

posts.get("/", async (c) => {
  const cms = makeCms(c.env, c.executionCtx);
  const { items } = await cms.posts.list();
  return c.json({ items });
});

posts.get("/:slug", async (c) => {
  const cms = makeCms(c.env, c.executionCtx);
  const slug = c.req.param("slug");
  const post = await cms.posts.find(slug);
  if (!post) return c.json({ error: "Not Found" }, 404);
  const html = renderBlocksToHtml(post.blocks, { links: post.links });
  return c.json({
    html,
    item: { id: post.meta.id, slug: post.slug, status: post.meta.status },
  });
});

export default posts;
