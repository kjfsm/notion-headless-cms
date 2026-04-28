import { cloudflareCache } from "@notion-headless-cms/cache/cloudflare";
import {
	createCMS as _createCMS,
	type CMSGlobalOps,
	type CollectionClient,
} from "@notion-headless-cms/core";
import {
	notionEmbed,
	youtubeProvider,
} from "@notion-headless-cms/notion-embed";
import { createNotionCollection } from "@notion-headless-cms/notion-orm";
import {
	type Post,
	postsDataSourceId,
	postsProperties,
} from "../generated/nhc";

export type { Post as BlogPost };

export interface Env {
	NOTION_TOKEN: string;
	DOC_CACHE?: KVNamespace;
	IMG_BUCKET?: R2Bucket;
}

export interface Nhc extends CMSGlobalOps {
	posts: CollectionClient<Post>;
}

export function makeCms(env: Env): Nhc {
	const embed = notionEmbed({
		providers: [youtubeProvider({ display: "card" })],
	});

	return _createCMS({
		cache: cloudflareCache(env),
		renderer: embed.renderer,
		collections: {
			posts: {
				source: createNotionCollection({
					token: env.NOTION_TOKEN,
					dataSourceId: postsDataSourceId,
					properties: postsProperties,
					blocks: embed.blocks,
				}),
				slugField: "slug",
				statusField: "status",
				publishedStatuses: ["公開済み"] as const,
			},
		},
	}) as unknown as Nhc;
}
