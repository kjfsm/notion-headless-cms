import type {
	BaseContentItem,
	CachedItem,
	CachedItemList,
	StorageAdapter,
	StorageBinary,
} from "./types";

/** 文字列をSHA-256でハッシュ化し、16進数文字列として返す。画像キーの生成に使用。 */
export async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(hash))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * キャッシュが有効期限切れかどうかを判定する。
 * ttlMs が未指定の場合は常に false（無期限有効）を返す。
 */
export function isStale(cachedAt: number, ttlMs?: number): boolean {
	if (ttlMs === undefined) return false;
	return Date.now() - cachedAt > ttlMs;
}

/** ストレージキャッシュ操作をまとめたヘルパークラス。キープレフィックスは設定で変更可能。 */
export class CacheStore<T extends BaseContentItem = BaseContentItem> {
	private readonly storage?: StorageAdapter;
	private readonly listKey: string;
	private readonly itemPrefix: string;
	private readonly imagePrefix: string;

	constructor(
		storage: StorageAdapter | undefined,
		listKey: string,
		itemPrefix: string,
		imagePrefix: string,
	) {
		this.storage = storage;
		this.listKey = listKey;
		this.itemPrefix = itemPrefix;
		this.imagePrefix = imagePrefix;
	}

	getItemList(): Promise<CachedItemList<T> | null> {
		if (!this.storage) return Promise.resolve(null);
		return this.storage.json<CachedItemList<T>>(this.listKey);
	}

	async setItemList(items: T[]): Promise<void> {
		if (!this.storage) return;
		const data: CachedItemList<T> = { items, cachedAt: Date.now() };
		await this.storage.put(this.listKey, JSON.stringify(data), {
			contentType: "application/json",
		});
	}

	getItem(slug: string): Promise<CachedItem<T> | null> {
		if (!this.storage) return Promise.resolve(null);
		return this.storage.json<CachedItem<T>>(`${this.itemPrefix}${slug}.json`);
	}

	async setItem(slug: string, data: CachedItem<T>): Promise<void> {
		if (!this.storage) return;
		await this.storage.put(
			`${this.itemPrefix}${slug}.json`,
			JSON.stringify(data),
			{ contentType: "application/json" },
		);
	}

	getImage(hash: string): Promise<StorageBinary | null> {
		if (!this.storage) return Promise.resolve(null);
		return this.storage.binary(`${this.imagePrefix}${hash}`);
	}

	async setImage(
		hash: string,
		data: ArrayBuffer,
		contentType: string,
	): Promise<void> {
		if (!this.storage) return;
		await this.storage.put(`${this.imagePrefix}${hash}`, data, { contentType });
	}
}
