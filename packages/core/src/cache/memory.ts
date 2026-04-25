import type {
	BaseContentItem,
	CachedItem,
	CachedItemList,
	DocumentCacheAdapter,
	ImageCacheAdapter,
	InvalidateScope,
	StorageBinary,
} from "../types/index";

export interface MemoryDocumentCacheOptions {
	/** アイテム保持上限。未指定時は上限なし。超過時は LRU で古いものから削除。 */
	maxItems?: number;
}

export interface MemoryImageCacheOptions {
	/** エントリ保持上限。未指定時は上限なし。超過時は LRU で古いものから削除。 */
	maxItems?: number;
	/** 合計保持サイズ上限（バイト）。未指定時は上限なし。超過時は LRU で古いものから削除。 */
	maxSizeBytes?: number;
}

/**
 * Map の挿入順を LRU として扱う軽量実装。
 * `touch` で既存キーを末尾に移動、`enforceLimit` で古いキー（先頭）から削除する。
 */
function touch<K, V>(map: Map<K, V>, key: K): void {
	const v = map.get(key);
	if (v === undefined) return;
	map.delete(key);
	map.set(key, v);
}

/** インメモリのドキュメントキャッシュ実装。プロセス再起動でクリアされる。ローカル開発向け。 */
export class MemoryDocumentCache<T extends BaseContentItem = BaseContentItem>
	implements DocumentCacheAdapter<T>
{
	readonly name = "memory-document";
	private list: CachedItemList<T> | null = null;
	private items = new Map<string, CachedItem<T>>();
	private readonly maxItems: number | undefined;

	constructor(options?: MemoryDocumentCacheOptions) {
		this.maxItems = options?.maxItems;
	}

	getList(): Promise<CachedItemList<T> | null> {
		return Promise.resolve(this.list);
	}

	setList(data: CachedItemList<T>): Promise<void> {
		this.list = data;
		return Promise.resolve();
	}

	getItem(slug: string): Promise<CachedItem<T> | null> {
		const entry = this.items.get(slug);
		if (entry) touch(this.items, slug);
		return Promise.resolve(entry ?? null);
	}

	setItem(slug: string, data: CachedItem<T>): Promise<void> {
		if (this.items.has(slug)) this.items.delete(slug);
		this.items.set(slug, data);
		this.enforceLimit();
		return Promise.resolve();
	}

	async invalidate(scope: InvalidateScope): Promise<void> {
		if (scope === "all") {
			this.list = null;
			this.items.clear();
			return;
		}
		// list は常に破棄する
		this.list = null;
		if ("slug" in scope) {
			this.items.delete(scope.slug);
		} else {
			// { collection }: プレフィックスに一致するアイテムをすべて削除する
			// scopeDocumentCache 経由の場合、キーは `{collection}:{slug}` 形式になる
			const prefix = `${scope.collection}:`;
			for (const key of [...this.items.keys()]) {
				if (key.startsWith(prefix)) {
					this.items.delete(key);
				}
			}
		}
	}

	private enforceLimit(): void {
		if (this.maxItems === undefined) return;
		while (this.items.size > this.maxItems) {
			const firstKey = this.items.keys().next().value;
			if (firstKey === undefined) break;
			this.items.delete(firstKey);
		}
	}
}

/** インメモリの画像キャッシュ実装。プロセス再起動でクリアされる。ローカル開発向け。 */
export class MemoryImageCache implements ImageCacheAdapter {
	readonly name = "memory-image";
	private store = new Map<string, StorageBinary>();
	private totalBytes = 0;
	private readonly maxItems: number | undefined;
	private readonly maxSizeBytes: number | undefined;

	constructor(options?: MemoryImageCacheOptions) {
		this.maxItems = options?.maxItems;
		this.maxSizeBytes = options?.maxSizeBytes;
	}

	get(hash: string): Promise<StorageBinary | null> {
		const entry = this.store.get(hash);
		if (entry) touch(this.store, hash);
		return Promise.resolve(entry ?? null);
	}

	set(hash: string, data: ArrayBuffer, contentType: string): Promise<void> {
		const existing = this.store.get(hash);
		if (existing) {
			this.totalBytes -= existing.data.byteLength;
			this.store.delete(hash);
		}
		this.store.set(hash, { data, contentType });
		this.totalBytes += data.byteLength;
		this.enforceLimit();
		return Promise.resolve();
	}

	private enforceLimit(): void {
		while (
			(this.maxItems !== undefined && this.store.size > this.maxItems) ||
			(this.maxSizeBytes !== undefined && this.totalBytes > this.maxSizeBytes)
		) {
			const firstKey = this.store.keys().next().value;
			if (firstKey === undefined) break;
			const victim = this.store.get(firstKey);
			if (victim) this.totalBytes -= victim.data.byteLength;
			this.store.delete(firstKey);
		}
	}
}

/** インメモリキャッシュ（ドキュメント用）を生成する。 */
export function memoryDocumentCache<
	T extends BaseContentItem = BaseContentItem,
>(options?: MemoryDocumentCacheOptions): DocumentCacheAdapter<T> {
	return new MemoryDocumentCache<T>(options);
}

/** インメモリキャッシュ（画像用）を生成する。 */
export function memoryImageCache(
	options?: MemoryImageCacheOptions,
): ImageCacheAdapter {
	return new MemoryImageCache(options);
}
