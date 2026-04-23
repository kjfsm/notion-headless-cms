import { noopDocumentCache, noopImageCache } from "./cache/noop";
import { CollectionClientImpl, type CollectionContext } from "./collection";
import { createHandler, type HandlerOptions } from "./handler";
import { mergeHooks, mergeLoggers } from "./hooks";
import type { RenderContext } from "./rendering";
import type { RetryConfig } from "./retry";
import { DEFAULT_RETRY_CONFIG } from "./retry";
import type {
	BaseContentItem,
	CacheConfig,
	CMSHooks,
	CollectionClient,
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
	const listKey = collection;

	return {
		name: `${base.name}@${collection}`,
		async getList() {
			// biome-ignore lint/suspicious/noExplicitAny: キー別 namespace
			const anyBase = base as any;
			if (typeof anyBase.getListByKey === "function") {
				return anyBase.getListByKey(listKey);
			}
			return base.getList();
		},
		async setList(data) {
			// biome-ignore lint/suspicious/noExplicitAny: キー別 namespace
			const anyBase = base as any;
			if (typeof anyBase.setListByKey === "function") {
				return anyBase.setListByKey(listKey, data);
			}
			return base.setList(data);
		},
		async getItem(slug) {
			// biome-ignore lint/suspicious/noExplicitAny: キー別 namespace
			const anyBase = base as any;
			if (typeof anyBase.getItemByKey === "function") {
				return anyBase.getItemByKey(itemKey(slug));
			}
			return base.getItem(slug);
		},
		async setItem(slug, data) {
			// biome-ignore lint/suspicious/noExplicitAny: キー別 namespace
			const anyBase = base as any;
			if (typeof anyBase.setItemByKey === "function") {
				return anyBase.setItemByKey(itemKey(slug), data);
			}
			return base.setItem(slug, data);
		},
		async invalidate(scope) {
			if (!base.invalidate) return;
			if (scope === "all") {
				return base.invalidate({ collection });
			}
			if ("slug" in scope && !("collection" in scope)) {
				return base.invalidate({ collection, slug: scope.slug });
			}
			return base.invalidate(scope);
		},
	};
}

/**
 * 複数の DataSource を束ねた CMS クライアントを生成する。
 *
 * @example
 * const cms = createCMS({
 *   dataSources: {
 *     posts: createNotionCollection({ token, databaseId, schema }),
 *   },
 *   cache: { document, image, ttlMs: 60_000 },
 * });
 * const post = await cms.posts.getItem("my-slug");
 */
export function createCMS<D extends DataSourceMap>(
	opts: CreateCMSOptions<D>,
): CMSClient<D> {
	if (!opts.dataSources || Object.keys(opts.dataSources).length === 0) {
		throw new Error(
			"createCMS: dataSources に少なくとも1つのコレクションを指定してください。",
		);
	}

	const baseDocCache = resolveDocumentCache(opts.cache);
	const imgCache = resolveImageCache(opts.cache);
	const hasImageCache = hasImageCacheConfigured(opts.cache);
	const ttlMs = resolveTtl(opts.cache);
	const imageProxyBase =
		opts.content?.imageProxyBase ?? DEFAULT_IMAGE_PROXY_BASE;
	const contentConfig = opts.content;
	const rendererFn: RendererFn | undefined = opts.renderer;
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
		const ctx: CollectionContext<BaseContentItem> = {
			collection: name,
			source,
			docCache: scopedCache,
			render: renderCtx,
			hooks,
			logger,
			ttlMs,
			publishedStatuses: source.publishedStatuses
				? [...source.publishedStatuses]
				: [],
			accessibleStatuses: source.accessibleStatuses
				? [...source.accessibleStatuses]
				: [],
			retryConfig,
			maxConcurrent,
			waitUntil,
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
