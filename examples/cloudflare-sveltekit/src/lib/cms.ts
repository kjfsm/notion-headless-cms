import { cloudflareCache } from "@notion-headless-cms/cache/cloudflare";
import { createCMS, type Nhc, type Post } from "../generated/nhc";

export type { Post as BlogPost };

export interface Env {
	NOTION_TOKEN: string;
	// 推奨 binding 名 (cloudflareCache のデフォルト)
	DOC_CACHE?: KVNamespace;
	IMG_BUCKET?: R2Bucket;
}

export function makeCms(env: Env): Nhc {
	return createCMS({
		notionToken: env.NOTION_TOKEN,
		cache: cloudflareCache(env),
		ttlMs: 5 * 60_000,
	});
}
