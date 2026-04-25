import type { BaseContentItem, CachedItem, CachedItemList } from "./content";

export type MaybePromise<T> = T | Promise<T>;

export interface CMSHooks<T extends BaseContentItem = BaseContentItem> {
	beforeCache?: (item: CachedItem<T>) => MaybePromise<CachedItem<T>>;
	afterRender?: (html: string, item: T) => MaybePromise<string>;
	onCacheHit?: (slug: string, item: CachedItem<T>) => void;
	onCacheMiss?: (slug: string) => void;
	/** SWR バックグラウンド差分チェックで更新を検出し、キャッシュを差し替えたときに呼ばれる。 */
	onCacheRevalidated?: (slug: string, item: CachedItem<T>) => void;
	onListCacheHit?: (list: CachedItemList<T>) => void;
	onListCacheMiss?: () => void;
	/** SWR バックグラウンド差分チェックでリスト更新を検出し、キャッシュを差し替えたときに呼ばれる。 */
	onListCacheRevalidated?: (list: CachedItemList<T>) => void;
	onError?: (error: Error) => void;
	onRenderStart?: (slug: string) => void;
	onRenderEnd?: (slug: string, durationMs: number) => void;
}
