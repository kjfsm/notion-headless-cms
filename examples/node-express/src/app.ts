import express from "express";
import { cms } from "./lib/cms.js";

export const app = express();

app.get("/posts", async (_req, res) => {
  const items = await cms.posts.list();
  res.json({ items });
});

app.get("/posts/:slug", async (req, res) => {
  const post = await cms.posts.find(req.params.slug);
  if (!post) {
    res.status(404).json({ error: "Not Found" });
    return;
  }
  const html = await post.html();
  res.json({ html, item: post });
});

app.get("/api/images/:hash", async (req, res) => {
  const binary = await cms.$getCachedImage(req.params.hash);
  if (!binary) {
    res.status(404).send("Not Found");
    return;
  }
  res.set("Content-Type", binary.contentType ?? "application/octet-stream");
  res.set("Cache-Control", "public, max-age=31536000, immutable");
  res.send(Buffer.from(binary.data));
});
