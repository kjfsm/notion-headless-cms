import type {
	BaseContentItem,
	CachedItemContent,
	CachedItemList,
	CachedItemMeta,
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
	private metas = new Map<string, CachedItemMeta<T>>();
	private contents = new Map<string, CachedItemContent>();
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

	getItemMeta(slug: string): Promise<CachedItemMeta<T> | null> {
		const entry = this.metas.get(slug);
		if (entry) touch(this.metas, slug);
		return Promise.resolve(entry ?? null);
	}

	setItemMeta(slug: string, data: CachedItemMeta<T>): Promise<void> {
		if (this.metas.has(slug)) this.metas.delete(slug);
		this.metas.set(slug, data);
		this.enforceLimit();
		return Promise.resolve();
	}

	getItemContent(slug: string): Promise<CachedItemContent | null> {
		const entry = this.contents.get(slug);
		if (entry) touch(this.contents, slug);
		return Promise.resolve(entry ?? null);
	}

	setItemContent(slug: string, data: CachedItemContent): Promise<void> {
		if (this.contents.has(slug)) this.contents.delete(slug);
		this.contents.set(slug, data);
		this.enforceLimit();
		return Promise.resolve();
	}

	async invalidate(scope: InvalidateScope): Promise<void> {
		if (scope === "all") {
			this.list = null;
			this.metas.clear();
			this.contents.clear();
			return;
		}
		const kind = scope.kind ?? "all";
		if (kind === "all" || kind === "meta") {
			this.list = null;
		}
		if ("slug" in scope) {
			if (kind === "all" || kind === "meta") this.metas.delete(scope.slug);
			if (kind === "all" || kind === "content")
				this.contents.delete(scope.slug);
		} else {
			// scopeDocumentCache 経由でキーは `{collection}:{slug}` 形式になる
			const prefix = `${scope.collection}:`;
			if (kind === "all" || kind === "meta") {
				for (const key of [...this.metas.keys()]) {
					if (key.startsWith(prefix)) this.metas.delete(key);
				}
			}
			if (kind === "all" || kind === "content") {
				for (const key of [...this.contents.keys()]) {
					if (key.startsWith(prefix)) this.contents.delete(key);
				}
			}
		}
	}

	private enforceLimit(): void {
		if (this.maxItems === undefined) return;
		while (this.metas.size > this.maxItems) {
			const firstKey = this.metas.keys().next().value;
			if (firstKey === undefined) break;
			this.metas.delete(firstKey);
		}
		while (this.contents.size > this.maxItems) {
			const firstKey = this.contents.keys().next().value;
			if (firstKey === undefined) break;
			this.contents.delete(firstKey);
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
