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
  buildCachedPost: () => buildCachedPost,
  getBlocks: () => getBlocks,
  getCachedImage: () => getCachedImage,
  getCachedPost: () => getCachedPost,
  getCachedPostList: () => getCachedPostList,
  getNotion: () => getNotion,
  getPostBySlug: () => getPostBySlug,
  getPostMarkdown: () => getPostMarkdown,
  getPosts: () => getPosts,
  setCachedImage: () => setCachedImage,
  setCachedPost: () => setCachedPost,
  setCachedPostList: () => setCachedPostList,
  sha256Hex: () => sha256Hex
});
module.exports = __toCommonJS(index_exports);

// src/cache.ts
var POSTS_KEY = "posts.json";
var postKey = (slug) => `post/${slug}.json`;
var imageKey = (hash) => `images/${hash}`;
async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function getCachedPostList(bucket) {
  const obj = await bucket.get(POSTS_KEY);
  if (!obj) return null;
  return obj.json();
}
async function setCachedPostList(bucket, posts) {
  const data = { posts, cachedAt: Date.now() };
  await bucket.put(POSTS_KEY, JSON.stringify(data), {
    httpMetadata: { contentType: "application/json" }
  });
}
async function getCachedPost(bucket, slug) {
  const obj = await bucket.get(postKey(slug));
  if (!obj) return null;
  return obj.json();
}
async function setCachedPost(bucket, slug, data) {
  await bucket.put(postKey(slug), JSON.stringify(data), {
    httpMetadata: { contentType: "application/json" }
  });
}
async function getCachedImage(bucket, hash) {
  return bucket.get(imageKey(hash));
}
async function setCachedImage(bucket, hash, data, contentType) {
  await bucket.put(imageKey(hash), data, {
    httpMetadata: { contentType }
  });
}

// src/content.ts
var import_marked = require("marked");

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

// src/content.ts
function inferContentType(url, responseContentType) {
  if (responseContentType?.startsWith("image/")) {
    return responseContentType.split(";")[0].trim();
  }
  if (url.includes(".png")) return "image/png";
  if (url.includes(".gif")) return "image/gif";
  if (url.includes(".webp")) return "image/webp";
  return "image/jpeg";
}
async function fetchAndCacheImage(bucket, notionUrl) {
  const hash = await sha256Hex(notionUrl);
  const existing = await getCachedImage(bucket, hash);
  if (existing) return hash;
  try {
    const response = await fetch(notionUrl, {
      signal: AbortSignal.timeout(1e4)
    });
    if (!response.ok) return hash;
    const data = await response.arrayBuffer();
    const contentType = inferContentType(
      notionUrl,
      response.headers.get("content-type")
    );
    await setCachedImage(bucket, hash, data, contentType);
  } catch (err) {
    console.error("Failed to cache image:", notionUrl, err);
  }
  return hash;
}
async function processMarkdownWithImages(bucket, markdown, imageBaseUrl) {
  const renderer = new import_marked.Renderer();
  renderer.image = ({ href, title, text }) => {
    const titleAttr = title ? ` title="${title}"` : "";
    return `<img data-notion-src="${href}" alt="${text}"${titleAttr}>`;
  };
  const rawHtml = await import_marked.marked.parse(markdown, { renderer, gfm: true });
  const srcPattern = /data-notion-src="([^"]+)"/g;
  if (!bucket) {
    return rawHtml.replace(srcPattern, (_, url) => `src="${url}"`);
  }
  const matches = [...rawHtml.matchAll(srcPattern)];
  const urlToHash = /* @__PURE__ */ new Map();
  await Promise.all(
    [...new Set(matches.map((m) => m[1]))].map(async (url) => {
      if (!url.startsWith("http")) return;
      const hash = await fetchAndCacheImage(bucket, url);
      urlToHash.set(url, hash);
    })
  );
  return rawHtml.replace(srcPattern, (_, url) => {
    const hash = urlToHash.get(url);
    if (hash) return `src="${imageBaseUrl}/${hash}"`;
    return `src="${url}"`;
  });
}
async function buildCachedPost(env, post, options = {}) {
  const imageBaseUrl = options.imageBaseUrl ?? "/api/images";
  const markdown = await getPostMarkdown(env, post.id);
  const html = await processMarkdownWithImages(
    env.CACHE_BUCKET,
    markdown,
    imageBaseUrl
  );
  return {
    html,
    post,
    notionLastEdited: post.lastEdited,
    cachedAt: Date.now()
  };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  buildCachedPost,
  getBlocks,
  getCachedImage,
  getCachedPost,
  getCachedPostList,
  getNotion,
  getPostBySlug,
  getPostMarkdown,
  getPosts,
  setCachedImage,
  setCachedPost,
  setCachedPostList,
  sha256Hex
});
