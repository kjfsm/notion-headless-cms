import type {
	BaseContentItem,
	CachedItemContent,
	CachedItemList,
	CachedItemMeta,
	DocumentCacheAdapter,
	InvalidateScope,
} from "@notion-headless-cms/core";
import type { KVNamespaceLike } from "./types";

export type { KVNamespaceLike } from "./types";

export interface KVCacheOptions {
	kv: KVNamespaceLike;
	/** キャッシュキーのプレフィックス。デフォルト: '' */
	prefix?: string;
}

/**
 * Cloudflare KV を DocumentCacheAdapter として実装するキャッシュ。
 *
 * キー設計:
 *   - リスト   : `{prefix}content`
 *   - メタデータ: `{prefix}meta:{slug}`
 *   - 本文    : `{prefix}content:{slug}`
 */
class KVDocumentCache<T extends BaseContentItem = BaseContentItem>
	implements DocumentCacheAdapter<T>
{
	readonly name = "kv";
	private readonly kv: KVNamespaceLike;
	private readonly listKey: string;
	private readonly metaPrefix: string;
	private readonly contentPrefix: string;

	constructor(opts: KVCacheOptions) {
		this.kv = opts.kv;
		const prefix = opts.prefix ?? "";
		this.listKey = `${prefix}content`;
		this.metaPrefix = `${prefix}meta:`;
		this.contentPrefix = `${prefix}content:`;
	}

	async getList(): Promise<CachedItemList<T> | null> {
		const raw = await this.kv.get(this.listKey, "text");
		if (!raw) return null;
		return JSON.parse(raw) as CachedItemList<T>;
	}

	async setList(data: CachedItemList<T>): Promise<void> {
		await this.kv.put(this.listKey, JSON.stringify(data));
	}

	async getItemMeta(slug: string): Promise<CachedItemMeta<T> | null> {
		const raw = await this.kv.get(`${this.metaPrefix}${slug}`, "text");
		if (!raw) return null;
		return JSON.parse(raw) as CachedItemMeta<T>;
	}

	async setItemMeta(slug: string, data: CachedItemMeta<T>): Promise<void> {
		await this.kv.put(`${this.metaPrefix}${slug}`, JSON.stringify(data));
	}

	async getItemContent(slug: string): Promise<CachedItemContent | null> {
		const raw = await this.kv.get(`${this.contentPrefix}${slug}`, "text");
		if (!raw) return null;
		return JSON.parse(raw) as CachedItemContent;
	}

	async setItemContent(slug: string, data: CachedItemContent): Promise<void> {
		await this.kv.put(`${this.contentPrefix}${slug}`, JSON.stringify(data));
	}

	async invalidate(scope: InvalidateScope): Promise<void> {
		const kind = scope === "all" ? "all" : (scope.kind ?? "all");

		if (scope === "all") {
			await Promise.all([
				this.kv.delete(this.listKey),
				this.deletePrefix(this.metaPrefix),
				this.deletePrefix(this.contentPrefix),
			]);
			return;
		}

		if ("slug" in scope) {
			const tasks: Promise<unknown>[] = [];
			if (kind === "all" || kind === "meta") {
				tasks.push(this.kv.delete(`${this.metaPrefix}${scope.slug}`));
			}
			if (kind === "all" || kind === "content") {
				tasks.push(this.kv.delete(`${this.contentPrefix}${scope.slug}`));
			}
			await Promise.all(tasks);
			return;
		}

		const tasks: Promise<unknown>[] = [];
		if (kind === "all" || kind === "meta") {
			tasks.push(
				this.kv.delete(this.listKey),
				this.deletePrefix(this.metaPrefix),
			);
		}
		if (kind === "all" || kind === "content") {
			tasks.push(this.deletePrefix(this.contentPrefix));
		}
		await Promise.all(tasks);
	}

	private async deletePrefix(prefix: string): Promise<void> {
		let cursor: string | undefined;
		do {
			const result = await this.kv.list({ prefix, cursor });
			const keys = result.keys.map((k) => k.name);
			if (keys.length > 0) {
				await Promise.all(keys.map((k) => this.kv.delete(k)));
			}
			cursor = result.list_complete ? undefined : result.cursor;
		} while (cursor);
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
