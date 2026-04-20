import type { RequestHandler } from "./$types";
import { createCMS } from "$lib/cms";

export const GET: RequestHandler = async ({ params, platform }) => {
	const cms = createCMS(platform!.env);
	const response = await cms.createCachedImageResponse(params.hash);
	return response ?? new Response("Not Found", { status: 404 });
};
