import type { R2BucketLike } from "@notion-headless-cms/cache-r2";
import { r2Cache } from "@notion-headless-cms/cache-r2";
import type {
	BaseContentItem,
	CacheConfig,
	ContentConfig,
} from "@notion-headless-cms/core";
import { createCMS } from "@notion-headless-cms/core";
import { renderMarkdown } from "@notion-headless-cms/renderer";
import type {
	CMSMap,
	NHCSchema,
	SourceEntry,
	SourceStatusConfig,
} from "@notion-headless-cms/source-notion";
import { notionAdapter } from "@notion-headless-cms/source-notion";

/** Cloudflare Workers 向け env の必要最小構成。 */
export interface CloudflareCMSEnv {
	NOTION_TOKEN: string;
	/** R2 バケット（未設定時はキャッシュなし） */
	CACHE_BUCKET?: R2BucketLike;
}

export interface CreateCloudflareCMSOptions<S extends NHCSchema> {
	/** `nhc generate` が生成した `nhcSchema`。 */
	schema: S;
	/** Workers バインディング。 */
	env: CloudflareCMSEnv;
	/**
	 * ソースごとの公開ステータス設定。
	 * 生成ファイルを編集せずに `published` / `accessible` を差し込む。
	 *
	 * @example
	 * sources: {
	 *   posts: { published: ["公開"], accessible: ["公開", "下書き"] },
	 * }
	 */
	sources?: { [K in keyof S]?: SourceStatusConfig };
	content?: ContentConfig;
	/** SWR の TTL（ミリ秒）。未指定時は TTL なし。 */
	ttlMs?: number;
}

/**
 * Cloudflare Workers 向け CMS ファクトリ。
 * `nhc generate` で生成した `nhcSchema` を渡すと、各ソースに対応する
 * `CMS` インスタンスのマップを返す。`env.CACHE_BUCKET` が未設定の場合は
 * キャッシュなしで動作する（ローカル開発向け）。
 *
 * @example
 * const client = createCloudflareCMS({ schema: nhcSchema, env, sources: { posts: { published: ["公開"] } } })
 * const posts = await client.posts.list()
 */
export function createCloudflareCMS<S extends NHCSchema>(
	opts: CreateCloudflareCMSOptions<S>,
): CMSMap<S> {
	const { schema, env, content, ttlMs } = opts;
	const r2 = r2Cache({ bucket: env.CACHE_BUCKET });
	const result = {} as CMSMap<S>;

	for (const key of Object.keys(schema) as (keyof S & string)[]) {
		const entry = schema[key] as SourceEntry<BaseContentItem>;
		const statusConfig = opts.sources?.[key];
		const source = entry.schema
			? notionAdapter({
					token: env.NOTION_TOKEN,
					dataSourceId: entry.id,
					schema: entry.schema,
				})
			: notionAdapter({
					token: env.NOTION_TOKEN,
					dataSourceId: entry.id,
				});
		const cacheConfig: CacheConfig<BaseContentItem> = r2
			? { document: r2, image: r2, ttlMs }
			: "disabled";
		(result as Record<string, unknown>)[key] = createCMS({
			source,
			renderer: renderMarkdown,
			cache: cacheConfig,
			content,
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
