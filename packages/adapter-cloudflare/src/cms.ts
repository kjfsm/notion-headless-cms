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
	NOTION_DATA_SOURCE_ID: string;
	CACHE_BUCKET?: R2BucketLike;
}

export interface CreateCloudflareCMSOptions<
	T extends BaseContentItem = BaseContentItem,
> {
	env: CloudflareCMSEnv;
	/** defineSchema() の戻り値または SchemaConfig を受け取る。 */
	schema?: SchemaConfig<T> | NotionSchema<T>;
	content?: ContentConfig;
	cache?: Omit<CacheConfig<T>, "document" | "image">;
}

function isNotionSchema<T extends BaseContentItem>(
	s: SchemaConfig<T> | NotionSchema<T>,
): s is NotionSchema<T> {
	return "zodSchema" in s && "mapping" in s;
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
	const { env, schema, content, cache } = opts;

	const notionSchema = schema && isNotionSchema(schema) ? schema : undefined;
	const cmsSchema = schema && !isNotionSchema(schema) ? schema : undefined;

	const source = notionAdapter<T>({
		token: env.NOTION_TOKEN,
		dataSourceId: env.NOTION_DATA_SOURCE_ID,
		schema: notionSchema,
	});

	const r2 = r2Cache<T>({ bucket: env.CACHE_BUCKET });

	const cacheConfig: CacheConfig<T> = {
		...cache,
		document: r2 ?? false,
		image: r2 ?? false,
	};

	const cmsOpts: CreateCMSOptions<T> = {
		source,
		renderer: renderMarkdown,
		schema: cmsSchema,
		content,
		cache: cacheConfig,
	};

	return createCMS<T>(cmsOpts);
}
