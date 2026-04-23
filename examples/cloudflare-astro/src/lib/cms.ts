import type { CloudflareCMSEnv } from "@notion-headless-cms/adapter-cloudflare";
import { createCloudflareCMS } from "@notion-headless-cms/adapter-cloudflare";
import { nhcSchema, type PostsItem } from "../generated/nhc-schema";

export type { PostsItem as BlogPost };
export type Env = CloudflareCMSEnv;

export function createCMS(env: Env) {
	const client = createCloudflareCMS({
		schema: nhcSchema,
		env,
		sources: {
			posts: {
				published: ["公開済み"],
				accessible: ["公開済み", "編集中", "下書き"],
			},
		},
		ttlMs: 5 * 60_000,
	});
	return client.posts;
}
