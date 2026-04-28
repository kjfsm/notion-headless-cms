import { isStale } from "./cache";
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
	CheckResult,
	CMSHooks,
	CollectionCacheOps,
	CollectionClient,
	DataSource,
	DocumentCacheOps,
	GetOptions,
	ItemWithRender,
	ListOptions,
	Logger,
	SortOption,
	WarmOptions,
} from "./types/index";

/**
 * コレクション別キャッシュキーを生成する。
 * item: `{collection}:{slug}` / list: `{collection}`
 *
 * (Cache adapter 内部のキー戦略はアダプタごとに異なるが、
 * 表示や再計算用に core 側でも公開ヘルパーを提供する)
 */
export function collectionKey(collection: string, slug?: string): string {
	return slug ? `${collection}:${slug}` : collection;
}

/** 単一コレクションの DataSource + SWR キャッシュ依存を束ねたコンテキスト。 */
export interface CollectionContext<T extends BaseContentItem> {
	collection: string;
	source: DataSource<T>;
	docCache: DocumentCacheOps;
	docCacheName: string;
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
	 * slug として使うフィールド名 (CLI 生成の `CollectionDef.slugField`)。
	 * `source.properties[slugField].notion` を Notion プロパティ名として
	 * `findByProp` を呼び出す。
	 */
	slugField: string;
}

