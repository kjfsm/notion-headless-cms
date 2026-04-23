import { createNodeCMS } from "@notion-headless-cms/adapter-node";
import { nhcSchema, type PostsItem } from "../generated/nhc-schema.js";

const client = createNodeCMS({
	schema: nhcSchema,
	sources: {
		posts: {
			published: ["公開済み"],
			accessible: ["公開済み", "編集中", "下書き"],
		},
	},
	cache: {
		document: "memory",
		image: "memory",
		ttlMs: 5 * 60_000,
	},
});

export type BlogPost = PostsItem;
export const cms = client.posts;
