import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { createCMS } from "../../../lib/cms";

export const GET: APIRoute = async ({ params }) => {
	const cms = createCMS(env as unknown as Parameters<typeof createCMS>[0]);
	if (!params.hash) return new Response("Not Found", { status: 404 });
	const object = await cms.$getCachedImage(params.hash);
	if (!object) return new Response("Not Found", { status: 404 });
	return new Response(object.data, {
		headers: {
			"content-type": object.contentType ?? "application/octet-stream",
			"cache-control": "public, max-age=31536000, immutable",
		},
	});
};
