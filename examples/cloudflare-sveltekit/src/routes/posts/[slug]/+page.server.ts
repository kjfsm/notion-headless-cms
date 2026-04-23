import { error } from "@sveltejs/kit";
import { createCMS } from "$lib/cms";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, platform }) => {
	if (!params.slug) {
		error(404, "Not Found");
	}
	if (!platform) {
		error(500, "Platform not found");
	}
	const cms = createCMS(platform.env);
	const post = await cms.posts.getItem(params.slug);
	if (!post) error(404, "Not Found");
	const html = await post.content.html();
	return { html, item: post };
};
