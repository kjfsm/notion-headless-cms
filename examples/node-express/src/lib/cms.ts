import { createCMS, nodePreset } from "@notion-headless-cms/core";
import { nhcDataSources, type PostsItem } from "../generated/nhc-schema.js";

export const cms = createCMS({
	...nodePreset({ ttlMs: 5 * 60_000 }),
	dataSources: nhcDataSources,
});

export type BlogPost = PostsItem;
