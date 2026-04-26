import type {
	BaseContentItem,
	CachedItemContent,
	CachedItemList,
	CachedItemMeta,
	DocumentCacheAdapter,
	ImageCacheAdapter,
	InvalidateScope,
	StorageBinary,
} from "@notion-headless-cms/core";
import type { R2BucketLike, R2ObjectLike } from "./types";

export interface R2CacheOptions {
	bucket: R2BucketLike;
	/** キャッシュキーのプレフィックス。デフォルト: '' */
	prefix?: string;
}

/**
 * Cloudflare R2 をバックエンドとする DocumentCacheAdapter & ImageCacheAdapter。
 *
 * キー設計:
 *   - リスト   : `{prefix}content.json`
 *   - メタデータ: `{prefix}meta/{slug}.json`（軽量、差分判定用）
 *   - 本文    : `{prefix}content/{slug}.json`（HTML/Markdown/blocks）
 *   - 画像    : `{prefix}images/{hash}`
 *
 * checkForUpdate / SWR 差分判定はメタキーのみ読むため、本文の HTML 転送が発生しない。
 */
class R2Cache<T extends BaseContentItem = BaseContentItem>
	implements DocumentCacheAdapter<T>, ImageCacheAdapter
{
	readonly name = "r2";
	private readonly bucket: R2BucketLike;
	private readonly listKey: string;
	private readonly metaPrefix: string;
	private readonly contentPrefix: string;
	private readonly imagePrefix: string;

	constructor(opts: R2CacheOptions) {
		this.bucket = opts.bucket;
		const prefix = opts.prefix ?? "";
		this.listKey = `${prefix}content.json`;
		this.metaPrefix = `${prefix}meta/`;
		this.contentPrefix = `${prefix}content/`;
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

	async getItemMeta(slug: string): Promise<CachedItemMeta<T> | null> {
		const obj = await this.bucket.get(`${this.metaPrefix}${slug}.json`);
		if (!obj) return null;
		return (obj as R2ObjectLike).json<CachedItemMeta<T>>();
	}

	async setItemMeta(slug: string, data: CachedItemMeta<T>): Promise<void> {
		await this.bucket.put(
			`${this.metaPrefix}${slug}.json`,
			JSON.stringify(data),
			{ httpMetadata: { contentType: "application/json" } },
		);
	}

	async getItemContent(slug: string): Promise<CachedItemContent | null> {
		const obj = await this.bucket.get(`${this.contentPrefix}${slug}.json`);
		if (!obj) return null;
		return (obj as R2ObjectLike).json<CachedItemContent>();
	}

	async setItemContent(slug: string, data: CachedItemContent): Promise<void> {
		await this.bucket.put(
			`${this.contentPrefix}${slug}.json`,
			JSON.stringify(data),
			{ httpMetadata: { contentType: "application/json" } },
		);
	}

	async invalidate(scope: InvalidateScope): Promise<void> {
		const kind = scope === "all" ? "all" : (scope.kind ?? "all");

		if (scope === "all") {
			// list + 全 meta + 全 content を削除
			await Promise.all([
				this.bucket.delete(this.listKey),
				this.deletePrefix(this.metaPrefix),
				this.deletePrefix(this.contentPrefix),
			]);
			return;
		}

		if ("slug" in scope) {
			const tasks: Promise<unknown>[] = [];
			if (kind === "all" || kind === "meta") {
				tasks.push(this.bucket.delete(`${this.metaPrefix}${scope.slug}.json`));
			}
			if (kind === "all" || kind === "content") {
				tasks.push(
					this.bucket.delete(`${this.contentPrefix}${scope.slug}.json`),
				);
			}
			await Promise.all(tasks);
			return;
		}

		// collection スコープ: list + meta/content を全削除
		const tasks: Promise<unknown>[] = [];
		if (kind === "all" || kind === "meta") {
			tasks.push(
				this.bucket.delete(this.listKey),
				this.deletePrefix(this.metaPrefix),
			);
		}
		if (kind === "all" || kind === "content") {
			tasks.push(this.deletePrefix(this.contentPrefix));
		}
		await Promise.all(tasks);
	}

	private async deletePrefix(prefix: string): Promise<void> {
		// R2 list はカーソル付き。truncated が解消されるまで反復する
		let cursor: string | undefined;
		do {
			const result = await this.bucket.list({ prefix, cursor });
			const keys = result.objects.map((o) => o.key);
			if (keys.length > 0) {
				await Promise.all(keys.map((k) => this.bucket.delete(k)));
			}
			cursor = result.truncated ? result.cursor : undefined;
		} while (cursor);
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
