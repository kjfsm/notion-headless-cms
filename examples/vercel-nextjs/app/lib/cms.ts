import { createCMS, memoryImageCache } from "@notion-headless-cms/core";
import { nextCache } from "@notion-headless-cms/cache-next";
import { col, defineSchema, notionAdapter } from "@notion-headless-cms/source-notion";
import type { InferSchemaType } from "@notion-headless-cms/source-notion";

const blogSchema = defineSchema({
	slug: col.title("Slug", { default: "" }),
	title: col.richText("Title", { default: "" }),
	status: col.select("Status", {
		published: ["公開"],
		accessible: ["公開", "下書き"],
		default: "",
	}),
	publishedAt: col.date("PublishedAt", { default: "" }),
	tags: col.multiSelect("Tags"),
	description: col.richText("Description", { default: "" }),
});

export type BlogPost = InferSchemaType<typeof blogSchema._columns>;

export const cms = createCMS<BlogPost>({
	source: notionAdapter<BlogPost>({
		token: process.env.NOTION_TOKEN!,
		dataSourceId: process.env.NOTION_DATA_SOURCE_ID!,
		schema: blogSchema,
	}),
	cache: {
		document: nextCache({ revalidate: 300, tags: ["posts"] }),
		image: memoryImageCache(),
		ttlMs: 5 * 60_000,
	},
});
