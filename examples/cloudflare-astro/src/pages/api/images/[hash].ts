import { env } from "cloudflare:workers";
import type { APIRoute } from "astro";
import { createCMS } from "../../../lib/cms";

export const GET: APIRoute = async ({ params }) => {
	const cms = createCMS(env as unknown as Parameters<typeof createCMS>[0]);
	const response = await cms.createCachedImageResponse(params.hash!);
	return response ?? new Response("Not Found", { status: 404 });
};
