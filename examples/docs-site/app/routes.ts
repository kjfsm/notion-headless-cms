import { type RouteConfig, layout, route } from "@react-router/dev/routes";

export default [
  route("/", "routes/index.tsx"),
  layout("routes/docs/_layout.tsx", [
    route("/docs/:slug", "routes/docs/$slug.tsx"),
  ]),
  route("/:slug", "routes/$slug.tsx"),
  route("/api/images/:hash", "routes/api/images/$hash.ts"),
  route("/api/warm", "routes/api/warm.ts"),
  route("/api/docs/:slug/check", "routes/api/docs/$slug/check.ts"),
] satisfies RouteConfig;