/** CollectionClient の実装。ユーザーは `createCMS` 経由でインスタンスを受け取る。 */
export class CollectionClientImpl<T extends BaseContentItem>
	implements CollectionClient<T>
{
	readonly cache: CollectionCacheOps<T>;

	constructor(private readonly ctx: CollectionContext<T>) {
		this.cache = {
			invalidate: (slug?: string) => this.invalidateImpl(slug),
			warm: (opts?: WarmOptions) => this.warmImpl(opts),
			adjacent: (slug, opts) => this.adjacentImpl(slug, opts),
		};
	}

	// ── 基本取得 ──────────────────────────────────────────────────────────

	async get(
		slug: string,
		opts: GetOptions = {},
	): Promise<ItemWithRender<T> | null> {
		// fresh: 強制ブロッキング取得
		if (opts.fresh) {
			this.ctx.hooks.onCacheMiss?.(slug);
			const item = await this.findRaw(slug);
			if (!item) return null;
			const meta = await this.persistMeta(slug, item);
			await this.invalidateContent(slug);
			return this.attachLazyContent(meta);
		}

		const cachedMeta = await this.ctx.docCache.getMeta<T>(
			this.ctx.collection,
			slug,
		);
		if (cachedMeta) {
			if (
				this.ctx.ttlMs !== undefined &&
				isStale(cachedMeta.cachedAt, this.ctx.ttlMs)
			) {
				// TTL 切れ: ブロッキング再取得
				this.ctx.logger?.debug?.("キャッシュ期限切れ（TTL）、フェッチ", {
					operation: "get",
					slug,
					collection: this.ctx.collection,
					cacheAdapter: this.ctx.docCacheName,
				});
				this.ctx.hooks.onCacheMiss?.(slug);
				const item = await this.findRaw(slug);
				if (!item) return null;
				const meta = await this.persistMeta(slug, item);
				await this.invalidateContent(slug);
				return this.attachLazyContent(meta);
			}
			// SWR: キャッシュ即時返却 + バックグラウンド差分チェック
			const bg = this.checkAndUpdateItemBg(slug, cachedMeta);
			if (this.ctx.waitUntil) this.ctx.waitUntil(bg);
			this.ctx.logger?.debug?.("キャッシュヒット", {
				operation: "get",
				slug,
				collection: this.ctx.collection,
				cacheAdapter: this.ctx.docCacheName,
				cachedAt: cachedMeta.cachedAt,
			});
			this.ctx.hooks.onCacheHit?.(slug, cachedMeta);
			return this.attachLazyContent(cachedMeta);
		}

		// メタ未キャッシュ: 同期フェッチ (保存はバックグラウンド可)
		this.ctx.logger?.debug?.("キャッシュミス、フェッチ", {
			operation: "get",
			slug,
			collection: this.ctx.collection,
			cacheAdapter: this.ctx.docCacheName,
		});
		this.ctx.hooks.onCacheMiss?.(slug);
		const item = await this.findRaw(slug);
		if (!item) return null;
		const meta = await this.persistMeta(slug, item, { background: true });
		return this.attachLazyContent(meta);
	}

	async list(opts?: ListOptions<T>): Promise<T[]> {
		const allItems = await this.fetchList();
		return applyListOptions(allItems, opts);
	}

	async params(): Promise<{ slug: string }[]> {
		const items = await this.fetchList();
		return items.map((item) => ({ slug: item.slug }));
	}

	async check(
		slug: string,
		currentVersion: string,
	): Promise<CheckResult<T> | null> {
		const raw = await this.findRaw(slug);
		if (!raw) return null;
		if (raw.updatedAt === currentVersion) return { stale: false };
		const meta = await this.persistMeta(slug, raw);
		await this.invalidateContent(slug);
		return { stale: true, item: this.attachLazyContent(meta) };
	}

	// ── キャッシュ操作 ────────────────────────────────────────────────────

	private async invalidateImpl(slug?: string): Promise<void> {
		if (slug !== undefined) {
			this.ctx.logger?.debug?.("アイテムキャッシュを無効化", {
				operation: "cache.invalidate",
				collection: this.ctx.collection,
				cacheAdapter: this.ctx.docCacheName,
				slug,
			});
			await this.ctx.docCache.invalidate({
				collection: this.ctx.collection,
				slug,
			});
			return;
		}
		this.ctx.logger?.debug?.("コレクション全体のキャッシュを無効化", {
			operation: "cache.invalidate",
			collection: this.ctx.collection,
			cacheAdapter: this.ctx.docCacheName,
		});
		await this.ctx.docCache.invalidate({ collection: this.ctx.collection });
	}

	private async warmImpl(
		opts?: WarmOptions,
	): Promise<{ ok: number; failed: number }> {
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
						await this.ctx.docCache.setContent(
							this.ctx.collection,
							item.slug,
							content,
						);
						ok++;
					} catch (err) {
						failed++;
						this.ctx.logger?.warn?.("warm: アイテムの事前レンダリングに失敗", {
							slug: item.slug,
							pageId: item.id,
							error: err instanceof Error ? err.message : String(err),
						});
					}
				}),
			);
			opts?.onProgress?.(Math.min(i + concurrency, items.length), items.length);
		}

		await this.ctx.docCache.setList(this.ctx.collection, {
			items,
			cachedAt: Date.now(),
		});
		return { ok, failed };
	}

	private async adjacentImpl(
		slug: string,
		opts?: AdjacencyOptions<T>,
	): Promise<{ prev: T | null; next: T | null }> {
		const items = applyListOptions(await this.fetchList(), {
			sort: opts?.sort,
		});
		const index = items.findIndex((it) => it.slug === slug);
		if (index === -1) return { prev: null, next: null };
		return {
			prev: index > 0 ? (items[index - 1] ?? null) : null,
			next: index < items.length - 1 ? (items[index + 1] ?? null) : null,
		};
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
		const save = this.ctx.docCache.setMeta(this.ctx.collection, slug, meta);
		if (opts.background && this.ctx.waitUntil) {
			this.ctx.waitUntil(save);
		} else {
			await save;
		}
		return meta;
	}

	private async invalidateContent(slug: string): Promise<void> {
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
		const cached = await this.ctx.docCache.getContent(
			this.ctx.collection,
			slug,
		);
		if (cached && cached.notionUpdatedAt === expected) return cached;

		const fresh = await buildCachedItemContent(item, this.ctx.render);
		await this.ctx.docCache.setContent(this.ctx.collection, slug, fresh);
		this.ctx.hooks.onContentRevalidated?.(slug, fresh);
		return fresh;
	}

	/** メタ既知の状態で本文だけバックグラウンド再生成する。エラーは握りつぶす。 */
	private async rebuildContentBg(slug: string, item: T): Promise<void> {
		try {
			const fresh = await buildCachedItemContent(item, this.ctx.render);
			await this.ctx.docCache.setContent(this.ctx.collection, slug, fresh);
			this.ctx.hooks.onContentRevalidated?.(slug, fresh);
		} catch (err) {
			this.ctx.logger?.warn?.("本文のバックグラウンド再生成に失敗", {
				slug,
				collection: this.ctx.collection,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	private attachLazyContent(meta: CachedItemMeta<T>): ItemWithRender<T> {
		const slug = meta.item.slug;
		const item = meta.item;
		// 同一インスタンス内で本文ロードを集約する (複数 render() でも 1 回の I/O)
		let payloadPromise: Promise<CachedItemContent> | undefined;
		const loadPayload = (): Promise<CachedItemContent> => {
			if (!payloadPromise) {
				payloadPromise = this.loadOrBuildContent(slug, item);
			}
			return payloadPromise;
		};

		const render = async (opts?: {
			format?: "html" | "markdown";
		}): Promise<string> => {
			const payload = await loadPayload();
			return opts?.format === "markdown" ? payload.markdown : payload.html;
		};

		return Object.assign(Object.create(null) as object, item, {
			render,
		}) as ItemWithRender<T>;
	}

	private async fetchList(): Promise<T[]> {
		const cached = await this.ctx.docCache.getList<T>(this.ctx.collection);
		if (cached) {
			if (
				this.ctx.ttlMs !== undefined &&
				isStale(cached.cachedAt, this.ctx.ttlMs)
			) {
				// TTL 切れ: ブロッキング再取得
				this.ctx.logger?.debug?.("リストキャッシュ期限切れ（TTL）、フェッチ", {
					operation: "list",
					collection: this.ctx.collection,
					cacheAdapter: this.ctx.docCacheName,
				});
				this.ctx.hooks.onListCacheMiss?.();
				const items = await this.fetchListRaw();
				await this.ctx.docCache.setList(this.ctx.collection, {
					items,
					cachedAt: Date.now(),
				});
				return items;
			}
			// SWR: 即時返却 + バックグラウンド差分チェック
			const bg = this.checkAndUpdateListBg(cached);
			if (this.ctx.waitUntil) this.ctx.waitUntil(bg);
			this.ctx.logger?.debug?.("リストキャッシュヒット", {
				operation: "list",
				collection: this.ctx.collection,
				cacheAdapter: this.ctx.docCacheName,
			});
			this.ctx.hooks.onListCacheHit?.(cached);
			return cached.items;
		}

		// 未キャッシュ: 同期フェッチ
		this.ctx.logger?.debug?.("リストキャッシュミス、フェッチ", {
			operation: "list",
			collection: this.ctx.collection,
			cacheAdapter: this.ctx.docCacheName,
		});
		this.ctx.hooks.onListCacheMiss?.();
		const items = await this.fetchListRaw();
		const cachedAt = Date.now();
		const save = this.ctx.docCache.setList(this.ctx.collection, {
			items,
			cachedAt,
		});
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
					operation: "get:bg",
					slug,
					collection: this.ctx.collection,
					notionUpdatedAt: cached.notionUpdatedAt,
				});
				this.ctx.hooks.onCacheRevalidated?.(slug, meta);
				await this.rebuildContentBg(slug, item);
			} else if (this.ctx.ttlMs !== undefined) {
				// 変更なし + TTL あり: cachedAt をリセットして次回の期限切れを先送りする
				await this.ctx.docCache.setMeta(this.ctx.collection, slug, {
					...cached,
					cachedAt: Date.now(),
				});
				this.ctx.logger?.debug?.("SWR: 差分なし、TTL をリセット", {
					operation: "get:bg",
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
				const listEntry = { items, cachedAt: Date.now() };
				await this.ctx.docCache.setList(this.ctx.collection, listEntry);
				this.ctx.logger?.debug?.(
					"SWR: リスト差分を検出、キャッシュを差し替え",
					{
						operation: "list:bg",
						collection: this.ctx.collection,
					},
				);
				this.ctx.hooks.onListCacheRevalidated?.(listEntry);
			} else if (this.ctx.ttlMs !== undefined) {
				await this.ctx.docCache.setList(this.ctx.collection, {
					...cached,
					cachedAt: Date.now(),
				});
				this.ctx.logger?.debug?.("SWR: リスト差分なし、TTL をリセット", {
					operation: "list:bg",
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
					this.ctx.logger?.warn?.("list() リトライ中", { attempt, status });
				},
			},
		);
	}

	private async findRaw(slug: string): Promise<T | null> {
		const retryOpts = {
			...this.ctx.retryConfig,
			onRetry: (attempt: number, status: number) => {
				this.ctx.logger?.warn?.("get() リトライ中", {
					attempt,
					status,
					slug,
				});
			},
		};

		// slugField から Notion プロパティ名を解決して効率的なフィルタクエリを実行する。
		const notionPropName =
			this.ctx.source.properties?.[this.ctx.slugField]?.notion;

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

function applyListOptions<T extends BaseContentItem>(
	items: T[],
	opts?: ListOptions<T>,
): T[] {
	if (!opts) return items;
	let result = items;

	if (opts.status) {
		const allow = new Set(
			Array.isArray(opts.status) ? opts.status : [opts.status],
		);
		result = result.filter((it) => it.status != null && allow.has(it.status));
	}

	if (opts.tag) {
		const tag = opts.tag;
		result = result.filter((it) => {
			const tags = (it as { tags?: string[] }).tags;
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
	const dir = sort.dir === "asc" ? 1 : -1;
	return (a, b) => {
		const av = (a as Record<string, unknown>)[by];
		const bv = (b as Record<string, unknown>)[by];
		if (av === bv) return 0;
		if (av === undefined) return 1;
		if (bv === undefined) return -1;
		return (av as string | number) > (bv as string | number) ? dir : -dir;
	};
}
