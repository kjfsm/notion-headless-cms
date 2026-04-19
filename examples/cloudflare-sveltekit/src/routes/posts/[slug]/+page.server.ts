import { error } from "@sveltejs/kit";
import type { PageServerLoad } from "./$types";
import { createCMS } from "$lib/cms";

export const load: PageServerLoad = async ({ params, platform }) => {
	const cms = createCMS(platform!.env);
	const entry = await cms.getItemBySlug(params.slug);
	if (!entry) error(404, "Not Found");
	return entry;
};
