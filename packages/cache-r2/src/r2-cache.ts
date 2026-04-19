import type {
	BaseContentItem,
	CachedItem,
	CachedItemList,
	DocumentCacheAdapter,
	ImageCacheAdapter,
	StorageBinary,
} from "@notion-headless-cms/core";

export interface R2CacheOptions {
	bucket: R2Bucket;
	/** キャッシュキーのプレフィックス。デフォルト: '' */
	prefix?: string;
}

/** DocumentCacheAdapter と ImageCacheAdapter の両方を実装する R2 キャッシュ。 */
class R2Cache<T extends BaseContentItem = BaseContentItem>
	implements DocumentCacheAdapter<T>, ImageCacheAdapter
{
	readonly name = "r2";
	private readonly bucket: R2Bucket;
	private readonly listKey: string;
	private readonly itemPrefix: string;
	private readonly imagePrefix: string;

	constructor(opts: R2CacheOptions) {
		this.bucket = opts.bucket;
		const prefix = opts.prefix ?? "";
		this.listKey = `${prefix}content.json`;
		this.itemPrefix = `${prefix}content/`;
		this.imagePrefix = `${prefix}images/`;
	}

	// ── DocumentCacheAdapter ────────────────────────────────────────────

	async getList(): Promise<CachedItemList<T> | null> {
		const obj = await this.bucket.get(this.listKey);
		if (!obj) return null;
		return obj.json<CachedItemList<T>>();
	}

	async setList(data: CachedItemList<T>): Promise<void> {
		await this.bucket.put(this.listKey, JSON.stringify(data), {
			httpMetadata: { contentType: "application/json" },
		});
	}

	async getItem(slug: string): Promise<CachedItem<T> | null> {
		const obj = await this.bucket.get(`${this.itemPrefix}${slug}.json`);
		if (!obj) return null;
		return obj.json<CachedItem<T>>();
	}

	async setItem(slug: string, data: CachedItem<T>): Promise<void> {
		await this.bucket.put(
			`${this.itemPrefix}${slug}.json`,
			JSON.stringify(data),
			{ httpMetadata: { contentType: "application/json" } },
		);
	}

	// ── ImageCacheAdapter ───────────────────────────────────────────────

	async get(hash: string): Promise<StorageBinary | null> {
		const obj = await this.bucket.get(`${this.imagePrefix}${hash}`);
		if (!obj) return null;
		return {
			data: await obj.arrayBuffer(),
			contentType: obj.httpMetadata?.contentType,
		};
	}

	async set(
		hash: string,
		data: ArrayBuffer,
		contentType: string,
	): Promise<void> {
		await this.bucket.put(`${this.imagePrefix}${hash}`, data, {
			httpMetadata: { contentType },
		});
	}
}

/**
 * Cloudflare R2 をバックエンドとする DocumentCacheAdapter & ImageCacheAdapter を生成する。
 * bucket が undefined の場合は undefined を返す（キャッシュなしフォールバック用）。
 */
export function r2Cache<T extends BaseContentItem = BaseContentItem>(
	opts: R2CacheOptions,
): R2Cache<T>;
export function r2Cache<T extends BaseContentItem = BaseContentItem>(
	opts: Omit<R2CacheOptions, "bucket"> & { bucket: R2Bucket | undefined },
): R2Cache<T> | undefined;
export function r2Cache<T extends BaseContentItem = BaseContentItem>(
	opts: Omit<R2CacheOptions, "bucket"> & { bucket: R2Bucket | undefined },
): R2Cache<T> | undefined {
	if (!opts.bucket) return undefined;
	return new R2Cache<T>({ ...opts, bucket: opts.bucket });
}
