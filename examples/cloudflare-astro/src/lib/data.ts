import { renderBlocksToHtml } from "@notion-headless-cms/cms/html";
import { ensureSynced, type makeCms } from "./cms.js";

type CmsInstance = ReturnType<typeof makeCms>;

export async function getPosts(cms: CmsInstance) {
  await ensureSynced(cms);
  return cms.posts.list();
}

export async function getPost(cms: CmsInstance, slug: string) {
  await ensureSynced(cms);
  const post = await cms.posts.find(slug);
  if (!post) return null;
  const html = renderBlocksToHtml(post.blocks, { links: post.links });
  return { post, html };
}
