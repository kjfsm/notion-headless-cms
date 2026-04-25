import { isStale } from "./cache";
import type { ContentBlock, ContentResult } from "./content/blocks";
import type { RenderContext } from "./rendering";
import { buildCachedItem } from "./rendering";
import type { RetryConfig } from "./retry";
import { withRetry } from "./retry";
import type {
	AdjacencyOptions,
	BaseContentItem,
	CachedItem,
	CachedItemList,
	CMSHooks,
	CollectionClient,
	DataSource,
	DocumentCacheAdapter,
	GetListOptions,
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
		const cached = await this.ctx.docCache.getItem(slug);
		if (cached) {
			if (
				this.ctx.ttlMs !== undefined &&
				isStale(cached.cachedAt, this.ctx.ttlMs)
			) {
				// TTL 設定あり + 期限切れ: ブロッキングフェッチ（stale を返さない）
				this.ctx.hooks.onCacheMiss?.(slug);
				const item = await this.findRaw(slug);
				if (!item) return null;
				const entry = await buildCachedItem(item, this.ctx.render);
				await this.ctx.docCache.setItem(slug, entry);
				return this.attachContent(entry.item, entry);
			}
			// TTL 未設定 or 期限内: キャッシュを即時返却し、バックグラウンドで差分チェック
			const bg = this.checkAndUpdateItemBg(slug, cached);
			if (this.ctx.waitUntil) {
				this.ctx.waitUntil(bg);
			}
			this.ctx.hooks.onCacheHit?.(slug, cached);
			return this.attachContent(cached.item, cached);
		}

		// キャッシュなし: 同期フェッチ
		this.ctx.hooks.onCacheMiss?.(slug);
		const item = await this.findRaw(slug);
		if (!item) return null;

		const entry = await buildCachedItem(item, this.ctx.render);
		const save = this.ctx.docCache.setItem(slug, entry);
		if (this.ctx.waitUntil) {
			this.ctx.waitUntil(save);
		} else {
			await save;
		}

		return this.attachContent(entry.item, entry);
	}

	async getList(opts?: GetListOptions<T>): Promise<T[]> {
		const items = await this.fetchList();
		return applyGetListOptions(items, opts);
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

	async revalidate(scope?: "all" | { slug: string }): Promise<void> {
		if (!this.ctx.docCache.invalidate) return;
		if (scope === undefined || scope === "all") {
			await this.ctx.docCache.invalidate({ collection: this.ctx.collection });
		} else {
			await this.ctx.docCache.invalidate({
				collection: this.ctx.collection,
				slug: scope.slug,
			});
		}
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
						const rendered = await buildCachedItem(item, this.ctx.render);
						await this.ctx.docCache.setItem(item.slug, rendered);
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

	private attachContent(item: T, cached: CachedItem<T>): ItemWithContent<T> {
		const ctx = this.ctx;
		let blocksCache: ContentBlock[] | undefined;
		let htmlCache: string | undefined = cached.html;
		let markdownCache: string | undefined;

		const content: ContentResult = {
			get blocks(): ContentBlock[] {
				if (!blocksCache) {
					// lazy: キャッシュに blocks が保存されていない場合、簡易な single-raw に落とす
					blocksCache = [
						{ type: "raw", html: cached.html } satisfies ContentBlock,
					];
				}
				return blocksCache;
			},
			async html(): Promise<string> {
				if (htmlCache !== undefined) return htmlCache;
				htmlCache = cached.html;
				return htmlCache;
			},
			async markdown(): Promise<string> {
				if (markdownCache !== undefined) return markdownCache;
				markdownCache = await ctx.source.loadMarkdown(item);
				return markdownCache;
			},
		};

		if (cached.blocks) blocksCache = cached.blocks;

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
				// TTL 設定あり + 期限切れ: ブロッキングフェッチ（stale を返さない）
				this.ctx.hooks.onListCacheMiss?.();
				const items = await this.fetchListRaw();
				await this.ctx.docCache.setList({ items, cachedAt: Date.now() });
				return items;
			}
			// TTL 未設定 or 期限内: キャッシュを即時返却し、バックグラウンドで差分チェック
			const bg = this.checkAndUpdateListBg(cached);
			if (this.ctx.waitUntil) {
				this.ctx.waitUntil(bg);
			}
			this.ctx.hooks.onListCacheHit?.(cached.items, cached.cachedAt);
			return cached.items;
		}

		// キャッシュなし: 同期フェッチ
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
		cached: CachedItem<T>,
	): Promise<void> {
		try {
			const item = await this.findRaw(slug);
			if (!item) return;
			if (this.ctx.source.getLastModified(item) !== cached.notionUpdatedAt) {
				// 更新あり: 再レンダリングしてキャッシュを差し替える
				const entry = await buildCachedItem(item, this.ctx.render);
				await this.ctx.docCache.setItem(slug, entry);
			} else if (this.ctx.ttlMs !== undefined) {
				// 変更なし + TTL あり: cachedAt をリセットして次回の期限切れを先送りする
				await this.ctx.docCache.setItem(slug, {
					...cached,
					cachedAt: Date.now(),
				});
			}
		} catch (err) {
			this.ctx.logger?.warn?.(
				"SWR: アイテムのバックグラウンド差分チェックに失敗",
				{
					slug,
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
				// 更新あり: リストを差し替える
				await this.ctx.docCache.setList({ items, cachedAt: Date.now() });
			} else if (this.ctx.ttlMs !== undefined) {
				// 変更なし + TTL あり: cachedAt をリセットする
				await this.ctx.docCache.setList({
					...cached,
					cachedAt: Date.now(),
				});
			}
		} catch (err) {
			this.ctx.logger?.warn?.(
				"SWR: リストのバックグラウンド差分チェックに失敗",
				{
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
