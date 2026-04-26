import { isStale } from "./cache";
import type { ContentResult } from "./content/blocks";
import type { RenderContext } from "./rendering";
import { buildCachedItemContent, buildCachedItemMeta } from "./rendering";
import type { RetryConfig } from "./retry";
import { withRetry } from "./retry";
import type {
	AdjacencyOptions,
	BaseContentItem,
	CachedItemContent,
	CachedItemList,
	CachedItemMeta,
	CheckForUpdateResult,
	CheckListForUpdateResult,
	CMSHooks,
	CollectionClient,
	DataSource,
	DocumentCacheAdapter,
	GetListOptions,
	GetListResult,
	ItemContentPayload,
	ItemWithContent,
	Logger,
	SortOption,
} from "./types/index";

/**
 * コレクション別キャッシュキーを生成する。
 * item: `{collection}:{slug}` / list: `{collection}`
 */
export function collectionKey(collection: string, slug?: string): string {
	return slug ? `${collection}:${slug}` : collection;
}

/** 単一コレクションの DataSource + SWR キャッシュ依存を束ねたコンテキスト。 */
export interface CollectionContext<T extends BaseContentItem> {
	collection: string;
	source: DataSource<T>;
	docCache: DocumentCacheAdapter<T>;
	render: RenderContext<T>;
	hooks: CMSHooks<T>;
	logger: Logger | undefined;
	ttlMs: number | undefined;
	publishedStatuses: string[];
	accessibleStatuses: string[];
	retryConfig: RetryConfig;
	maxConcurrent: number;
	waitUntil: ((p: Promise<unknown>) => void) | undefined;
	/**
	 * slug として使うフィールド名。
	 * `createCMS({ collections })` で指定した値。
	 * 設定時は `source.properties[slugField].notion` を Notion プロパティ名として
	 * `findByProp` を呼び出す。
	 */
	slugField?: string;
}

