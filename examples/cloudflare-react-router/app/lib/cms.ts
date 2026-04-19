import { createCloudflareCMS } from "@notion-headless-cms/adapter-cloudflare";
import { col, defineSchema } from "@notion-headless-cms/source-notion";
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

export function createCMS(env: Env) {
	return createCloudflareCMS<BlogPost>({
		env,
		schema: blogSchema,
		cache: { ttlMs: 5 * 60_000 },
	});
}
