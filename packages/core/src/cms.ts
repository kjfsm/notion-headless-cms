import { renderMarkdown } from "@notion-headless-cms/renderer";
import { isStale } from "./cache";
import { noopDocumentCache, noopImageCache } from "./cache/noop";
import { CMSError, isCMSError } from "./errors";
import { buildCacheImageFn } from "./image";
import type {
	BaseContentItem,
	CacheConfig,
	CachedItem,
	CachedItemList,
	CreateCMSOptions,
	DataSourceAdapter,
	DocumentCacheAdapter,
	ImageCacheAdapter,
	StorageBinary,
} from "./types/index";

const DEFAULT_IMAGE_PROXY_BASE = "/api/images";

function buildListVersion<T extends BaseContentItem>(items: T[]): string {
	return items.map((item) => `${item.id}:${item.updatedAt}`).join("|");
}

function resolveDocumentCache<T extends BaseContentItem>(
	cache: CacheConfig<T> | undefined,
): DocumentCacheAdapter<T> {
	if (!cache || cache.document === false || cache.document === undefined) {
		return noopDocumentCache<T>();
	}
	return cache.document;
}

function resolveImageCache(cache: CacheConfig | undefined): ImageCacheAdapter {
	if (!cache || cache.image === false || cache.image === undefined) {
		return noopImageCache();
	}
	return cache.image;
}

