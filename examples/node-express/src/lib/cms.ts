import { createNodeCMS } from "@notion-headless-cms/adapter-node";
import { nhcDataSources, type PostsItem } from "../generated/nhc-schema.js";

export const cms = createNodeCMS({
	dataSources: nhcDataSources,
	cache: {
		document: "memory",
		image: "memory",
		ttlMs: 5 * 60_000,
	},
});

export type BlogPost = PostsItem;
