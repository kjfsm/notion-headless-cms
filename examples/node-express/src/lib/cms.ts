import { createNodeCMS } from "@notion-headless-cms/adapter-node";
import {
	defineMapping,
	defineSchema,
} from "@notion-headless-cms/source-notion";
import { z } from "zod";

const BlogSchema = z.object({
	id: z.string(),
	updatedAt: z.string(),
	slug: z
		.string()
		.nullable()
		.transform((s) => s ?? ""),
	status: z
		.string()
		.nullable()
		.transform((s) => s ?? ""),
	publishedAt: z
		.string()
		.nullable()
		.transform((s) => s ?? ""),
	title: z.string().nullable(),
	tags: z.array(z.string()),
	description: z.string().nullable(),
});

export type BlogPost = z.infer<typeof BlogSchema>;

const mapping = defineMapping<BlogPost>({
	slug: { type: "title", notion: "Slug" },
	status: {
		type: "select",
		notion: "Status",
		published: ["公開"],
		accessible: ["公開", "下書き"],
	},
	publishedAt: { type: "date", notion: "PublishedAt" },
	title: { type: "richText", notion: "Title" },
	tags: { type: "multiSelect", notion: "Tags" },
	description: { type: "richText", notion: "Description" },
});

const blogSchema = defineSchema(BlogSchema, mapping);

export const cms = createNodeCMS<BlogPost>({
	schema: blogSchema,
	cache: {
		document: "memory",
		image: "memory",
		ttlMs: 5 * 60_000,
	},
});
