import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
  route("/", "routes/home.tsx"),
  route("/posts/:slug", "routes/post.tsx"),
  route("/api/images/:hash", "routes/images.ts"),
  route("/api/posts/:slug/check", "routes/check.ts"),
  route("/api/warm", "routes/warm.ts"),
] satisfies RouteConfig;
