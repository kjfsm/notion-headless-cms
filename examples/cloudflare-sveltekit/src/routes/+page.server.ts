import { error } from "@sveltejs/kit";
import { createCMS } from "$lib/cms";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ platform }) => {
	if (!platform) {
		error(500, "Platform not found");
	}
	const cms = createCMS(platform.env);
	const items = await cms.posts.getList();
	return { items };
};
