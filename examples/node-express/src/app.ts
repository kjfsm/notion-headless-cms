import { renderBlocksToHtml } from "@notion-headless-cms/cms/html";
import express from "express";

import { cms } from "./lib/cms.js";
import { sendWebResponse, toWebRequest } from "./lib/web-adapter.js";

export const app = express();

app.get("/posts", async (_req, res) => {
  const { items } = await cms.posts.list();
  res.json({ items });
});

app.get("/posts/:slug", async (req, res) => {
  const post = await cms.posts.find(req.params.slug);
  if (!post) {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  const html = renderBlocksToHtml(post.blocks, { links: post.links });
  res.json({
    html,
    item: { id: post.meta.id, slug: post.slug, status: post.meta.status },
  });
});

// images/webhook/ogp/realtime/preview を cms.fetch() に一括委譲する
// （v2 は画像プロキシだけ手動ルートで個別実装していた）。
app.all("/api/cms/*splat", async (req, res) => {
  const webResponse = await cms.fetch(toWebRequest(req));
  await sendWebResponse(res, webResponse);
});
