import type { PageServerLoad } from "./$types";
import { createCMS } from "$lib/cms";

export const load: PageServerLoad = async ({ platform }) => {
	const cms = createCMS(platform!.env);
	const { items } = await cms.cached.list();
	return { items };
};
