import { error } from "@sveltejs/kit";
import { makeCms } from "$lib/cms";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ params, platform }) => {
  if (!params.slug) {
    error(404, "Not Found");
  }
  if (!platform) {
    error(500, "Platform not found");
  }
  const cms = makeCms(platform.env);
  const post = await cms.posts.get(params.slug);
  if (!post) error(404, "Not Found");
  const html = await post.render();
  return { html, item: post };
};
