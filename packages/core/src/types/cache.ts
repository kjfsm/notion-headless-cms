import type {
	BaseContentItem,
	CachedItemContent,
	CachedItemList,
	CachedItemMeta,
	StorageBinary,
} from "./content";
import type { InvalidateScope } from "./data-source";

export type { InvalidateKind, InvalidateScope } from "./data-source";

/**
 * ドキュメントキャッシュを抽象化するインターフェース。
 *
 * v0.4.0 で `getItem`/`setItem` を `getItemMeta`/`setItemMeta` +
 * `getItemContent`/`setItemContent` に分割した。
 * メタデータのみ取り出す軽量パスと、本文を遅延ロードするパスを分離するため。
 */
export interface DocumentCacheAdapter<
	T extends BaseContentItem = BaseContentItem,
> {
	readonly name: string;

	// --- リスト ---
	getList(): Promise<CachedItemList<T> | null>;
	setList(data: CachedItemList<T>): Promise<void>;

	// --- メタデータ（軽量、差分判定・一覧表示・SWR 用） ---
	getItemMeta(slug: string): Promise<CachedItemMeta<T> | null>;
	setItemMeta(slug: string, data: CachedItemMeta<T>): Promise<void>;

	// --- 本文（HTML/Markdown/blocks、必要時のみロード） ---
	getItemContent(slug: string): Promise<CachedItemContent | null>;
	setItemContent(slug: string, data: CachedItemContent): Promise<void>;

	/**
	 * 無効化。`scope.kind` で meta/content の粒度を指定できる。
	 * 省略時は両方失効させる。
	 */
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
