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
} from "@notion-headless-cms/core";
import type { KVNamespaceLike, R2BucketLike, R2ObjectLike } from "./types";

export type { KVNamespaceLike, R2BucketLike } from "./types";

// ── KV (document only) ────────────────────────────────────────────────────────

export interface KVCacheOptions {
	namespace: KVNamespaceLike;
	/** キャッシュキーのプレフィックス。デフォルト: '' */
	prefix?: string;
}

const listKey = (prefix: string, collection: string): string =>
	`${prefix}list:${collection}`;
const metaKey = (prefix: string, collection: string, slug: string): string =>
	`${prefix}meta:${collection}:${slug}`;
const contentKey = (prefix: string, collection: string, slug: string): string =>
	`${prefix}content:${collection}:${slug}`;

class KVDocumentOps implements DocumentCacheOps {
	constructor(
		private readonly kv: KVNamespaceLike,
		private readonly prefix: string,
	) {}

	async getList<T extends BaseContentItem>(
		collection: string,
	): Promise<CachedItemList<T> | null> {
		const raw = await this.kv.get(listKey(this.prefix, collection), "text");
		return raw ? (JSON.parse(raw) as CachedItemList<T>) : null;
	}

	async setList<T extends BaseContentItem>(
		collection: string,
		data: CachedItemList<T>,
	): Promise<void> {
		await this.kv.put(listKey(this.prefix, collection), JSON.stringify(data));
	}

	async getMeta<T extends BaseContentItem>(
		collection: string,
		slug: string,
	): Promise<CachedItemMeta<T> | null> {
		const raw = await this.kv.get(
			metaKey(this.prefix, collection, slug),
			"text",
		);
		return raw ? (JSON.parse(raw) as CachedItemMeta<T>) : null;
	}

	async setMeta<T extends BaseContentItem>(
		collection: string,
		slug: string,
		data: CachedItemMeta<T>,
	): Promise<void> {
		await this.kv.put(
			metaKey(this.prefix, collection, slug),
			JSON.stringify(data),
		);
	}

	async getContent(
		collection: string,
		slug: string,
	): Promise<CachedItemContent | null> {
		const raw = await this.kv.get(
			contentKey(this.prefix, collection, slug),
			"text",
		);
		return raw ? (JSON.parse(raw) as CachedItemContent) : null;
	}

	async setContent(
		collection: string,
		slug: string,
		data: CachedItemContent,
	): Promise<void> {
		await this.kv.put(
			contentKey(this.prefix, collection, slug),
			JSON.stringify(data),
		);
	}

