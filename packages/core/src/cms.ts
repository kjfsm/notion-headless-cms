import { noopDocumentCache, noopImageCache } from "./cache/noop";
import { CollectionClientImpl, type CollectionContext } from "./collection";
import { CMSError } from "./errors";
import { createHandler, type HandlerOptions } from "./handler";
import { mergeHooks, mergeLoggers } from "./hooks";
import { nodePreset } from "./preset-node";
import type { RenderContext } from "./rendering";
import type { RetryConfig } from "./retry";
import { DEFAULT_RETRY_CONFIG } from "./retry";
import type {
	BaseContentItem,
	CacheConfig,
	CMSHooks,
	CollectionClient,
	CollectionSemantics,
	CreateCMSOptions,
	DataSource,
	DataSourceMap,
	DocumentCacheAdapter,
	ImageCacheAdapter,
	InferDataSourceItem,
	InvalidateScope,
	Logger,
	RendererFn,
} from "./types/index";

const DEFAULT_IMAGE_PROXY_BASE = "/api/images";

/** `CMSClient<D>` — コレクション別アクセス + グローバル操作の合成型。 */
export type CMSClient<D extends DataSourceMap> = {
	[K in keyof D]: CollectionClient<InferDataSourceItem<D[K]>>;
} & CMSGlobalOps<D>;

/** `CMSClient` のグローバル名前空間。`$` プレフィックス。 */
export interface CMSGlobalOps<D extends DataSourceMap> {
	/** 登録されているコレクション名の一覧。 */
	readonly $collections: readonly (keyof D & string)[];
	/** 全コレクションまたは特定コレクションのキャッシュを無効化する。 */
	$revalidate(scope?: InvalidateScope): Promise<void>;
	/** Web Standard なルーティングハンドラ (画像プロキシ / webhook) を生成する。 */
	$handler(opts?: HandlerOptions): (req: Request) => Promise<Response>;
	/** ハッシュキーでキャッシュ画像を取得する。 */
	$getCachedImage(hash: string): ReturnType<ImageCacheAdapter["get"]>;
}

function resolveDocumentCache(
	cache: CacheConfig | undefined,
	// biome-ignore lint/suspicious/noExplicitAny: 横断的に利用
): DocumentCacheAdapter<any> {
	if (!cache || cache === "disabled" || !cache.document) {
		return noopDocumentCache();
	}
	return cache.document;
}

function resolveImageCache(cache: CacheConfig | undefined): ImageCacheAdapter {
	if (!cache || cache === "disabled" || !cache.image) {
		return noopImageCache();
	}
	return cache.image;
}

function resolveTtl(cache: CacheConfig | undefined): number | undefined {
	if (!cache || cache === "disabled") return undefined;
	return cache.ttlMs;
}

function hasImageCacheConfigured(cache: CacheConfig | undefined): boolean {
	if (!cache || cache === "disabled") return false;
	return !!cache.image;
}

/**
 * `{collection}:{slug}` キー空間で動作するコレクション別キャッシュビューを生成する。
 * 単一の `DocumentCacheAdapter` に複数コレクションを同居させるためのアダプタ。
 */
function scopeDocumentCache<T extends BaseContentItem>(
	// biome-ignore lint/suspicious/noExplicitAny: 共有ストレージのため
	base: DocumentCacheAdapter<any>,
	collection: string,
): DocumentCacheAdapter<T> {
	const itemKey = (slug: string): string => `${collection}:${slug}`;

	return {
		name: `${base.name}@${collection}`,
		getList: () => base.getList(),
		setList: (data) => base.setList(data),
		getItem: (slug) => base.getItem(itemKey(slug)),
		setItem: (slug, data) => base.setItem(itemKey(slug), data),
		async invalidate(scope) {
			if (!base.invalidate) return;
			if (scope === "all") {
				return base.invalidate({ collection });
			}
			return base.invalidate(scope);
		},
	};
}

/**
 * `preset` オプションを解決して `cache` / `renderer` のデフォルトを補完する内部関数。
 * 明示的な `cache` / `renderer` がある場合はそちらが優先される。
 * `preset` 未指定時は opts をそのまま返す。
 */
function resolvePreset<D extends DataSourceMap>(
	opts: CreateCMSOptions<D>,
): CreateCMSOptions<D> {
	if (opts.preset === "disabled") {
		return { ...opts, cache: undefined };
	}
	if (opts.preset === "node") {
		const presetResult = nodePreset({ ttlMs: opts.ttlMs });
		return {
			...opts,
			cache: opts.cache ?? presetResult.cache,
			renderer: opts.renderer ?? presetResult.renderer,
		};
	}
	return opts;
}

/**
 * 複数の DataSource を束ねた CMS クライアントを生成する。
 *
 * @example
 * // Node.js（preset を使った簡潔な記法）
 * const cms = createCMS({ dataSources: cmsDataSources, preset: "node", ttlMs: 5 * 60_000 });
 *
 * @example
 * // 従来の spread パターン（引き続き動作する）
 * const cms = createCMS({ ...nodePreset({ ttlMs: 5 * 60_000 }), dataSources: cmsDataSources });
 *
 * @example
 * // キャッシュを細かく指定する場合
 * const cms = createCMS({
 *   dataSources,
 *   cache: { document, image, ttlMs: 60_000 },
 * });
 */
