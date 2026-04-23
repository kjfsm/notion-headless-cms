import { error } from "@sveltejs/kit";
import { createCMS } from "$lib/cms";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params, platform }) => {
	if (!platform) {
		error(500, "Platform not found");
	}
	const cms = createCMS(platform?.env);
	const object = await cms.$getCachedImage(params.hash);
	if (!object) return new Response("Not Found", { status: 404 });
	return new Response(object.data, {
		headers: {
			"content-type": object.contentType ?? "application/octet-stream",
			"cache-control": "public, max-age=31536000, immutable",
		},
	});
};
