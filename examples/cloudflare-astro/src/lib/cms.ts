import type { CloudflareCMSEnv } from "@notion-headless-cms/adapter-cloudflare";
import { createCloudflareCMS } from "@notion-headless-cms/adapter-cloudflare";
import { nhcDataSources, type PostsItem } from "../generated/nhc-schema";

export type { PostsItem as BlogPost };
export type Env = CloudflareCMSEnv;

export function createCMS(env: Env) {
	return createCloudflareCMS({
		dataSources: nhcDataSources,
		env,
		ttlMs: 5 * 60_000,
	});
}
