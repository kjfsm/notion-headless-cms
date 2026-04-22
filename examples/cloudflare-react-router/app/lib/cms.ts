import type { CloudflareCMSEnv } from "@notion-headless-cms/adapter-cloudflare";
import { createCloudflareCMS } from "@notion-headless-cms/adapter-cloudflare";
import type { PostsItem } from "../generated/nhc-schema";
import { postsSchema } from "../generated/nhc-schema";

export type { PostsItem as BlogPost };

export type Env = CloudflareCMSEnv;

export function createCMS(env: Env) {
	return createCloudflareCMS<PostsItem>({
		env,
		schema: postsSchema,
		ttlMs: 5 * 60_000,
	});
}
