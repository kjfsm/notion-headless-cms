import type { R2BucketLike } from "@notion-headless-cms/cache-r2";
import { r2Cache } from "@notion-headless-cms/cache-r2";
import type {
	CacheConfig,
	CMSClient,
	ContentConfig,
	DataSourceMap,
} from "@notion-headless-cms/core";
import { createCMS } from "@notion-headless-cms/core";
import { renderMarkdown } from "@notion-headless-cms/renderer";

/** Cloudflare Workers 向け env の必要最小構成。 */
export interface CloudflareCMSEnv {
	NOTION_TOKEN: string;
	/** R2 バケット (未設定時はキャッシュなし) */
	CACHE_BUCKET?: R2BucketLike;
}

export interface CreateCloudflareCMSOptions<D extends DataSourceMap> {
	/** `nhc generate` が生成した `nhcDataSources` (コレクション名 → DataSource)。 */
	dataSources: D;
	/** Workers バインディング。 */
	env: CloudflareCMSEnv;
	content?: ContentConfig;
	/** SWR の TTL (ミリ秒)。未指定時は TTL なし。 */
	ttlMs?: number;
	/** `ctx.waitUntil` を渡すと非同期キャッシュ更新が Workers のレスポンス後も継続する。 */
	waitUntil?: (p: Promise<unknown>) => void;
}

/**
 * Cloudflare Workers 向け CMS ファクトリ。
 * `nhc generate` で生成した `nhcDataSources` を渡すと、コレクション別にアクセス可能な
 * CMS クライアントを返す。`env.CACHE_BUCKET` が未設定の場合は
 * キャッシュなしで動作する (ローカル開発向け)。
 *
 * @example
 * const cms = createCloudflareCMS({ dataSources: nhcDataSources, env });
 * const post = await cms.posts.getItem("hello");
 */
export function createCloudflareCMS<D extends DataSourceMap>(
	opts: CreateCloudflareCMSOptions<D>,
): CMSClient<D> {
	const { dataSources, env, content, ttlMs, waitUntil } = opts;
	const r2 = r2Cache({ bucket: env.CACHE_BUCKET });

	const cache: CacheConfig | undefined = r2
		? { document: r2, image: r2, ttlMs }
		: undefined;

	return createCMS({
		dataSources,
		renderer: renderMarkdown,
		cache,
		content,
		waitUntil,
	});
}
