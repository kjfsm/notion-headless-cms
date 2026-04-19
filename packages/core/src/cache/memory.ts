import type {
	BaseContentItem,
	CachedItem,
	CachedItemList,
	DocumentCacheAdapter,
	ImageCacheAdapter,
	StorageBinary,
} from "../types/index";

/** インメモリのドキュメントキャッシュ実装。プロセス再起動でクリアされる。ローカル開発向け。 */
export class MemoryDocumentCache<T extends BaseContentItem = BaseContentItem>
	implements DocumentCacheAdapter<T>
{
	readonly name = "memory-document";
	private list: CachedItemList<T> | null = null;
	private items = new Map<string, CachedItem<T>>();

	getList(): Promise<CachedItemList<T> | null> {
		return Promise.resolve(this.list);
	}

	setList(data: CachedItemList<T>): Promise<void> {
		this.list = data;
		return Promise.resolve();
	}

	getItem(slug: string): Promise<CachedItem<T> | null> {
		return Promise.resolve(this.items.get(slug) ?? null);
	}

	setItem(slug: string, data: CachedItem<T>): Promise<void> {
		this.items.set(slug, data);
		return Promise.resolve();
	}

	async invalidate(
		scope: "all" | { slug: string } | { tag: string },
	): Promise<void> {
		if (scope === "all") {
			this.list = null;
			this.items.clear();
		} else if ("slug" in scope) {
			this.items.delete(scope.slug);
		}
	}
}

/** インメモリの画像キャッシュ実装。プロセス再起動でクリアされる。ローカル開発向け。 */
export class MemoryImageCache implements ImageCacheAdapter {
	readonly name = "memory-image";
	private store = new Map<string, StorageBinary>();

	get(hash: string): Promise<StorageBinary | null> {
		return Promise.resolve(this.store.get(hash) ?? null);
	}

	set(hash: string, data: ArrayBuffer, contentType: string): Promise<void> {
		this.store.set(hash, { data, contentType });
		return Promise.resolve();
	}
}

/** インメモリキャッシュ（ドキュメント用）を生成する。 */
export function memoryDocumentCache<
	T extends BaseContentItem = BaseContentItem,
>(): DocumentCacheAdapter<T> {
	return new MemoryDocumentCache<T>();
}

/** インメモリキャッシュ（画像用）を生成する。 */
export function memoryImageCache(): ImageCacheAdapter {
	return new MemoryImageCache();
}

/**
 * ドキュメントと画像の両方にインメモリキャッシュを返す便利関数。
 * memoryCache() はドキュメントキャッシュを返す（後方互換）。
 */
export function memoryCache<
	T extends BaseContentItem = BaseContentItem,
>(): DocumentCacheAdapter<T> {
	return new MemoryDocumentCache<T>();
}
