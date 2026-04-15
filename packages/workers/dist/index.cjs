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
  buildCachedPost: () => import_notion_cache.buildCachedPost,
  getBlocks: () => import_notion_core.getBlocks,
  getCachedImage: () => import_notion_cache.getCachedImage,
  getCachedPost: () => import_notion_cache.getCachedPost,
  getCachedPostList: () => import_notion_cache.getCachedPostList,
  getNotion: () => import_notion_core.getNotion,
  getPostBySlug: () => import_notion_core.getPostBySlug,
  getPostMarkdown: () => import_notion_core.getPostMarkdown,
  getPosts: () => import_notion_core.getPosts,
  setCachedImage: () => import_notion_cache.setCachedImage,
  setCachedPost: () => import_notion_cache.setCachedPost,
  setCachedPostList: () => import_notion_cache.setCachedPostList,
  sha256Hex: () => import_notion_cache.sha256Hex
});
module.exports = __toCommonJS(index_exports);
var import_notion_core = require("@kjfsm/notion-core");
var import_notion_cache = require("@kjfsm/notion-cache");
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
