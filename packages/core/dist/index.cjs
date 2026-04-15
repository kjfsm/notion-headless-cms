"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  getBlocks: () => getBlocks,
  getNotion: () => getNotion,
  getPostBySlug: () => getPostBySlug,
  getPostMarkdown: () => getPostMarkdown,
  getPosts: () => getPosts
});
module.exports = __toCommonJS(index_exports);

// src/notion.ts
var import_client = require("@notionhq/client");
var import_notion_to_md = require("notion-to-md");
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
  return new import_client.Client({ auth: env.NOTION_TOKEN });
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
  const n2m = new import_notion_to_md.NotionConverter(notion);
  const result = await n2m.convert(pageId);
  return result.content;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  getBlocks,
  getNotion,
  getPostBySlug,
  getPostMarkdown,
  getPosts
});
