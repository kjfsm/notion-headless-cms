import type { KVNamespaceLike } from "@notion-headless-cms/cache-kv";
import { kvCache } from "@notion-headless-cms/cache-kv";
import {
	type CacheConfig,
	type CMSClient,
	CMSError,
	type CreateCMSOptions,
	createCMS,
	type DataSourceMap,
} from "@notion-headless-cms/core";
import { r2Cache } from "./r2-cache";
import type { R2BucketLike } from "./types";

/** `cloudflarePreset` が参照する env の最小構成。 */
export interface CloudflarePresetEnv {
	/** Notion API トークン (wrangler secret put で設定)。 */
	NOTION_TOKEN?: string;
	/** ドキュメントキャッシュ用 KV namespace (未設定時はキャッシュなし)。 */
	DOC_CACHE?: KVNamespaceLike;
	/** 画像キャッシュ用 R2 バケット (未設定時はキャッシュなし)。 */
	IMG_BUCKET?: R2BucketLike;
}

/** `cloudflarePreset()` のオプション。 */
export interface CloudflarePresetOptions {
	/** Workers の `env` オブジェクト。 */
	env: CloudflarePresetEnv;
	/** SWR の TTL (ミリ秒)。未指定時は TTL なし。 */
	ttlMs?: number;
	/**
	 * binding 名をカスタマイズする。既定は `{ docCache: "DOC_CACHE", imgBucket: "IMG_BUCKET" }`。
	 * env のキー名をそのまま指定する。
	 */
	bindings?: {
		docCache?: string;
		imgBucket?: string;
	};
}

/**
 * `createCloudflareFactory()` に渡すオプション。
 * `CreateCMSOptions` から `preset` を除いた全フィールドを受け取る。
 * `bindings` は `cloudflarePreset` に転送される Cloudflare 固有のオプション。
 */
export type CreateCloudflareFactoryOptions<
	D extends DataSourceMap = DataSourceMap,
> = Omit<CreateCMSOptions<D>, "preset"> & {
	/**
	 * KV / R2 binding 名のカスタマイズ。`cloudflarePreset` に転送される。
	 * @default { docCache: "DOC_CACHE", imgBucket: "IMG_BUCKET" }
	 */
	bindings?: CloudflarePresetOptions["bindings"];
};

/**
 * Cloudflare Workers 向けの `createCMS` ファクトリを生成する。
 * 全 Cloudflare example で繰り返されていたボイラープレートを1行に削減する。
 *
 * 返り値の関数は Workers の `env` を受け取り、`CMSClient` を返す。
 * リクエストごとに呼び出すことを想定している。
 *
 * @example
 * // Before（手書きのボイラープレートが必要だった）
 * import { createCMS as createCore } from "@notion-headless-cms/core";
 * import { cloudflarePreset } from "@notion-headless-cms/cache-r2";
 *
 * export function createCMS(env: Env) {
 *   return createCore({ ...cloudflarePreset({ env, ttlMs: 5 * 60_000 }), dataSources });
 * }
 *
 * // After
 * import { createCloudflareFactory } from "@notion-headless-cms/cache-r2";
 *
 * export const createCMS = createCloudflareFactory({ dataSources, ttlMs: 5 * 60_000 });
 * // 使い方は変わらない: createCMS(env).posts.getList()
 */
export function createCloudflareFactory<D extends DataSourceMap>(
	factoryOpts: CreateCloudflareFactoryOptions<D>,
): (env: CloudflarePresetEnv) => CMSClient<D> {
	const { bindings, ...cmsOpts } = factoryOpts;
	return (env) => {
		const presetResult = cloudflarePreset({
			env,
			ttlMs: cmsOpts.ttlMs,
			bindings,
		});
		return createCMS({
			...cmsOpts,
			cache: cmsOpts.cache ?? presetResult.cache,
		});
	};
}

/**
 * Cloudflare Workers ランタイム向けの `createCMS` オプションプリセット。
 * env の KV / R2 binding を自動で cache 層に注入する。
 *
 * @example
 * import { createCMS } from "@notion-headless-cms/core";
 * import { cloudflarePreset } from "@notion-headless-cms/cache-r2";
 *
 * export default {
 *   async fetch(req, env) {
 *     const cms = createCMS({
 *       ...cloudflarePreset({ env }),
 *       dataSources: cmsDataSources,
 *     });
 *   },
 * };
 *
 * 既定の binding 名は `DOC_CACHE` (KV) と `IMG_BUCKET` (R2)。
 */
export function cloudflarePreset(
	opts: CloudflarePresetOptions,
): Pick<CreateCMSOptions, "cache"> {
	const env = opts.env as Record<string, unknown>;
	const docCacheKey = opts.bindings?.docCache ?? "DOC_CACHE";
	const imgBucketKey = opts.bindings?.imgBucket ?? "IMG_BUCKET";

	const kvBinding = env[docCacheKey] as KVNamespaceLike | undefined;
	const r2Binding = env[imgBucketKey] as R2BucketLike | undefined;

	// NOTION_TOKEN は preset 側で事前チェック (DataSource 層で謎のエラーになるのを防ぐ)
	if (!env.NOTION_TOKEN) {
		throw new CMSError({
			code: "core/config_invalid",
			message:
				"env.NOTION_TOKEN が設定されていません。wrangler secret put NOTION_TOKEN で設定してください。",
			context: { operation: "cloudflarePreset", envVar: "NOTION_TOKEN" },
		});
	}

	const documentCache = kvCache({ kv: kvBinding });
	const imageCache = r2Cache({ bucket: r2Binding });

	const cache: CacheConfig | undefined =
		documentCache || imageCache
			? { document: documentCache, image: imageCache, ttlMs: opts.ttlMs }
			: undefined;

	return { cache };
}
