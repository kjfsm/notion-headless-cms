import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
  route("/", "routes/home.tsx"),
  route("/posts/:slug", "routes/post.tsx"),
  // 画像プロキシ・更新検知(versions/check)・Webhook をまとめて cms.handler() に委譲。
  route("/api/cms/*", "routes/api.cms.ts"),
  route("/api/warm", "routes/warm.ts"),
] satisfies RouteConfig;
