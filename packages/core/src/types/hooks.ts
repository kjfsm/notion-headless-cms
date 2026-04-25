import type { BaseContentItem, CachedItem } from "./content";

export type MaybePromise<T> = T | Promise<T>;

export interface CMSHooks<T extends BaseContentItem = BaseContentItem> {
	beforeCache?: (item: CachedItem<T>) => MaybePromise<CachedItem<T>>;
	afterRender?: (html: string, item: T) => MaybePromise<string>;
	onCacheHit?: (slug: string, item: CachedItem<T>) => void;
	onCacheMiss?: (slug: string) => void;
	/** SWR バックグラウンド差分チェックで更新を検出し、キャッシュを差し替えたときに呼ばれる。 */
	onCacheUpdate?: (slug: string, item: CachedItem<T>) => void;
	onListCacheHit?: (items: T[], cachedAt: number) => void;
	onListCacheMiss?: () => void;
	/** SWR バックグラウンド差分チェックでリスト更新を検出し、キャッシュを差し替えたときに呼ばれる。 */
	onListCacheUpdate?: (items: T[]) => void;
	onError?: (error: Error) => void;
	onRenderStart?: (slug: string) => void;
	onRenderEnd?: (slug: string, durationMs: number) => void;
}
