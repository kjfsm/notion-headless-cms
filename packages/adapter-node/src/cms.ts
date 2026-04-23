import type {
	CacheConfig,
	CMSClient,
	ContentConfig,
	DataSourceMap,
} from "@notion-headless-cms/core";
import {
	CMSError,
	createCMS,
	memoryDocumentCache,
	memoryImageCache,
} from "@notion-headless-cms/core";
import { renderMarkdown } from "@notion-headless-cms/renderer";

/** キャッシュ設定。`"disabled"` で完全に無効化。 */
export type NodeCacheConfig =
	| "disabled"
	| {
			document?: "memory";
			image?: "memory";
			ttlMs?: number;
	  };

export interface CreateNodeCMSOptions<D extends DataSourceMap> {
	/** `nhc generate` が生成した `nhcDataSources` (コレクション名 → DataSource)。 */
	dataSources: D;
	/** Notion API トークン検証用 (省略時は `process.env.NOTION_TOKEN` を検証)。 */
	token?: string;
	cache?: NodeCacheConfig;
	content?: ContentConfig;
}

function resolveCacheConfig(
	cache: NodeCacheConfig | undefined,
): CacheConfig | undefined {
	if (cache === "disabled" || cache === undefined) return undefined;
	return {
		document: cache.document === "memory" ? memoryDocumentCache() : undefined,
		image: cache.image === "memory" ? memoryImageCache() : undefined,
		ttlMs: cache.ttlMs,
	};
}

/**
 * Node.js 向け CMS ファクトリ。
 * `nhc generate` で生成した `nhcDataSources` を渡すと、コレクション別にアクセス可能な
 * CMS クライアントを返す。
 *
 * @example
 * const cms = createNodeCMS({ dataSources: nhcDataSources, cache: { document: "memory", image: "memory" } });
 * const post = await cms.posts.getItem("my-slug");
 */
export function createNodeCMS<D extends DataSourceMap>(
	opts: CreateNodeCMSOptions<D>,
): CMSClient<D> {
	const token = opts.token ?? process.env.NOTION_TOKEN;
	if (!token) {
		throw new CMSError({
			code: "core/config_invalid",
			message: "NOTION_TOKEN environment variable is not set",
			context: { operation: "createNodeCMS", envVar: "NOTION_TOKEN" },
		});
	}

	return createCMS({
		dataSources: opts.dataSources,
		renderer: renderMarkdown,
		cache: resolveCacheConfig(opts.cache),
		content: opts.content,
	});
}
