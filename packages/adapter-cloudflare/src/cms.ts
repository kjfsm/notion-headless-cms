import type { R2BucketLike } from "@notion-headless-cms/cache-r2";
import { r2Cache } from "@notion-headless-cms/cache-r2";
import type {
	BaseContentItem,
	CacheConfig,
	ContentConfig,
	CreateCMSOptions,
	SchemaConfig,
} from "@notion-headless-cms/core";
import { createCMS } from "@notion-headless-cms/core";
import { renderMarkdown } from "@notion-headless-cms/renderer";
import type { NotionSchema } from "@notion-headless-cms/source-notion";
import { notionAdapter } from "@notion-headless-cms/source-notion";

export interface CloudflareCMSEnv {
	NOTION_TOKEN: string;
	/** Notion データベースの ID。DB_NAME を使う場合は任意。 */
	NOTION_DATA_SOURCE_ID?: string;
	/** Notion データベース名。NOTION_DATA_SOURCE_ID の代わりに指定可能。 */
	DB_NAME?: string;
	CACHE_BUCKET?: R2BucketLike;
}

export interface CreateCloudflareCMSOptions<
	T extends BaseContentItem = BaseContentItem,
> {
	env: CloudflareCMSEnv;
	/** defineSchema() の戻り値または SchemaConfig を受け取る。 */
	schema?: SchemaConfig<T> | NotionSchema<T>;
	content?: ContentConfig;
	/** キャッシュ TTL（ミリ秒）。未指定時は TTL なし。 */
	ttlMs?: number;
}

function isNotionSchema<T extends BaseContentItem>(
	s: SchemaConfig<T> | NotionSchema<T>,
): s is NotionSchema<T> {
	return "mapping" in s && "mapItem" in s;
}

/**
 * Cloudflare Workers 向け CMS ファクトリ。
 * env.CACHE_BUCKET (R2BucketLike) を DocumentCacheAdapter / ImageCacheAdapter に変換して CMS に注入する。
 * CACHE_BUCKET が未設定の場合はキャッシュなしで動作する（ローカル開発向け）。
 * schema に defineSchema() の戻り値を渡すとカスタムフィールドマッピングが有効になる。
 */
export function createCloudflareCMS<
	T extends BaseContentItem = BaseContentItem,
>(opts: CreateCloudflareCMSOptions<T>): ReturnType<typeof createCMS<T>> {
	const { env, schema, content, ttlMs } = opts;

	const notionSchema = schema && isNotionSchema(schema) ? schema : undefined;
	const cmsSchema = schema && !isNotionSchema(schema) ? schema : undefined;

	const source = notionAdapter<T>({
		token: env.NOTION_TOKEN,
		dataSourceId: env.NOTION_DATA_SOURCE_ID,
		dbName: env.NOTION_DATA_SOURCE_ID ? undefined : env.DB_NAME,
		schema: notionSchema,
	});

	const r2 = r2Cache<T>({ bucket: env.CACHE_BUCKET });

	const cacheConfig: CacheConfig<T> = r2
		? { document: r2, image: r2, ttlMs }
		: "disabled";

	const cmsOpts: CreateCMSOptions<T> = {
		source,
		renderer: renderMarkdown,
		schema: cmsSchema,
		content,
		cache: cacheConfig,
	};

	return createCMS<T>(cmsOpts);
}

// ── Multi-Source ──────────────────────────────────────────────────────────────

/** nhcSchema の各エントリの型。generateSchema() が生成するオブジェクトと対応する。 */
export interface MultiSourceEntry<T extends BaseContentItem = BaseContentItem> {
	id: string;
	dbName: string;
	schema?: NotionSchema<T>;
}

export type MultiSourceSchema = Record<
	string,
	MultiSourceEntry<BaseContentItem>
>;

type InferSourceItem<E> =
	E extends MultiSourceEntry<infer T> ? T : BaseContentItem;

export type MultiCMSResult<S extends MultiSourceSchema> = {
	[K in keyof S]: ReturnType<typeof createCMS<InferSourceItem<S[K]>>>;
};

/** マルチソース向け Cloudflare CMS ファクトリの env 型。 */
export interface CloudflareMultiCMSEnv {
	NOTION_TOKEN: string;
	/** R2 バケット（未設定時はキャッシュなし） */
	CACHE_BUCKET?: R2BucketLike;
}

/** ソースごとの公開ステータス設定。nhc generate で生成したファイルを編集せずに差し込める。 */
export interface SourceStatusConfig {
	/** 公開済みとみなすステータス値。未指定時は全件返す。 */
	published?: string[];
	/** アクセス可能とみなすステータス値。未指定時は published と同じ。 */
	accessible?: string[];
}

export interface CreateCloudflareCMSMultiOptions<S extends MultiSourceSchema> {
	schema: S;
	env: CloudflareMultiCMSEnv;
	/**
	 * ソースごとの公開ステータス設定。
	 * 生成ファイルを編集せずに published / accessible を差し込む。
	 *
	 * @example
	 * sources: {
	 *   posts: { published: ["公開"], accessible: ["公開", "下書き"] },
	 * }
	 */
	sources?: { [K in keyof S]?: SourceStatusConfig };
	content?: ContentConfig;
	/** SWR の TTL（ミリ秒） */
	ttlMs?: number;
}

/**
 * マルチソース向け Cloudflare Workers CMS ファクトリ。
 * nhc generate で生成した nhcSchema を渡すと、各ソースに対応する CMS インスタンスを返す。
 *
 * @example
 * const client = createCloudflareCMSMulti({ schema: nhcSchema, env, sources: { posts: { published: ["公開"] } } })
 * const posts = await client.posts.list()
 */
export function createCloudflareCMSMulti<S extends MultiSourceSchema>(
	opts: CreateCloudflareCMSMultiOptions<S>,
): MultiCMSResult<S> {
	const { schema, env, content, ttlMs } = opts;
	const r2 = r2Cache({ bucket: env.CACHE_BUCKET });
	const result = {} as MultiCMSResult<S>;

	for (const key of Object.keys(schema) as (keyof S & string)[]) {
		const entry = schema[key] as MultiSourceEntry<BaseContentItem>;
		const statusConfig = opts.sources?.[key];
		const source = notionAdapter({
			token: env.NOTION_TOKEN,
			dataSourceId: entry.id,
			schema: entry.schema,
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
