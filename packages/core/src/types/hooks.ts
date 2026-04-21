import type { BaseContentItem, CachedItem } from "./content";

export type MaybePromise<T> = T | Promise<T>;

export interface CMSHooks<T extends BaseContentItem = BaseContentItem> {
	beforeCache?: (item: CachedItem<T>) => MaybePromise<CachedItem<T>>;
	afterRender?: (html: string, item: T) => MaybePromise<string>;
	onCacheHit?: (slug: string, item: CachedItem<T>) => void;
	onCacheMiss?: (slug: string) => void;
	onListCacheHit?: (items: T[], cachedAt: number) => void;
	onListCacheMiss?: () => void;
	onError?: (error: Error) => void;
	onRenderStart?: (slug: string) => void;
	onRenderEnd?: (slug: string, durationMs: number) => void;
}
