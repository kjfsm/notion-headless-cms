import { type RouteConfig, route } from "@react-router/dev/routes";

export default [
	route("/", "routes/home.tsx"),
	route("/posts/:slug", "routes/post.tsx"),
	route("/api/images/:hash", "routes/images.ts"),
	route("/api/posts", "routes/api.posts.ts"),
	route("/api/posts/:slug", "routes/api.post.$slug.ts"),
] satisfies RouteConfig;
