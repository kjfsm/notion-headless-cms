import { Hono } from "hono";

import { type Env, makeCms } from "./lib/cms.js";
import posts from "./routes/posts.js";

export { SyncCoordinatorDO } from "./lib/do.js";

const app = new Hono<{ Bindings: Env }>();

app.route("/posts", posts);

// 手動 kick 用のメンテナンスエンドポイント（初回コールドスタート時や動作確認用）。
// 本来は Notion webhook（/api/cms/webhook 経由）が SyncCoordinatorDO を起動する。
app.post("/api/sync/kick", (c) => {
  const cms = makeCms(c.env, c.executionCtx);
  c.executionCtx.waitUntil(cms.sync.kick());
  return c.json({ ok: true });
});

// 画像プロキシ・webhook・OGP を cms.fetch() 1 つにまとめて配信する。
app.all("/api/cms/*", (c) => makeCms(c.env, c.executionCtx).fetch(c.req.raw));

export default app;
