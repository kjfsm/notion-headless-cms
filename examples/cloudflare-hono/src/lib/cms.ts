import { cloudflarePreset } from "@notion-headless-cms/cache-r2";
import { createCMS as createCore } from "@notion-headless-cms/core";
import { cmsDataSources, type PostsItem } from "../generated/nhc-schema";

export type { PostsItem as BlogPost };

export interface Env {
	NOTION_TOKEN: string;
	// 旧名 CACHE_KV / CACHE_BUCKET もフォールバックとして認識される
	CACHE_KV?: KVNamespace;
	CACHE_BUCKET?: R2Bucket;
	// 推奨 binding 名
	DOC_CACHE?: KVNamespace;
	IMG_BUCKET?: R2Bucket;
}

export function createCMS(env: Env) {
	return createCore({
		...cloudflarePreset({ env, ttlMs: 5 * 60_000 }),
		dataSources: cmsDataSources,
	});
}