	async invalidate(scope: InvalidateScope): Promise<void> {
		if (scope === "all") {
			await this.deletePrefix(this.prefix);
			return;
		}
		const kind = scope.kind ?? "all";
		const collection = scope.collection;

		if ("slug" in scope) {
			const tasks: Promise<unknown>[] = [];
			if (kind === "all" || kind === "meta") {
				tasks.push(
					this.kv.delete(metaKey(this.prefix, collection, scope.slug)),
				);
			}
			if (kind === "all" || kind === "content") {
				tasks.push(
					this.kv.delete(contentKey(this.prefix, collection, scope.slug)),
				);
			}
			await Promise.all(tasks);
			return;
		}

		const tasks: Promise<unknown>[] = [];
		if (kind === "all" || kind === "meta") {
			tasks.push(
				this.kv.delete(listKey(this.prefix, collection)),
				this.deletePrefix(`${this.prefix}meta:${collection}:`),
			);
		}
		if (kind === "all" || kind === "content") {
			tasks.push(this.deletePrefix(`${this.prefix}content:${collection}:`));
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
 * Cloudflare KV を document キャッシュとして使うアダプタ。
 * `handles: ["document"]` のみで image は別アダプタ (例: `r2Cache`) と組み合わせる。
 *
 * @example
 * cache: [kvCache({ namespace: env.DOC_CACHE }), r2Cache({ bucket: env.IMG_BUCKET })]
 */
export function kvCache(opts: KVCacheOptions): CacheAdapter {
	return {
		name: "kv",
		handles: ["document"] as const,
		doc: new KVDocumentOps(opts.namespace, opts.prefix ?? ""),
	};
}

// ── R2 (image only by default; document opt-in via doc:true) ───────────────────

export interface R2CacheOptions {
	bucket: R2BucketLike;
	/** キャッシュキーのプレフィックス。デフォルト: '' */
	prefix?: string;
	/**
	 * 既定では image のみ担当する。`doc: true` で document も同じバケットに保存する。
	 * 大きなブログでは KV (`kvCache`) を併用するほうが I/O 効率が良い。
	 */
	doc?: boolean;
}

class R2DocumentOps implements DocumentCacheOps {
	constructor(
		private readonly bucket: R2BucketLike,
		private readonly prefix: string,
	) {}

	async getList<T extends BaseContentItem>(
		collection: string,
	): Promise<CachedItemList<T> | null> {
		const obj = await this.bucket.get(`${this.prefix}list/${collection}.json`);
		if (!obj) return null;
		return (obj as R2ObjectLike).json<CachedItemList<T>>();
	}

	async setList<T extends BaseContentItem>(
		collection: string,
		data: CachedItemList<T>,
	): Promise<void> {
		await this.bucket.put(
			`${this.prefix}list/${collection}.json`,
			JSON.stringify(data),
			{ httpMetadata: { contentType: "application/json" } },
		);
	}

	async getMeta<T extends BaseContentItem>(
		collection: string,
		slug: string,
	): Promise<CachedItemMeta<T> | null> {
		const obj = await this.bucket.get(
			`${this.prefix}meta/${collection}/${slug}.json`,
		);
		if (!obj) return null;
		return (obj as R2ObjectLike).json<CachedItemMeta<T>>();
	}

	async setMeta<T extends BaseContentItem>(
		collection: string,
		slug: string,
		data: CachedItemMeta<T>,
	): Promise<void> {
		await this.bucket.put(
			`${this.prefix}meta/${collection}/${slug}.json`,
			JSON.stringify(data),
			{ httpMetadata: { contentType: "application/json" } },
		);
	}

	async getContent(
		collection: string,
		slug: string,
	): Promise<CachedItemContent | null> {
		const obj = await this.bucket.get(
			`${this.prefix}content/${collection}/${slug}.json`,
		);
		if (!obj) return null;
		return (obj as R2ObjectLike).json<CachedItemContent>();
	}

	async setContent(
		collection: string,
		slug: string,
		data: CachedItemContent,
	): Promise<void> {
		await this.bucket.put(
			`${this.prefix}content/${collection}/${slug}.json`,
			JSON.stringify(data),
			{ httpMetadata: { contentType: "application/json" } },
		);
	}

	async invalidate(scope: InvalidateScope): Promise<void> {
		if (scope === "all") {
			await Promise.all([
				this.deletePrefix(`${this.prefix}list/`),
				this.deletePrefix(`${this.prefix}meta/`),
				this.deletePrefix(`${this.prefix}content/`),
			]);
			return;
		}
		const kind = scope.kind ?? "all";
		const collection = scope.collection;

		if ("slug" in scope) {
			const tasks: Promise<unknown>[] = [];
			if (kind === "all" || kind === "meta") {
				tasks.push(
					this.bucket.delete(
						`${this.prefix}meta/${collection}/${scope.slug}.json`,
					),
				);
			}
			if (kind === "all" || kind === "content") {
				tasks.push(
					this.bucket.delete(
						`${this.prefix}content/${collection}/${scope.slug}.json`,
					),
				);
			}
			await Promise.all(tasks);
			return;
		}

		const tasks: Promise<unknown>[] = [];
		if (kind === "all" || kind === "meta") {
			tasks.push(
				this.bucket.delete(`${this.prefix}list/${collection}.json`),
				this.deletePrefix(`${this.prefix}meta/${collection}/`),
			);
		}
		if (kind === "all" || kind === "content") {
			tasks.push(this.deletePrefix(`${this.prefix}content/${collection}/`));
		}
		await Promise.all(tasks);
	}

	private async deletePrefix(prefix: string): Promise<void> {
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
}

class R2ImageOps implements ImageCacheOps {
	constructor(
		private readonly bucket: R2BucketLike,
		private readonly prefix: string,
	) {}

	async get(hash: string): Promise<StorageBinary | null> {
		const obj = await this.bucket.get(`${this.prefix}images/${hash}`);
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
		await this.bucket.put(`${this.prefix}images/${hash}`, data, {
			httpMetadata: { contentType },
		});
	}
}

/**
 * Cloudflare R2 を画像キャッシュとして使うアダプタ。
 * 既定では `handles: ["image"]` のみ。`doc: true` で document も同じバケットに保存する。
 *
 * @example
 * cache: r2Cache({ bucket: env.IMG_BUCKET })
 */
export function r2Cache(opts: R2CacheOptions): CacheAdapter {
	const prefix = opts.prefix ?? "";
	const handles: ("document" | "image")[] = ["image"];
	const adapter: CacheAdapter = {
		name: "r2",
		handles,
		img: new R2ImageOps(opts.bucket, prefix),
	};
	if (opts.doc) {
		handles.unshift("document");
		adapter.doc = new R2DocumentOps(opts.bucket, prefix);
	}
	return adapter;
}

// ── cloudflareCache (KV + R2 ショートカット) ───────────────────────────────

/** `cloudflareCache(env)` が参照する Workers の env。 */
export interface CloudflareEnv {
	/** ドキュメントキャッシュ用 KV namespace (binding 名は変更可)。 */
	DOC_CACHE?: KVNamespaceLike;
	/** 画像キャッシュ用 R2 バケット (binding 名は変更可)。 */
	IMG_BUCKET?: R2BucketLike;
}

export interface CloudflareCacheOptions {
	/**
	 * binding 名のカスタマイズ。既定: `{ docCache: "DOC_CACHE", imgBucket: "IMG_BUCKET" }`。
	 */
	bindings?: { docCache?: string; imgBucket?: string };
	/** キャッシュキーのプレフィックス。デフォルト: '' */
	prefix?: string;
}

/**
 * Cloudflare Workers の env から KV (document) + R2 (image) アダプタ配列を生成するショートカット。
 * binding が未設定の場合は対応するアダプタを省略する。
 *
 * @example
 * createCMS({
 *   collections: { posts: ... },
 *   cache: cloudflareCache(env),
 * });
 */
export function cloudflareCache(
	env: CloudflareEnv,
	opts: CloudflareCacheOptions = {},
): CacheAdapter[] {
	const docKey = opts.bindings?.docCache ?? "DOC_CACHE";
	const imgKey = opts.bindings?.imgBucket ?? "IMG_BUCKET";
	const prefix = opts.prefix ?? "";

	const adapters: CacheAdapter[] = [];
	const kvNs = (env as Record<string, unknown>)[docKey] as
		| KVNamespaceLike
		| undefined;
	const r2Bucket = (env as Record<string, unknown>)[imgKey] as
		| R2BucketLike
		| undefined;

	if (kvNs) adapters.push(kvCache({ namespace: kvNs, prefix }));
	if (r2Bucket) adapters.push(r2Cache({ bucket: r2Bucket, prefix }));
	return adapters;
}
