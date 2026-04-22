import { nextCache } from "@notion-headless-cms/cache-next";
import { createCMS, memoryImageCache } from "@notion-headless-cms/core";
import { notionAdapter } from "@notion-headless-cms/source-notion";
import { nhcSchema, type PostsItem } from "../generated/nhc-schema";

export type BlogPost = PostsItem;

const { posts } = nhcSchema;

export const cms = createCMS<BlogPost>({
	source: notionAdapter<BlogPost>({
		token: process.env.NOTION_TOKEN!,
		dataSourceId: posts.id,
		schema: posts.schema,
	}),
	schema: {
		publishedStatuses: ["公開済み"],
		accessibleStatuses: ["公開済み", "編集中", "下書き"],
	},
	cache: {
		document: nextCache({ revalidate: 300, tags: ["posts"] }),
		image: memoryImageCache(),
		ttlMs: 5 * 60_000,
	},
});
