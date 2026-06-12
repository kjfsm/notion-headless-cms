import { Hono } from "hono";
import { type Env, makeCms } from "./lib/cms";
import posts from "./routes/posts";

const app = new Hono<{ Bindings: Env }>();

app.route("/posts", posts);

// 画像プロキシ(/api/cms/images/:hash)・更新検知(versions/check)・Webhook revalidate を
// cms.handler() 1 つにまとめて配信する。
app.all("/api/cms/*", (c) =>
  makeCms(c.env, c.executionCtx).handler()(c.req.raw),
);

export default app;
