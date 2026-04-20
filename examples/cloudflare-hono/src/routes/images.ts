import { Hono } from "hono";
import type { Env } from "../lib/cms";
import { createCMS } from "../lib/cms";

const images = new Hono<{ Bindings: Env }>();

images.get("/:hash", async (c) => {
	const cms = createCMS(c.env);
	const hash = c.req.param("hash");
	const response = await cms.createCachedImageResponse(hash);
	return response ?? c.notFound();
});

export default images;
