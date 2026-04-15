// src/notion.ts
import { Client } from "@notionhq/client";
import { NotionConverter } from "notion-to-md";
function getPlainText(items) {
  return items?.map((item) => item.plain_text).join("") ?? "";
}
function getAuthor(page) {
  const authorProperty = page.properties.Author;
  if (authorProperty?.select?.name) return authorProperty.select.name;
  return getPlainText(authorProperty?.rich_text);
}
function mapPost(page) {
  const statusProperty = page.properties.Status;
  const createdAtProperty = page.properties.CreatedAt;
  return {
    id: page.id,
    title: getPlainText(
      page.properties.Title?.title
    ),
    slug: getPlainText(
      page.properties.Slug?.rich_text
    ),
    status: statusProperty?.status?.name ?? statusProperty?.select?.name ?? "\u4E0B\u66F8\u304D",
    createdAt: createdAtProperty?.date?.start ?? page.created_time,
    author: getAuthor(page),
    lastEdited: page.last_edited_time
  };
}
function getNotion(env) {
  return new Client({ auth: env.NOTION_TOKEN });
}
async function getPosts(env) {
  if (!env.NOTION_TOKEN || !env.NOTION_DATA_SOURCE_ID) return [];
  const notion = getNotion(env);
  try {
    const res = await notion.dataSources.query({
      data_source_id: env.NOTION_DATA_SOURCE_ID
    });
    return res.results.map((page) => mapPost(page)).filter((post) => post.status === "\u516C\u958B\u6E08\u307F").sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}
async function getPostBySlug(env, slug) {
  if (!env.NOTION_TOKEN || !env.NOTION_DATA_SOURCE_ID) return null;
  const notion = getNotion(env);
  try {
    const res = await notion.dataSources.query({
      data_source_id: env.NOTION_DATA_SOURCE_ID,
      filter: {
        property: "Slug",
        rich_text: {
          equals: slug
        }
      }
    });
    const page = res.results[0];
    if (!page) return null;
    const post = mapPost(page);
    if (post.status !== "\u516C\u958B\u6E08\u307F") return null;
    return post;
  } catch {
    return null;
  }
}
async function getBlocks(env, pageId) {
  const notion = getNotion(env);
  const res = await notion.blocks.children.list({
    block_id: pageId
  });
  return res.results;
}
async function getPostMarkdown(env, pageId) {
  const notion = getNotion(env);
  const n2m = new NotionConverter(notion);
  const result = await n2m.convert(pageId);
  return result.content;
}
export {
  getBlocks,
  getNotion,
  getPostBySlug,
  getPostMarkdown,
  getPosts
};
