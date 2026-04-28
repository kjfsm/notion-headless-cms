import { error } from "@sveltejs/kit";
import { makeCms } from "$lib/cms";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ platform }) => {
  if (!platform) {
    error(500, "Platform not found");
  }
  const cms = makeCms(platform.env);
  const items = await cms.posts.list();
  return { items };
};
