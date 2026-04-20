import type { APIRoute } from "astro";
import { createCMS } from "../../../lib/cms";

export const GET: APIRoute = async ({ params, locals }) => {
	const cms = createCMS(locals.runtime.env);
	const response = await cms.createCachedImageResponse(params.hash!);
	return response ?? new Response("Not Found", { status: 404 });
};
