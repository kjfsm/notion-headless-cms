import { Hono } from "hono";
import type { Env } from "../lib/cms";
import { createCMS } from "../lib/cms";

const images = new Hono<{ Bindings: Env }>();

images.get("/:hash", async (c) => {
	const cms = createCMS(c.env);
	const hash = c.req.param("hash");
	const object = await cms.$getCachedImage(hash);
	if (!object) return c.notFound();
	return new Response(object.data, {
		headers: {
			"content-type": object.contentType ?? "application/octet-stream",
			"cache-control": "public, max-age=31536000, immutable",
		},
	});
});

export default images;
