import { r2Cache } from "@notion-headless-cms/cache-r2";
import type {
	BaseContentItem,
	CacheConfig,
	ContentConfig,
	CreateCMSOptions,
	SchemaConfig,
} from "@notion-headless-cms/core";
import { CMS } from "@notion-headless-cms/core";
import { notionAdapter } from "@notion-headless-cms/source-notion";

export interface CloudfareCMSEnv {
	NOTION_TOKEN: string;
	NOTION_DATA_SOURCE_ID: string;
	CACHE_BUCKET?: R2Bucket;
}

export interface CreateCloudflareCMSOptions<
	T extends BaseContentItem = BaseContentItem,
> {
	env: CloudfareCMSEnv;
	schema?: SchemaConfig<T>;
	content?: ContentConfig;
	cache?: Omit<CacheConfig<T>, "document" | "image">;
}

/**
 * Cloudflare Workers 向け CMS ファクトリ。
 * env.CACHE_BUCKET (R2Bucket) を DocumentCacheAdapter / ImageCacheAdapter に変換して CMS に注入する。
 * CACHE_BUCKET が未設定の場合はキャッシュなしで動作する（ローカル開発向け）。
 */
export function createCloudflareCMS<
	T extends BaseContentItem = BaseContentItem,
>(opts: CreateCloudflareCMSOptions<T>): CMS<T> {
	const { env, schema, content, cache } = opts;

	const source = notionAdapter<T>({
		token: env.NOTION_TOKEN,
		dataSourceId: env.NOTION_DATA_SOURCE_ID,
	});

	const r2 = r2Cache<T>({ bucket: env.CACHE_BUCKET });

	const cacheConfig: CacheConfig<T> = {
		...cache,
		document: r2 ?? false,
		image: r2 ?? false,
	};

	const cmsOpts: CreateCMSOptions<T> = {
		source,
		schema,
		content,
		cache: cacheConfig,
	};

	return new CMS<T>(cmsOpts);
}