export function createCMS<D extends DataSourceMap>(
	opts: CreateCMSOptions<D>,
): CMSClient<D> {
	if (!opts.dataSources || Object.keys(opts.dataSources).length === 0) {
		throw new CMSError({
			code: "core/config_invalid",
			message:
				"createCMS: dataSources に少なくとも1つのコレクションを指定してください。",
			context: { operation: "createCMS" },
		});
	}

	// collections が指定されたコレクションは slug が必須。
	for (const [name, col] of Object.entries(opts.collections ?? {})) {
		const c = col as CollectionSemantics | undefined;
		if (c && !c.slug) {
			throw new CMSError({
				code: "core/config_invalid",
				message: `createCMS: コレクション "${name}" の collections.slug は必須です。slug として使うフィールド名を指定してください。`,
				context: { operation: "createCMS", collection: name },
			});
		}
	}

	const resolved = resolvePreset(opts);

	const baseDocCache = resolveDocumentCache(resolved.cache);
	const imgCache = resolveImageCache(resolved.cache);
	const hasImageCache = hasImageCacheConfigured(resolved.cache);
	const ttlMs = resolveTtl(resolved.cache);
	const imageProxyBase =
		opts.content?.imageProxyBase ?? DEFAULT_IMAGE_PROXY_BASE;
	const contentConfig = opts.content;
	const rendererFn: RendererFn | undefined = resolved.renderer;
	const waitUntil = opts.waitUntil;
	const logger: Logger | undefined = mergeLoggers(
		opts.plugins ?? [],
		opts.logger,
	);
	const hooks: CMSHooks<BaseContentItem> = mergeHooks(
		opts.plugins ?? [],
		opts.hooks,
		logger,
	);
	const maxConcurrent = opts.rateLimiter?.maxConcurrent ?? 3;
	const retryConfig: RetryConfig = {
		...DEFAULT_RETRY_CONFIG,
		...(opts.rateLimiter ?? {}),
	};

	const collectionNames = Object.keys(opts.dataSources) as (keyof D & string)[];

	// biome-ignore lint/suspicious/noExplicitAny: 各 T を保持
	const collections: Record<string, CollectionClient<any>> = {};
	for (const name of collectionNames) {
		const source = opts.dataSources[name] as DataSource<BaseContentItem>;
		const scopedCache = scopeDocumentCache<BaseContentItem>(baseDocCache, name);
		const renderCtx: RenderContext<BaseContentItem> = {
			source,
			rendererFn,
			imgCache,
			hasImageCache,
			imageProxyBase,
			contentConfig,
			hooks,
			logger,
		};
		const col = opts.collections?.[name] as CollectionSemantics | undefined;
		const ctx: CollectionContext<BaseContentItem> = {
			collection: name,
			source,
			docCache: scopedCache,
			render: renderCtx,
			hooks,
			logger,
			ttlMs,
			// 公開条件は CollectionSemantics（createCMS の collections オプション）が権威
			publishedStatuses: col?.publishedStatuses
				? [...col.publishedStatuses]
				: [],
			accessibleStatuses: col?.accessibleStatuses
				? [...col.accessibleStatuses]
				: [],
			retryConfig,
			maxConcurrent,
			waitUntil,
			slugField: col?.slug,
		};
		collections[name] = new CollectionClientImpl(ctx);
	}

	const globalOps: CMSGlobalOps<D> = {
		$collections: collectionNames,
		async $revalidate(scope?: InvalidateScope): Promise<void> {
			if (!baseDocCache.invalidate) return;
			await baseDocCache.invalidate(scope ?? "all");
		},
		$handler(handlerOpts?: HandlerOptions) {
			return createHandler(
				{
					imageCache: imgCache,
					parseWebhook: async (req, webhookSecret) => {
						// 各 DataSource の parseWebhook を順に試す
						for (const name of collectionNames) {
							const ds = opts.dataSources[name] as DataSource<BaseContentItem>;
							if (ds.parseWebhook) {
								try {
									const scope = await ds.parseWebhook(req.clone(), {
										secret: webhookSecret,
									});
									return scope;
								} catch (err) {
									logger?.warn?.("parseWebhook 失敗", {
										collection: name,
										error: err instanceof Error ? err.message : String(err),
									});
								}
							}
						}
						// フォールバック: { slug } だけの汎用 JSON body
						try {
							const body = (await req.json()) as {
								slug?: string;
								collection?: string;
							};
							if (body.slug && body.collection) {
								return { collection: body.collection, slug: body.slug };
							}
							if (body.collection) {
								return { collection: body.collection };
							}
						} catch {
							// ignore
						}
						return null;
					},
					revalidate: (scope) => globalOps.$revalidate(scope),
				},
				handlerOpts,
			);
		},
		$getCachedImage(hash) {
			return imgCache.get(hash);
		},
	};

	return Object.assign(
		Object.create(null) as object,
		collections,
		globalOps,
	) as CMSClient<D>;
}
