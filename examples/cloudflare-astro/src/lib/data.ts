import type { makeCms } from "./cms.ts";

type CmsInstance = ReturnType<typeof makeCms>;

export async function getPosts(cms: CmsInstance) {
  return cms.posts.list();
}

export async function getPost(cms: CmsInstance, slug: string) {
  const post = await cms.posts.find(slug);
  if (!post) return null;
  const html = await post.html();
  return { post, html };
}
