import { Hono } from "hono";
import type { Env } from "./lib/cms";
import images from "./routes/images";
import posts from "./routes/posts";

const app = new Hono<{ Bindings: Env }>();

app.route("/posts", posts);
app.route("/api/images", images);

export default app;
