import { createCMS } from "$lib/cms";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ platform }) => {
	const cms = createCMS(platform!.env);
	const { items } = await cms.cache.getList();
	return { items };
};
