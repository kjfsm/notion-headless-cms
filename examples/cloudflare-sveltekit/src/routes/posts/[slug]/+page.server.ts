import { error } from "@sveltejs/kit";
import { createCMS } from "$lib/cms";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, platform }) => {
	const cms = createCMS(platform!.env);
	const entry = await cms.cached.get(params.slug);
	if (!entry) error(404, "Not Found");
	return entry;
};
