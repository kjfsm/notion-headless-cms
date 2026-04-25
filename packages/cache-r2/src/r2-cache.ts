import type {
	BaseContentItem,
	CachedItem,
	CachedItemList,
	DocumentCacheAdapter,
	ImageCacheAdapter,
	StorageBinary,
} from "@notion-headless-cms/core";
import type { R2BucketLike, R2ObjectLike } from "./types";

export interface R2CacheOptions {
	bucket: R2BucketLike;
	/** キャッシュキーのプレフィックス。デフォルト: '' */
	prefix?: string;
}

/** DocumentCacheAdapter と ImageCacheAdapter の両方を実装する R2 キャッシュ。 */
class R2Cache<T extends BaseContentItem = BaseContentItem>
	implements DocumentCacheAdapter<T>, ImageCacheAdapter
{
	readonly name = "r2";
	private readonly bucket: R2BucketLike;
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
		return (obj as R2ObjectLike).json<CachedItemList<T>>();
	}

	async setList(data: CachedItemList<T>): Promise<void> {
		await this.bucket.put(this.listKey, JSON.stringify(data), {
			httpMetadata: { contentType: "application/json" },
		});
	}

	async getItem(slug: string): Promise<CachedItem<T> | null> {
		const obj = await this.bucket.get(`${this.itemPrefix}${slug}.json`);
		if (!obj) return null;
		return (obj as R2ObjectLike).json<CachedItem<T>>();
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
			data: await (obj as R2ObjectLike).arrayBuffer(),
			contentType: (obj as R2ObjectLike).httpMetadata?.contentType,
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
	opts: Omit<R2CacheOptions, "bucket"> & { bucket: R2BucketLike | undefined },
): R2Cache<T> | undefined;
export function r2Cache<T extends BaseContentItem = BaseContentItem>(
	opts: Omit<R2CacheOptions, "bucket"> & { bucket: R2BucketLike | undefined },
): R2Cache<T> | undefined {
	if (!opts.bucket) return undefined;
	return new R2Cache<T>({ ...opts, bucket: opts.bucket });
}
