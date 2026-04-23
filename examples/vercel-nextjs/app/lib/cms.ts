import { nextCache } from "@notion-headless-cms/cache-next";
import { createCMS, memoryImageCache } from "@notion-headless-cms/core";
import { renderMarkdown } from "@notion-headless-cms/renderer";
import { nhcDataSources, type PostsItem } from "../generated/nhc-schema";

export type BlogPost = PostsItem;

export const cms = createCMS({
	dataSources: nhcDataSources,
	renderer: renderMarkdown,
	cache: {
		document: nextCache({ revalidate: 300, tags: ["posts"] }),
		image: memoryImageCache(),
		ttlMs: 5 * 60_000,
	},
});
