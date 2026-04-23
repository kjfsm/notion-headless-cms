import type {
	BaseContentItem,
	CachedItem,
	CachedItemList,
	DocumentCacheAdapter,
} from "@notion-headless-cms/core";
import type { KVNamespaceLike } from "./types";

export type { KVNamespaceLike } from "./types";

export interface KVCacheOptions {
	kv: KVNamespaceLike;
	/** キャッシュキーのプレフィックス。デフォルト: '' */
	prefix?: string;
}

/** DocumentCacheAdapter を KV で実装するキャッシュ。テキスト（JSON）のみ保存する。 */
class KVDocumentCache<T extends BaseContentItem = BaseContentItem>
	implements DocumentCacheAdapter<T>
{
	readonly name = "kv";
	private readonly kv: KVNamespaceLike;
	private readonly listKey: string;
	private readonly itemPrefix: string;

	constructor(opts: KVCacheOptions) {
		this.kv = opts.kv;
		const prefix = opts.prefix ?? "";
		this.listKey = `${prefix}content`;
		this.itemPrefix = `${prefix}content:`;
	}

	async getList(): Promise<CachedItemList<T> | null> {
		const raw = await this.kv.get(this.listKey, "text");
		if (!raw) return null;
		return JSON.parse(raw) as CachedItemList<T>;
	}

	async setList(data: CachedItemList<T>): Promise<void> {
		await this.kv.put(this.listKey, JSON.stringify(data));
	}

	async getItem(slug: string): Promise<CachedItem<T> | null> {
		const raw = await this.kv.get(`${this.itemPrefix}${slug}`, "text");
		if (!raw) return null;
		return JSON.parse(raw) as CachedItem<T>;
	}

	async setItem(slug: string, data: CachedItem<T>): Promise<void> {
		await this.kv.put(`${this.itemPrefix}${slug}`, JSON.stringify(data));
	}
}

/**
 * Cloudflare KV をバックエンドとする DocumentCacheAdapter を生成する。
 * kv が undefined の場合は undefined を返す（キャッシュなしフォールバック用）。
 */
export function kvCache<T extends BaseContentItem = BaseContentItem>(
	opts: KVCacheOptions,
): KVDocumentCache<T>;
export function kvCache<T extends BaseContentItem = BaseContentItem>(
	opts: Omit<KVCacheOptions, "kv"> & { kv: KVNamespaceLike | undefined },
): KVDocumentCache<T> | undefined;
export function kvCache<T extends BaseContentItem = BaseContentItem>(
	opts: Omit<KVCacheOptions, "kv"> & { kv: KVNamespaceLike | undefined },
): KVDocumentCache<T> | undefined {
	if (!opts.kv) return undefined;
	return new KVDocumentCache<T>({ ...opts, kv: opts.kv });
}
