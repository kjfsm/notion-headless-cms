import { isStale } from "./cache";
import { noopDocumentCache, noopImageCache } from "./cache/noop";
import { CMSError, isCMSError } from "./errors";
import { mergeHooks, mergeLoggers } from "./hooks";
import { buildCacheImageFn } from "./image";
import { QueryBuilder } from "./query";
import type { RetryConfig } from "./retry";
import { DEFAULT_RETRY_CONFIG, withRetry } from "./retry";
import type {
	BaseContentItem,
	CacheConfig,
	CachedItem,
	CMSHooks,
	CreateCMSOptions,
	DataSourceAdapter,
	DocumentCacheAdapter,
	ImageCacheAdapter,
	Logger,
	RendererFn,
	StorageBinary,
} from "./types/index";

const DEFAULT_IMAGE_PROXY_BASE = "/api/images";

function resolveDocumentCache<T extends BaseContentItem>(
	cache: CacheConfig<T> | undefined,
): DocumentCacheAdapter<T> {
	if (!cache || cache === "disabled" || !cache.document) {
		return noopDocumentCache<T>();
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

/** キャッシュ読み取りアクセサ（SWR）。 */
interface CacheReadAccessor<T extends BaseContentItem> {
	list(): Promise<{ items: T[]; isStale: boolean; cachedAt: number }>;
	get(slug: string): Promise<CachedItem<T> | null>;
}

/** キャッシュ管理オペレーション。 */
interface CacheManageAccessor<T extends BaseContentItem> {
	prefetchAll(opts?: {
		concurrency?: number;
		onProgress?: (done: number, total: number) => void;
	}): Promise<{ ok: number; failed: number }>;
	revalidate(scope?: "all" | { slug: string }): Promise<void>;
	sync(payload?: { slug?: string }): Promise<{ updated: string[] }>;
	checkList(
		version: string,
	): Promise<{ changed: false } | { changed: true; items: T[] }>;
	checkItem(
		slug: string,
		lastEdited: string,
	): Promise<
		| { changed: false }
		| { changed: true; html: string; item: T; notionUpdatedAt: string }
	>;
}

/** キャッシュ系の公開名前空間。`read` と `manage` を分離する。 */
interface CacheAccessor<T extends BaseContentItem> {
	read: CacheReadAccessor<T>;
	manage: CacheManageAccessor<T>;
}

/**
 * Notion をバックエンドとして使う汎用ヘッドレス CMS クラス。
 *
 * @example
 * const cms = createCMS({
 *   source: notionAdapter({ token: '...', dataSourceId: '...' }),
 * });
 * const items = await cms.list();
 */
export class CMS<T extends BaseContentItem = BaseContentItem> {
	private readonly source: DataSourceAdapter<T>;
	private readonly docCache: DocumentCacheAdapter<T>;
	private readonly imgCache: ImageCacheAdapter;
	private readonly hasImageCache: boolean;
	private readonly ttlMs: number | undefined;
	private readonly publishedStatuses: string[];
	private readonly accessibleStatuses: string[];
	private readonly imageProxyBase: string;
	private readonly contentConfig: CreateCMSOptions<T>["content"];
	private readonly rendererFn: RendererFn | undefined;
	private readonly waitUntil: ((p: Promise<unknown>) => void) | undefined;
	private readonly hooks: CMSHooks<T>;
	private readonly logger: Logger | undefined;
	private readonly retryConfig: RetryConfig;

	readonly cache: CacheAccessor<T>;

	constructor(opts: CreateCMSOptions<T>) {
		this.source = opts.source;
		this.docCache = resolveDocumentCache(opts.cache);
		this.imgCache = resolveImageCache(opts.cache);
		this.hasImageCache = hasImageCacheConfigured(opts.cache);
		this.ttlMs = resolveTtl(opts.cache);
		this.publishedStatuses =
			opts.schema?.publishedStatuses ??
			(opts.source.publishedStatuses ? [...opts.source.publishedStatuses] : []);
		this.accessibleStatuses =
			opts.schema?.accessibleStatuses ??
			(opts.source.accessibleStatuses
				? [...opts.source.accessibleStatuses]
				: []);
		this.imageProxyBase =
			opts.content?.imageProxyBase ?? DEFAULT_IMAGE_PROXY_BASE;
		this.contentConfig = opts.content;
		this.rendererFn = opts.renderer ?? opts.content?.render;
		this.waitUntil = opts.waitUntil;
		this.logger = mergeLoggers(opts.plugins ?? [], opts.logger);
		this.hooks = mergeHooks(opts.plugins ?? [], opts.hooks, this.logger);
		this.retryConfig = {
			...DEFAULT_RETRY_CONFIG,
			...(opts.rateLimiter ?? {}),
		};

		this.cache = {
			read: {
				list: this.cachedList.bind(this),
				get: this.cachedGet.bind(this),
			},
			manage: {
				prefetchAll: this.prefetchAll.bind(this),
				revalidate: this.revalidate.bind(this),
				sync: this.syncFromWebhook.bind(this),
				checkList: this.checkListUpdate.bind(this),
				checkItem: this.checkItemUpdate.bind(this),
			},
		};
	}

	// ── コンテンツ取得 ──────────────────────────────────────────────────────

	/** 公開済みコンテンツ一覧をソースから直接取得する。 */
	list(): Promise<T[]> {
		return withRetry(
			() =>
				this.source.list({
					publishedStatuses:
						this.publishedStatuses.length > 0
							? this.publishedStatuses
							: undefined,
				}),
			{
				...this.retryConfig,
				onRetry: (attempt, status) => {
					this.logger?.warn?.("list() リトライ中", { attempt, status });
				},
			},
		);
	}

	/** スラッグでコンテンツをソースから直接取得する。 */
	async find(slug: string): Promise<T | null> {
		const item = await withRetry(() => this.source.findBySlug(slug), {
			...this.retryConfig,
			onRetry: (attempt, status) => {
				this.logger?.warn?.("find() リトライ中", { attempt, status, slug });
			},
		});
		if (!item) return null;
		if (
			this.accessibleStatuses.length > 0 &&
			(!item.status || !this.accessibleStatuses.includes(item.status))
		) {
			return null;
		}
		return item;
	}

	/** アイテムが publishedStatuses に含まれるステータスかどうかを返す。 */
	isPublished(item: T): boolean {
		if (this.publishedStatuses.length === 0) return true;
		return !!item.status && this.publishedStatuses.includes(item.status);
	}

	/** コンテンツを Markdown → HTML にレンダリングし、CachedItem として返す。 */
	async render(item: T): Promise<CachedItem<T>> {
		return this.buildCachedItem(item);
	}

	/** QueryBuilder を返す。ステータス・タグ・ページネーションなどを連鎖で指定できる。 */
	query(): QueryBuilder<T> {
		return new QueryBuilder(this.source, this.publishedStatuses);
	}

	/** 全コンテンツを事前レンダリングしてキャッシュに保存する。 */
	async prefetchAll(opts?: {
		concurrency?: number;
		onProgress?: (done: number, total: number) => void;
	}): Promise<{ ok: number; failed: number }> {
		const items = await this.list();
		const concurrency = opts?.concurrency ?? 3;
		let ok = 0;
		let failed = 0;

		for (let i = 0; i < items.length; i += concurrency) {
			const chunk = items.slice(i, i + concurrency);
			await Promise.all(
				chunk.map(async (item) => {
					try {
						const rendered = await this.buildCachedItem(item);
						await this.docCache.setItem(item.slug, rendered);
						ok++;
					} catch (err) {
						failed++;
						this.logger?.warn?.(
							"prefetchAll: アイテムの事前レンダリングに失敗",
							{
								slug: item.slug,
								pageId: item.id,
								error: err instanceof Error ? err.message : String(err),
							},
						);
					}
				}),
			);
			opts?.onProgress?.(Math.min(i + concurrency, items.length), items.length);
		}

		await this.docCache.setList({ items, cachedAt: Date.now() });
		return { ok, failed };
	}

	/** 静的生成用のスラッグ一覧を返す。 */
	async getStaticSlugs(): Promise<string[]> {
		const items = await this.list();
		return items.map((item) => item.slug);
	}

	/** 指定スコープのキャッシュを無効化する。 */
	async revalidate(scope?: "all" | { slug: string }): Promise<void> {
		if (!this.docCache.invalidate) return;
		await this.docCache.invalidate(scope ?? "all");
	}

	/** Webhook ペイロードを元にキャッシュを同期する。 */
	async syncFromWebhook(payload?: {
		slug?: string;
	}): Promise<{ updated: string[] }> {
		const updated: string[] = [];

		if (payload?.slug) {
			const item = await this.find(payload.slug);
			if (item) {
				const rendered = await this.buildCachedItem(item);
				await this.docCache.setItem(item.slug, rendered);
				updated.push(item.slug);
			}
		} else {
			const result = await this.prefetchAll();
			if (result.ok > 0) {
				const items = await this.list();
				for (const item of items) updated.push(item.slug);
			}
		}

		return { updated };
	}

	// ── キャッシュ優先取得（Stale-While-Revalidate） ──────────────────────

	/** キャッシュ優先でコンテンツ一覧を返す（SWR）。 */
	private async cachedList(): Promise<{
		items: T[];
		isStale: boolean;
		cachedAt: number;
	}> {
		const cached = await this.docCache.getList();
		if (cached && !isStale(cached.cachedAt, this.ttlMs)) {
			this.hooks.onListCacheHit?.(cached.items, cached.cachedAt);
			return { items: cached.items, isStale: false, cachedAt: cached.cachedAt };
		}

		this.hooks.onListCacheMiss?.();
		const items = await this.list();
		const cachedAt = Date.now();
		const save = this.docCache.setList({ items, cachedAt });
		if (this.waitUntil) {
			this.waitUntil(save);
		} else {
			await save;
		}
		return { items, isStale: !!cached, cachedAt };
	}

	/** キャッシュ優先で単一コンテンツを返す（SWR）。 */
	private async cachedGet(slug: string): Promise<CachedItem<T> | null> {
		const cached = await this.docCache.getItem(slug);
		if (cached && !isStale(cached.cachedAt, this.ttlMs)) {
			this.hooks.onCacheHit?.(slug, cached);
			return cached;
		}

		this.hooks.onCacheMiss?.(slug);
		const item = await this.find(slug);
		if (!item) return null;
		const entry = await this.buildCachedItem(item);
		const save = this.docCache.setItem(slug, entry);
		if (this.waitUntil) {
			this.waitUntil(save);
		} else {
			await save;
		}
		return entry;
	}

	async checkListUpdate(
		version: string,
	): Promise<{ changed: false } | { changed: true; items: T[] }> {
		const items = await this.list();
		const serverVersion = buildListVersion(items);
		if (serverVersion === version) return { changed: false };
		await this.docCache.setList({ items, cachedAt: Date.now() });
		return { changed: true, items };
	}

	async checkItemUpdate(
		slug: string,
		lastEdited: string,
	): Promise<
		| { changed: false }
		| { changed: true; html: string; item: T; notionUpdatedAt: string }
	> {
		const item = await this.find(slug);
		if (!item) return { changed: false };
		if (!this.isPublished(item)) return { changed: false };
		if (item.updatedAt === lastEdited) return { changed: false };

		const entry = await this.buildCachedItem(item);
		await this.docCache.setItem(slug, entry);

		return {
			changed: true,
			html: entry.html,
			item: entry.item,
			notionUpdatedAt: entry.notionUpdatedAt,
		};
	}

	// ── 画像配信 ───────────────────────────────────────────────────────────

	/** ハッシュキーでキャッシュ画像を取得する。 */
	getCachedImage(hash: string): Promise<StorageBinary | null> {
		return this.imgCache.get(hash);
	}

	/** ハッシュキーでキャッシュ画像を Response として返す。 */
	async createCachedImageResponse(hash: string): Promise<Response | null> {
		const object = await this.imgCache.get(hash);
		if (!object) return null;
		const headers = new Headers();
		if (object.contentType) headers.set("content-type", object.contentType);
		headers.set("cache-control", "public, max-age=31536000, immutable");
		return new Response(object.data, { headers });
	}

	// ── プライベートヘルパー ────────────────────────────────────────────────

	private async buildCachedItem(item: T): Promise<CachedItem<T>> {
		const start = Date.now();
		this.logger?.info?.("コンテンツのレンダリング開始", {
			slug: item.slug,
			pageId: item.id,
		});
		this.hooks.onRenderStart?.(item.slug);

		let markdown: string;
		try {
			markdown = await this.source.loadMarkdown(item);
		} catch (err) {
			if (isCMSError(err)) throw err;
			throw new CMSError({
				code: "source/load_markdown_failed",
				message: "Failed to load markdown from source.",
				cause: err,
				context: {
					operation: "buildCachedItem:loadMarkdown",
					pageId: item.id,
					slug: item.slug,
				},
			});
		}

		const cacheImage = this.hasImageCache
			? buildCacheImageFn(this.imgCache, this.imageProxyBase)
			: undefined;

		let html: string;
		const rendererFn = this.rendererFn ?? (await loadDefaultRenderer());
		try {
			html = await rendererFn(markdown, {
				imageProxyBase: this.imageProxyBase,
				cacheImage,
				remarkPlugins: this.contentConfig?.remarkPlugins,
				rehypePlugins: this.contentConfig?.rehypePlugins,
			});
		} catch (err) {
			if (isCMSError(err)) throw err;
			throw new CMSError({
				code: "renderer/failed",
				message: "Failed to render markdown.",
				cause: err,
				context: {
					operation: "buildCachedItem:renderMarkdown",
					pageId: item.id,
					slug: item.slug,
				},
			});
		}

		// afterRender フック
		if (this.hooks.afterRender) {
			html = await this.hooks.afterRender(html, item);
		}

		let result: CachedItem<T> = {
			html,
			item,
			notionUpdatedAt: item.updatedAt,
			cachedAt: Date.now(),
		};

		// beforeCache フック
		if (this.hooks.beforeCache) {
			result = await this.hooks.beforeCache(result);
		}

		const durationMs = Date.now() - start;
		this.logger?.info?.("コンテンツのレンダリング完了", {
			slug: item.slug,
			durationMs,
		});
		this.hooks.onRenderEnd?.(item.slug, durationMs);

		return result;
	}
}

/**
 * renderer オプション未指定時のフォールバック。
 * @notion-headless-cms/renderer を動的 import する。
 * adapter-cloudflare / adapter-node は renderer を明示注入するためこのパスは通らない。
 */
async function loadDefaultRenderer(): Promise<RendererFn> {
	try {
		const mod = await import("@notion-headless-cms/renderer");
		return mod.renderMarkdown;
	} catch (err) {
		throw new CMSError({
			code: "renderer/failed",
			message:
				"renderer オプションが未指定で @notion-headless-cms/renderer が見つかりません。" +
				" createCMS({ renderer }) でレンダラーを注入するか、@notion-headless-cms/renderer をインストールしてください。",
			cause: err,
			context: { operation: "loadDefaultRenderer" },
		});
	}
}

function buildListVersion<T extends BaseContentItem>(items: T[]): string {
	return items.map((item) => `${item.id}:${item.updatedAt}`).join("|");
}

/** 設定済みの CMS インスタンスを生成するファクトリ関数。 */
export function createCMS<T extends BaseContentItem = BaseContentItem>(
	opts: CreateCMSOptions<T>,
): CMS<T> {
	return new CMS<T>(opts);
}
