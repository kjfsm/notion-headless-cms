import type {
	BaseContentItem,
	CacheAdapter,
	CachedItemContent,
	CachedItemList,
	CachedItemMeta,
	DocumentCacheOps,
	ImageCacheOps,
	InvalidateScope,
	StorageBinary,
} from "../types/index";

export interface MemoryDocumentOptions {
	/** アイテム保持上限。未指定時は上限なし。超過時は LRU で古いものから削除。 */
	maxItems?: number;
}

export interface MemoryImageOptions {
	/** エントリ保持上限。未指定時は上限なし。超過時は LRU で古いものから削除。 */
	maxItems?: number;
	/** 合計保持サイズ上限（バイト）。未指定時は上限なし。超過時は LRU で古いものから削除。 */
	maxSizeBytes?: number;
}

export interface MemoryCacheOptions
	extends MemoryDocumentOptions,
		MemoryImageOptions {}

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

const itemKey = (collection: string, slug: string): string =>
	`${collection}:${slug}`;

/** インメモリのドキュメントオペレーション実装。プロセス再起動でクリアされる。 */
class MemoryDocumentOps implements DocumentCacheOps {
	private lists = new Map<string, CachedItemList<BaseContentItem>>();
	private metas = new Map<string, CachedItemMeta<BaseContentItem>>();
	private contents = new Map<string, CachedItemContent>();
	private readonly maxItems: number | undefined;

	constructor(options?: MemoryDocumentOptions) {
		this.maxItems = options?.maxItems;
	}

	getList<T extends BaseContentItem>(
		collection: string,
	): Promise<CachedItemList<T> | null> {
		return Promise.resolve(
			(this.lists.get(collection) as CachedItemList<T> | undefined) ?? null,
		);
	}

	setList<T extends BaseContentItem>(
		collection: string,
		data: CachedItemList<T>,
	): Promise<void> {
		this.lists.set(collection, data);
		return Promise.resolve();
	}

	getMeta<T extends BaseContentItem>(
		collection: string,
		slug: string,
	): Promise<CachedItemMeta<T> | null> {
		const key = itemKey(collection, slug);
		const entry = this.metas.get(key) as CachedItemMeta<T> | undefined;
		if (entry) touch(this.metas, key);
		return Promise.resolve(entry ?? null);
	}

	setMeta<T extends BaseContentItem>(
		collection: string,
		slug: string,
		data: CachedItemMeta<T>,
	): Promise<void> {
		const key = itemKey(collection, slug);
		if (this.metas.has(key)) this.metas.delete(key);
		this.metas.set(key, data);
		this.enforceLimit();
		return Promise.resolve();
	}

	getContent(
		collection: string,
		slug: string,
	): Promise<CachedItemContent | null> {
		const key = itemKey(collection, slug);
		const entry = this.contents.get(key);
		if (entry) touch(this.contents, key);
		return Promise.resolve(entry ?? null);
	}

	setContent(
		collection: string,
		slug: string,
		data: CachedItemContent,
	): Promise<void> {
		const key = itemKey(collection, slug);
		if (this.contents.has(key)) this.contents.delete(key);
		this.contents.set(key, data);
		this.enforceLimit();
		return Promise.resolve();
	}

	invalidate(scope: InvalidateScope): Promise<void> {
		if (scope === "all") {
			this.lists.clear();
			this.metas.clear();
			this.contents.clear();
			return Promise.resolve();
		}
		const kind = scope.kind ?? "all";
		const collection = scope.collection;
		if ("slug" in scope) {
			const key = itemKey(collection, scope.slug);
			if (kind === "all" || kind === "meta") this.metas.delete(key);
			if (kind === "all" || kind === "content") this.contents.delete(key);
			// 単一スラッグ無効化ではリストは触らない（リスト全体の整合は別管理）
			return Promise.resolve();
		}
		// コレクション全体
		if (kind === "all" || kind === "meta") {
			this.lists.delete(collection);
			const prefix = `${collection}:`;
			for (const key of [...this.metas.keys()]) {
				if (key.startsWith(prefix)) this.metas.delete(key);
			}
		}
		if (kind === "all" || kind === "content") {
			const prefix = `${collection}:`;
			for (const key of [...this.contents.keys()]) {
				if (key.startsWith(prefix)) this.contents.delete(key);
			}
		}
		return Promise.resolve();
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

/** インメモリの画像オペレーション実装。 */
class MemoryImageOps implements ImageCacheOps {
	private store = new Map<string, StorageBinary>();
	private totalBytes = 0;
	private readonly maxItems: number | undefined;
	private readonly maxSizeBytes: number | undefined;

	constructor(options?: MemoryImageOptions) {
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

/**
 * インメモリのキャッシュアダプタ。document + image 両方を担当する。
 * プロセス再起動でクリアされるため、ローカル開発・SSG ビルド・テスト用途。
 *
 * @example
 * cache: memoryCache({ ttlMs: 5 * 60_000, maxItems: 1000 })
 */
export function memoryCache(options?: MemoryCacheOptions): CacheAdapter {
	return {
		name: "memory",
		handles: ["document", "image"] as const,
		doc: new MemoryDocumentOps(options),
		img: new MemoryImageOps(options),
	};
}