/**
 * Notion をバックエンドとして使う汎用ヘッドレス CMS クラス。
 *
 * @example
 * const cms = createCMS({
 *   source: notionAdapter({ token: '...', dataSourceId: '...' }),
 *   schema: { publishedStatuses: ['公開'] },
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
	private readonly waitUntil: ((p: Promise<unknown>) => void) | undefined;

	constructor(opts: CreateCMSOptions<T>) {
		this.source = opts.source;
		this.docCache = resolveDocumentCache(opts.cache);
		this.imgCache = resolveImageCache(opts.cache);
		this.hasImageCache = !!opts.cache?.image;
		this.ttlMs = opts.cache?.ttlMs;
		this.publishedStatuses =
			opts.schema?.publishedStatuses ??
			(opts.source.publishedStatuses ? [...opts.source.publishedStatuses] : []);
		this.accessibleStatuses =
			opts.schema?.accessibleStatuses ??
			(opts.source.accessibleStatuses ? [...opts.source.accessibleStatuses] : []);
		this.imageProxyBase =
			opts.content?.imageProxyBase ?? DEFAULT_IMAGE_PROXY_BASE;
		this.contentConfig = opts.content;
		this.waitUntil = opts.waitUntil;
	}

	// ── コンテンツ取得 ──────────────────────────────────────────────────────

	/** 公開済みコンテンツ一覧をソースから直接取得する。 */
	list(): Promise<T[]> {
		return this.source.list({
			publishedStatuses:
				this.publishedStatuses.length > 0 ? this.publishedStatuses : undefined,
		});
	}

	/** スラッグでコンテンツをソースから直接取得する。 */
	async findBySlug(slug: string): Promise<T | null> {
		const item = await this.source.findBySlug(slug);
		if (!item) return null;
		if (
			this.accessibleStatuses.length > 0 &&
			!this.accessibleStatuses.includes(item.status)
		) {
			return null;
		}
		return item;
	}

	/** アイテムが publishedStatuses に含まれるステータスかどうかを返す。 */
	isPublished(item: T): boolean {
		if (this.publishedStatuses.length === 0) return true;
		return this.publishedStatuses.includes(item.status);
	}

	/** コンテンツを Markdown → HTML にレンダリングし、CachedItem として返す。 */
	async render(item: T): Promise<CachedItem<T>> {
		return this.buildCachedItem(item);
	}

	/** スラッグでコンテンツを取得して Markdown → HTML にレンダリングする。 */
	async renderBySlug(slug: string): Promise<CachedItem<T> | null> {
		try {
			const item = await this.findBySlug(slug);
			if (!item) return null;
			return this.buildCachedItem(item);
		} catch (err) {
			if (isCMSError(err)) throw err;
			throw new CMSError({
				code: "NOTION_FETCH_ITEM_BY_SLUG_FAILED",
				message: "Failed to fetch item by slug from Notion data source.",
				cause: err,
				context: { operation: "renderBySlug", slug },
			});
		}
	}

	// ── 便利 API ───────────────────────────────────────────────────────────

	/** ステータスでフィルタリングした一覧を返す。 */
	async listByStatus(status: string | readonly string[]): Promise<T[]> {
		const statuses = Array.isArray(status) ? status : [status];
		const all = await this.source.list();
		return all.filter((item) => statuses.includes(item.status));
	}

	/** 任意の条件でフィルタリングした一覧を返す。 */
	async where(predicate: (item: T) => boolean): Promise<T[]> {
		const items = await this.list();
		return items.filter(predicate);
	}

	/** ページネーション付き一覧を返す。 */
	async paginate(opts: { page: number; perPage: number }): Promise<{
		items: T[];
		total: number;
		page: number;
		perPage: number;
		hasNext: boolean;
	}> {
		const all = await this.list();
		const total = all.length;
		const start = (opts.page - 1) * opts.perPage;
		const items = all.slice(start, start + opts.perPage);
		return {
			items,
			total,
			page: opts.page,
			perPage: opts.perPage,
			hasNext: start + opts.perPage < total,
		};
	}

	/** 指定スラッグの前後コンテンツを返す。 */
	async getAdjacent(slug: string): Promise<{ prev: T | null; next: T | null }> {
		const items = await this.list();
		const idx = items.findIndex((item) => item.slug === slug);
		if (idx === -1) return { prev: null, next: null };
		return {
			prev: idx > 0 ? items[idx - 1] : null,
			next: idx < items.length - 1 ? items[idx + 1] : null,
		};
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
					} catch {
						failed++;
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
			const item = await this.findBySlug(payload.slug);
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

	// ── キャッシュ優先取得（Stale-While-Revalidate） ─────────────────────

	/** キャッシュ優先でコンテンツ一覧を返す（SWR）。 */
	async getList(): Promise<{ items: T[]; listVersion: string }> {
		const cached = await this.docCache.getList();
		if (cached && !isStale(cached.cachedAt, this.ttlMs)) {
			return {
				items: cached.items,
				listVersion: buildListVersion(cached.items),
			};
		}

		const items = await this.list();
		const save = this.docCache.setList({ items, cachedAt: Date.now() });
		if (this.waitUntil) {
			this.waitUntil(save);
		} else {
			await save;
		}
		return { items, listVersion: buildListVersion(items) };
	}

	/** キャッシュ優先で単一コンテンツを返す（SWR）。 */
	async getItem(slug: string): Promise<CachedItem<T> | null> {
		const cached = await this.docCache.getItem(slug);
		if (cached && !isStale(cached.cachedAt, this.ttlMs)) return cached;

		const entry = await this.renderBySlug(slug);
		if (!entry) return null;

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
		const item = await this.findBySlug(slug);
		if (!item) return { changed: false };
		if (!this.isPublished(item)) return { changed: false };
		if (item.updatedAt === lastEdited) return { changed: false };

		const entry = await this.renderBySlug(slug);
		if (!entry) return { changed: false };
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
		let markdown: string;
		try {
			markdown = await this.source.loadMarkdown(item);
		} catch (err) {
			if (isCMSError(err)) throw err;
			throw new CMSError({
				code: "NOTION_MARKDOWN_FETCH_FAILED",
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
		try {
			html = await renderMarkdown(markdown, {
				imageProxyBase: this.imageProxyBase,
				cacheImage,
				remarkPlugins: this.contentConfig?.remarkPlugins,
				rehypePlugins: this.contentConfig?.rehypePlugins,
				render: this.contentConfig?.render,
			});
		} catch (err) {
			if (isCMSError(err)) throw err;
			throw new CMSError({
				code: "RENDERER_FAILED",
				message: "Failed to render markdown.",
				cause: err,
				context: {
					operation: "buildCachedItem:renderMarkdown",
					pageId: item.id,
					slug: item.slug,
				},
			});
		}

		return {
			html,
			item,
			notionUpdatedAt: item.updatedAt,
			cachedAt: Date.now(),
		};
	}
}

/** 設定済みの CMS インスタンスを生成するファクトリ関数。 */
export function createCMS<T extends BaseContentItem = BaseContentItem>(
	opts: CreateCMSOptions<T>,
): CMS<T> {
	return new CMS<T>(opts);
}
