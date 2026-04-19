import { route, type RouteConfig } from "@react-router/dev/routes";

export default [
	route("/", "routes/home.tsx"),
	route("/posts/:slug", "routes/post.tsx"),
	route("/api/images/:hash", "routes/images.ts"),
] satisfies RouteConfig;
