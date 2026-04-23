import type {
	BaseContentItem,
	CachedItem,
	CachedItemList,
	StorageBinary,
} from "./content";

/**
 * キャッシュ無効化のスコープ。
 * v1 API では `{ collection, slug? }` が主形式。
 * 旧 `{ tag }` 形式は後方互換のため残す。
 */
export type InvalidateScope =
	| "all"
	| { slug: string }
	| { tag: string }
	| { collection: string }
	| { collection: string; slug: string };

/** ドキュメントキャッシュを抽象化するインターフェース。 */
export interface DocumentCacheAdapter<
	T extends BaseContentItem = BaseContentItem,
> {
	readonly name: string;
	getList(): Promise<CachedItemList<T> | null>;
	setList(data: CachedItemList<T>): Promise<void>;
	getItem(slug: string): Promise<CachedItem<T> | null>;
	setItem(slug: string, data: CachedItem<T>): Promise<void>;
	invalidate?(scope: InvalidateScope): Promise<void>;
}

/** 画像キャッシュを抽象化するインターフェース。 */
export interface ImageCacheAdapter {
	readonly name: string;
	get(hash: string): Promise<StorageBinary | null>;
	set(hash: string, data: ArrayBuffer, contentType: string): Promise<void>;
}

/**
 * キャッシュ設定。`"disabled"` を渡すと完全にキャッシュを無効化する。
 * オブジェクトの場合、document / image それぞれ独立したアダプタを差し込める。
 */
export type CacheConfig<T extends BaseContentItem = BaseContentItem> =
	| "disabled"
	| {
			document?: DocumentCacheAdapter<T>;
			image?: ImageCacheAdapter;
			/** キャッシュの有効期間（ミリ秒）。未設定の場合はTTLなし。 */
			ttlMs?: number;
	  };
