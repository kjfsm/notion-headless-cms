import type {
	BaseContentItem,
	CacheConfig,
	ContentConfig,
} from "@notion-headless-cms/core";
import {
	CMSError,
	createCMS,
	memoryDocumentCache,
	memoryImageCache,
} from "@notion-headless-cms/core";
import { renderMarkdown } from "@notion-headless-cms/renderer";
import type {
	CMSMap,
	NHCSchema,
	SourceEntry,
	SourceStatusConfig,
} from "@notion-headless-cms/source-notion";
import { notionAdapter } from "@notion-headless-cms/source-notion";

/** キャッシュ設定。`"disabled"` で完全に無効化。 */
export type NodeCacheConfig =
	| "disabled"
	| {
			document?: "memory";
			image?: "memory";
			ttlMs?: number;
	  };

export interface CreateNodeCMSOptions<S extends NHCSchema> {
	/** `nhc generate` が生成した `nhcSchema`。 */
	schema: S;
	/**
	 * ソースごとの公開ステータス設定。
	 * 生成ファイルを編集せずに `published` / `accessible` を差し込む。
	 *
	 * @example
	 * sources: {
	 *   posts: { published: ["公開"], accessible: ["公開", "下書き"] },
	 *   news:  { published: ["掲載中"] },
	 * }
	 */
	sources?: { [K in keyof S]?: SourceStatusConfig };
	/** Notion API トークン（省略時は `process.env.NOTION_TOKEN`）。 */
	token?: string;
	cache?: NodeCacheConfig;
	content?: ContentConfig;
}

function resolveCacheConfig<T extends BaseContentItem>(
	cache: NodeCacheConfig | undefined,
): CacheConfig<T> {
	if (cache === "disabled" || cache === undefined) return "disabled";
	return {
		document:
			cache.document === "memory" ? memoryDocumentCache<T>() : undefined,
		image: cache.image === "memory" ? memoryImageCache() : undefined,
		ttlMs: cache.ttlMs,
	};
}

/**
 * Node.js 向け CMS ファクトリ。
 * `nhc generate` で生成した `nhcSchema` を渡すと、各ソースに対応する
 * `CMS` インスタンスのマップを返す。
 *
 * @example
 * const client = createNodeCMS({ schema: nhcSchema });
 * const posts = await client.posts.list();
 */
export function createNodeCMS<S extends NHCSchema>(
	opts: CreateNodeCMSOptions<S>,
): CMSMap<S> {
	const token = opts.token ?? process.env.NOTION_TOKEN;
	if (!token) {
		throw new CMSError({
			code: "core/config_invalid",
			message: "NOTION_TOKEN environment variable is not set",
			context: { operation: "createNodeCMS", envVar: "NOTION_TOKEN" },
		});
	}

	const cacheConfig = resolveCacheConfig(opts.cache);
	const result = {} as CMSMap<S>;

	for (const key of Object.keys(opts.schema) as (keyof S & string)[]) {
		const entry = opts.schema[key] as SourceEntry<BaseContentItem>;
		const statusConfig = opts.sources?.[key];
		const source = entry.schema
			? notionAdapter({ token, dataSourceId: entry.id, schema: entry.schema })
			: notionAdapter({ token, dataSourceId: entry.id });
		(result as Record<string, unknown>)[key] = createCMS({
			source,
			renderer: renderMarkdown,
			cache: cacheConfig,
			content: opts.content,
			...(statusConfig && {
				schema: {
					publishedStatuses: statusConfig.published,
					accessibleStatuses: statusConfig.accessible ?? statusConfig.published,
				},
			}),
		});
	}

	return result;
}
