import type { CloudflareMultiCMSEnv } from "@notion-headless-cms/adapter-cloudflare";
import { createCloudflareCMSMulti } from "@notion-headless-cms/adapter-cloudflare";
import { nhcSchema, type PostsItem } from "../generated/nhc-schema";

export type { PostsItem as BlogPost };
export type Env = CloudflareMultiCMSEnv;

export function createCMS(env: Env) {
	const client = createCloudflareCMSMulti({
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