/** CollectionClient の実装。ユーザーは `createCMS` 経由でインスタンスを受け取る。 */
export class CollectionClientImpl<T extends BaseContentItem>
	implements CollectionClient<T>
{
	constructor(private readonly ctx: CollectionContext<T>) {}

	// ── 基本取得 ──────────────────────────────────────────────────────────

	async getItem(slug: string): Promise<ItemWithContent<T> | null> {
		const cachedMeta = await this.ctx.docCache.getItemMeta(slug);
		if (cachedMeta) {
			if (
				this.ctx.ttlMs !== undefined &&
				isStale(cachedMeta.cachedAt, this.ctx.ttlMs)
			) {
				// TTL 設定あり + 期限切れ: ブロッキングでメタを最新化
				this.ctx.logger?.debug?.("キャッシュ期限切れ（TTL）、フェッチ", {
					operation: "getItem",
					slug,
					collection: this.ctx.collection,
					cacheAdapter: this.ctx.docCache.name,
				});
				this.ctx.hooks.onCacheMiss?.(slug);
				const item = await this.findRaw(slug);
				if (!item) return null;
				const meta = await this.persistMeta(slug, item);
				// 本文 cache は失効させ、次回 content.* アクセスで lazy 再生成
				await this.invalidateContent(slug);
				return this.attachLazyContent(meta);
			}
			// TTL 未設定 or 期限内: キャッシュを即時返却 + バックグラウンド差分チェック
			const bg = this.checkAndUpdateItemBg(slug, cachedMeta);
			if (this.ctx.waitUntil) {
				this.ctx.waitUntil(bg);
			}
			this.ctx.logger?.debug?.("キャッシュヒット", {
				operation: "getItem",
				slug,
				collection: this.ctx.collection,
				cacheAdapter: this.ctx.docCache.name,
				cachedAt: cachedMeta.cachedAt,
			});
			this.ctx.hooks.onCacheHit?.(slug, cachedMeta);
			return this.attachLazyContent(cachedMeta);
		}

		// メタ未キャッシュ: 同期フェッチ（保存はバックグラウンド可）
		this.ctx.logger?.debug?.("キャッシュミス、フェッチ", {
			operation: "getItem",
			slug,
			collection: this.ctx.collection,
			cacheAdapter: this.ctx.docCache.name,
		});
		this.ctx.hooks.onCacheMiss?.(slug);
		const item = await this.findRaw(slug);
		if (!item) {
			this.ctx.logger?.debug?.("アイテムが見つかりません", {
				operation: "getItem",
				slug,
				collection: this.ctx.collection,
			});
			return null;
		}
		const meta = await this.persistMeta(slug, item, { background: true });
		return this.attachLazyContent(meta);
	}

	async getItemMeta(slug: string): Promise<T | null> {
		const cachedMeta = await this.ctx.docCache.getItemMeta(slug);
		if (cachedMeta) {
			if (
				this.ctx.ttlMs !== undefined &&
				isStale(cachedMeta.cachedAt, this.ctx.ttlMs)
			) {
				const item = await this.findRaw(slug);
				if (!item) return null;
				const meta = await this.persistMeta(slug, item);
				await this.invalidateContent(slug);
				return meta.item;
			}
			// SWR: キャッシュ即時返却 + バックグラウンド差分チェック
			const bg = this.checkAndUpdateItemBg(slug, cachedMeta);
			if (this.ctx.waitUntil) this.ctx.waitUntil(bg);
			this.ctx.hooks.onCacheHit?.(slug, cachedMeta);
			return cachedMeta.item;
		}
		// キャッシュなし: 同期フェッチして保存
		this.ctx.hooks.onCacheMiss?.(slug);
		const item = await this.findRaw(slug);
		if (!item) return null;
		const meta = await this.persistMeta(slug, item, { background: true });
		return meta.item;
	}

	async getItemContent(slug: string): Promise<ItemContentPayload | null> {
		const meta = await this.ctx.docCache.getItemMeta(slug);
		const item = meta?.item ?? (await this.findRaw(slug));
		if (!item) return null;

		// メタが未保存なら今フェッチした item で永続化（content と整合させる）
		if (!meta) {
			await this.persistMeta(slug, item);
		}

		const content = await this.loadOrBuildContent(slug, item);
		return toContentPayload(content);
	}

	async getList(opts?: GetListOptions<T>): Promise<GetListResult<T>> {
		const allItems = await this.fetchList();
		const items = applyGetListOptions(allItems, opts);
		const version = this.ctx.source.getListVersion(items);
		return { items, version };
	}

	// ── SSG / ナビゲーション ─────────────────────────────────────────────

	async getStaticParams(): Promise<{ slug: string }[]> {
		const items = await this.fetchList();
		return items.map((item) => ({ slug: item.slug }));
	}

	async getStaticPaths(): Promise<string[]> {
		const items = await this.fetchList();
		return items.map((item) => item.slug);
	}

	async adjacent(
		slug: string,
		opts?: AdjacencyOptions<T>,
	): Promise<{ prev: T | null; next: T | null }> {
		const items = applyGetListOptions(await this.fetchList(), {
			sort: opts?.sort,
		});
		const index = items.findIndex((it) => it.slug === slug);
		if (index === -1) return { prev: null, next: null };
		return {
			prev: index > 0 ? (items[index - 1] ?? null) : null,
			next: index < items.length - 1 ? (items[index + 1] ?? null) : null,
		};
	}

	// ── キャッシュ ────────────────────────────────────────────────────────

	async revalidate(slug: string): Promise<void> {
		this.ctx.logger?.debug?.("アイテムキャッシュを無効化", {
			operation: "revalidate",
			collection: this.ctx.collection,
			cacheAdapter: this.ctx.docCache.name,
			slug,
		});
		if (!this.ctx.docCache.invalidate) return;
		await this.ctx.docCache.invalidate({
			collection: this.ctx.collection,
			slug,
		});
	}

	async revalidateAll(): Promise<void> {
		this.ctx.logger?.debug?.("コレクション全体のキャッシュを無効化", {
			operation: "revalidateAll",
			collection: this.ctx.collection,
			cacheAdapter: this.ctx.docCache.name,
		});
		if (!this.ctx.docCache.invalidate) return;
		await this.ctx.docCache.invalidate({ collection: this.ctx.collection });
	}

	async checkForUpdate({
		slug,
		since,
	}: {
		slug: string;
		since: string;
	}): Promise<CheckForUpdateResult<T>> {
		// 軽量パス: メタのみフェッチして比較する。本文 cache は破棄しない。
		const fresh = await this.findRaw(slug);
		if (!fresh) return { changed: false };

		const lm = this.ctx.source.getLastModified(fresh);
		if (lm === since) {
			this.ctx.logger?.debug?.("checkForUpdate: 差分なし", {
				operation: "checkForUpdate",
				slug,
				collection: this.ctx.collection,
				since,
			});
			return { changed: false };
		}

		// 差分あり: メタ更新 + 本文 cache 失効 + バックグラウンド再生成
		const meta = await this.persistMeta(slug, fresh);
		await this.invalidateContent(slug);
		this.ctx.hooks.onCacheRevalidated?.(slug, meta);
		this.ctx.logger?.debug?.("checkForUpdate: 差分を検出", {
			operation: "checkForUpdate",
			slug,
			collection: this.ctx.collection,
			since,
			notionUpdatedAt: lm,
		});

		const bg = this.rebuildContentBg(slug, fresh);
		if (this.ctx.waitUntil) {
			this.ctx.waitUntil(bg);
		}
		// クライアント側で `mutate(contentKey)` を呼ぶ前提のため、
		// content の完了を待たずに即時返す
		return { changed: true, meta: fresh };
	}

	async checkListForUpdate({
		since,
		filter,
	}: {
		since: string;
		filter?: GetListOptions<T>;
	}): Promise<CheckListForUpdateResult<T>> {
		const allItems = await this.fetchListRaw();
		const items = applyGetListOptions(allItems, filter);
		const version = this.ctx.source.getListVersion(items);
		if (version === since) return { changed: false };
		// 差分あり: リストのみ書き換え（個別アイテムの本文 cache は触らない）
		await this.ctx.docCache.setList({
			items: allItems,
			cachedAt: Date.now(),
		});
		return { changed: true, items, version };
	}

	async prefetch(opts?: {
		concurrency?: number;
		onProgress?: (done: number, total: number) => void;
	}): Promise<{ ok: number; failed: number }> {
		const items = await this.fetchListRaw();
		const concurrency = opts?.concurrency ?? this.ctx.maxConcurrent;
		let ok = 0;
		let failed = 0;

		for (let i = 0; i < items.length; i += concurrency) {
			const chunk = items.slice(i, i + concurrency);
			await Promise.all(
				chunk.map(async (item) => {
					try {
						await this.persistMeta(item.slug, item);
						const content = await buildCachedItemContent(item, this.ctx.render);
						await this.ctx.docCache.setItemContent(item.slug, content);
						ok++;
					} catch (err) {
						failed++;
						this.ctx.logger?.warn?.(
							"prefetch: アイテムの事前レンダリングに失敗",
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

		await this.ctx.docCache.setList({ items, cachedAt: Date.now() });
		return { ok, failed };
	}

	// ── 内部 ──────────────────────────────────────────────────────────────

	private async persistMeta(
		slug: string,
		item: T,
		opts: { background?: boolean } = {},
	): Promise<CachedItemMeta<T>> {
		let meta = buildCachedItemMeta(item, this.ctx.source);
		if (this.ctx.hooks.beforeCacheMeta) {
			meta = await this.ctx.hooks.beforeCacheMeta(meta);
		}
		const save = this.ctx.docCache.setItemMeta(slug, meta);
		if (opts.background && this.ctx.waitUntil) {
			this.ctx.waitUntil(save);
		} else {
			await save;
		}
		return meta;
	}

	private async invalidateContent(slug: string): Promise<void> {
		if (!this.ctx.docCache.invalidate) return;
		await this.ctx.docCache.invalidate({
			collection: this.ctx.collection,
			slug,
			kind: "content",
		});
	}

	/**
	 * 本文キャッシュをロードする。キャッシュが無いか、メタとの整合性が取れない場合は
	 * 再生成して書き戻す。
	 */
	private async loadOrBuildContent(
		slug: string,
		item: T,
	): Promise<CachedItemContent> {
		const expected = this.ctx.source.getLastModified(item);
		const cached = await this.ctx.docCache.getItemContent(slug);
		if (cached && cached.notionUpdatedAt === expected) return cached;

		const fresh = await buildCachedItemContent(item, this.ctx.render);
		await this.ctx.docCache.setItemContent(slug, fresh);
		this.ctx.hooks.onContentRevalidated?.(slug, fresh);
		return fresh;
	}

	/**
	 * メタは既知（差分検出済み or 直前にフェッチ済み）の状態で本文だけ
	 * バックグラウンド再生成する。エラーは握りつぶしてログのみ。
	 */
	private async rebuildContentBg(slug: string, item: T): Promise<void> {
		try {
			const fresh = await buildCachedItemContent(item, this.ctx.render);
			await this.ctx.docCache.setItemContent(slug, fresh);
			this.ctx.hooks.onContentRevalidated?.(slug, fresh);
		} catch (err) {
			this.ctx.logger?.warn?.("本文のバックグラウンド再生成に失敗", {
				slug,
				collection: this.ctx.collection,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	private attachLazyContent(meta: CachedItemMeta<T>): ItemWithContent<T> {
		const slug = meta.item.slug;
		const item = meta.item;
		// 同一インスタンス内で本文ロードを一度に集約する（複数アクセスでも 1 回の I/O）
		let payloadPromise: Promise<CachedItemContent> | undefined;
		const loadPayload = (): Promise<CachedItemContent> => {
			if (!payloadPromise) {
				payloadPromise = this.loadOrBuildContent(slug, item);
			}
			return payloadPromise;
		};

		const content: ContentResult = {
			async blocks() {
				return (await loadPayload()).blocks;
			},
			async html() {
				return (await loadPayload()).html;
			},
			async markdown() {
				return (await loadPayload()).markdown;
			},
		};

		return Object.assign(Object.create(null) as object, item, {
			content,
		}) as ItemWithContent<T>;
	}

	private async fetchList(): Promise<T[]> {
		const cached = await this.ctx.docCache.getList();
		if (cached) {
			if (
				this.ctx.ttlMs !== undefined &&
				isStale(cached.cachedAt, this.ctx.ttlMs)
			) {
				// TTL 設定あり + 期限切れ: ブロッキングフェッチ
				this.ctx.logger?.debug?.("リストキャッシュ期限切れ（TTL）、フェッチ", {
					operation: "getList",
					collection: this.ctx.collection,
					cacheAdapter: this.ctx.docCache.name,
				});
				this.ctx.hooks.onListCacheMiss?.();
				const items = await this.fetchListRaw();
				await this.ctx.docCache.setList({ items, cachedAt: Date.now() });
				return items;
			}
			// TTL 未設定 or 期限内: キャッシュを即時返却 + バックグラウンド差分チェック
			const bg = this.checkAndUpdateListBg(cached);
			if (this.ctx.waitUntil) {
				this.ctx.waitUntil(bg);
			}
			this.ctx.logger?.debug?.("リストキャッシュヒット", {
				operation: "getList",
				collection: this.ctx.collection,
				cacheAdapter: this.ctx.docCache.name,
			});
			this.ctx.hooks.onListCacheHit?.(cached);
			return cached.items;
		}

		// キャッシュなし: 同期フェッチ
		this.ctx.logger?.debug?.("リストキャッシュミス、フェッチ", {
			operation: "getList",
			collection: this.ctx.collection,
			cacheAdapter: this.ctx.docCache.name,
		});
		this.ctx.hooks.onListCacheMiss?.();
		const items = await this.fetchListRaw();
		const cachedAt = Date.now();
		const save = this.ctx.docCache.setList({ items, cachedAt });
		if (this.ctx.waitUntil) {
			this.ctx.waitUntil(save);
		} else {
			await save;
		}
		return items;
	}

	private async checkAndUpdateItemBg(
		slug: string,
		cached: CachedItemMeta<T>,
	): Promise<void> {
		try {
			const item = await this.findRaw(slug);
			if (!item) return;
			const lm = this.ctx.source.getLastModified(item);
			if (lm !== cached.notionUpdatedAt) {
				const meta = await this.persistMeta(slug, item);
				await this.invalidateContent(slug);
				this.ctx.logger?.debug?.("SWR: 差分を検出、メタを差し替え", {
					operation: "getItem:bg",
					slug,
					collection: this.ctx.collection,
					notionUpdatedAt: cached.notionUpdatedAt,
				});
				this.ctx.hooks.onCacheRevalidated?.(slug, meta);
				// 本文も即時再生成（クライアントは `mutate(contentKey)` で取得可能になる）
				await this.rebuildContentBg(slug, item);
			} else if (this.ctx.ttlMs !== undefined) {
				// 変更なし + TTL あり: cachedAt をリセットして次回の期限切れを先送りする
				await this.ctx.docCache.setItemMeta(slug, {
					...cached,
					cachedAt: Date.now(),
				});
				this.ctx.logger?.debug?.("SWR: 差分なし、TTL をリセット", {
					operation: "getItem:bg",
					slug,
					collection: this.ctx.collection,
				});
			}
		} catch (err) {
			this.ctx.logger?.warn?.(
				"SWR: アイテムのバックグラウンド差分チェックに失敗",
				{
					slug,
					collection: this.ctx.collection,
					error: err instanceof Error ? err.message : String(err),
				},
			);
		}
	}

	private async checkAndUpdateListBg(cached: CachedItemList<T>): Promise<void> {
		try {
			const items = await this.fetchListRaw();
			if (
				this.ctx.source.getListVersion(items) !==
				this.ctx.source.getListVersion(cached.items)
			) {
				// 更新あり: リストを差し替える（個別アイテムの本文 cache は触らない）
				const listEntry = { items, cachedAt: Date.now() };
				await this.ctx.docCache.setList(listEntry);
				this.ctx.logger?.debug?.(
					"SWR: リスト差分を検出、キャッシュを差し替え",
					{
						operation: "getList:bg",
						collection: this.ctx.collection,
					},
				);
				this.ctx.hooks.onListCacheRevalidated?.(listEntry);
			} else if (this.ctx.ttlMs !== undefined) {
				// 変更なし + TTL あり: cachedAt をリセットする
				await this.ctx.docCache.setList({
					...cached,
					cachedAt: Date.now(),
				});
				this.ctx.logger?.debug?.("SWR: リスト差分なし、TTL をリセット", {
					operation: "getList:bg",
					collection: this.ctx.collection,
				});
			}
		} catch (err) {
			this.ctx.logger?.warn?.(
				"SWR: リストのバックグラウンド差分チェックに失敗",
				{
					collection: this.ctx.collection,
					error: err instanceof Error ? err.message : String(err),
				},
			);
		}
	}

	private fetchListRaw(): Promise<T[]> {
		return withRetry(
			() =>
				this.ctx.source.list({
					publishedStatuses:
						this.ctx.publishedStatuses.length > 0
							? this.ctx.publishedStatuses
							: undefined,
				}),
			{
				...this.ctx.retryConfig,
				onRetry: (attempt, status) => {
					this.ctx.logger?.warn?.("getList() リトライ中", { attempt, status });
				},
			},
		);
	}

	private async findRaw(slug: string): Promise<T | null> {
		const retryOpts = {
			...this.ctx.retryConfig,
			onRetry: (attempt: number, status: number) => {
				this.ctx.logger?.warn?.("getItem() リトライ中", {
					attempt,
					status,
					slug,
				});
			},
		};

		// slug フィールドが指定され、DataSource が findByProp を持つ場合は
		// Notion プロパティ名を解決して効率的なフィルタクエリを実行する。
		const slugField = this.ctx.slugField;
		const notionPropName = slugField
			? this.ctx.source.properties?.[slugField]?.notion
			: undefined;

		let item: T | null;
		const findByProp = this.ctx.source.findByProp?.bind(this.ctx.source);
		if (notionPropName && findByProp) {
			item = await withRetry(() => findByProp(notionPropName, slug), retryOpts);
		} else {
			// フォールバック: list して線形探索
			const all = await withRetry(() => this.ctx.source.list(), retryOpts);
			item = all.find((i) => i.slug === slug) ?? null;
		}

		if (!item) return null;
		if (
			this.ctx.accessibleStatuses.length > 0 &&
			(!item.status || !this.ctx.accessibleStatuses.includes(item.status))
		) {
			return null;
		}
		return item;
	}
}

function toContentPayload(c: CachedItemContent): ItemContentPayload {
	return {
		html: c.html,
		markdown: c.markdown,
		blocks: c.blocks,
		notionUpdatedAt: c.notionUpdatedAt,
	};
}

function applyGetListOptions<T extends BaseContentItem>(
	items: T[],
	opts?: GetListOptions<T>,
): T[] {
	if (!opts) return items;
	let result = items;

	if (opts.statuses && opts.statuses.length > 0) {
		const allow = new Set(opts.statuses);
		result = result.filter(
			(it) => it.status !== undefined && allow.has(it.status),
		);
	}

	if (opts.tag) {
		const tag = opts.tag;
		result = result.filter((it) => {
			const tags = (it as unknown as { tags?: unknown }).tags;
			return Array.isArray(tags) && tags.includes(tag);
		});
	}

	if (opts.where) {
		const where = opts.where;
		result = result.filter((it) =>
			Object.entries(where).every(
				([key, value]) => (it as Record<string, unknown>)[key] === value,
			),
		);
	}

	if (opts.sort) {
		result = [...result].sort(makeComparator(opts.sort));
	}

	const skip = opts.skip ?? 0;
	const limit = opts.limit;
	if (skip > 0 || limit !== undefined) {
		result = result.slice(skip, limit !== undefined ? skip + limit : undefined);
	}

	return result;
}

function makeComparator<T extends BaseContentItem>(
	sort: SortOption<T>,
): (a: T, b: T) => number {
	const by = sort.by;
	const dir = sort.direction === "asc" ? 1 : -1;
	return (a, b) => {
		const av = (a as Record<string, unknown>)[by];
		const bv = (b as Record<string, unknown>)[by];
		if (av === bv) return 0;
		if (av === undefined) return 1;
		if (bv === undefined) return -1;
		// biome-ignore lint/suspicious/noExplicitAny: 汎用比較
		return (av as any) > (bv as any) ? dir : -dir;
	};
}
