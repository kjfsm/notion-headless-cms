import type {
	BaseContentItem,
	CacheAdapter,
	CachedItemContent,
	CachedItemList,
	CachedItemMeta,
	DocumentCacheOps,
	InvalidateScope,
} from "@notion-headless-cms/core";

export interface NextCacheOptions {
	/** Next.js ISR の revalidate 秒数。デフォルト: 300 */
	revalidate?: number;
	/**
	 * ユーザーが任意に設定する追加タグ。
	 * `invalidate("all")` 時にまとめて revalidateTag される。
	 */
	tags?: string[];
}

const collectionTag = (collection: string): string => `nhc:col:${collection}`;
const slugMetaTag = (collection: string, slug: string): string =>
	`nhc:col:${collection}:slug:${slug}:meta`;
const slugContentTag = (collection: string, slug: string): string =>
	`nhc:col:${collection}:slug:${slug}:content`;

class NextDocumentOps implements DocumentCacheOps {
	constructor(private readonly tags: string[]) {}

	getList<T extends BaseContentItem>(
		_collection: string,
	): Promise<CachedItemList<T> | null> {
		// Next.js 側で unstable_cache が wrap するため adapter は always-miss でよい
		return Promise.resolve(null);
	}
	setList<T extends BaseContentItem>(
		_collection: string,
		_data: CachedItemList<T>,
	): Promise<void> {
		return Promise.resolve();
	}
	getMeta<T extends BaseContentItem>(
		_collection: string,
		_slug: string,
	): Promise<CachedItemMeta<T> | null> {
		return Promise.resolve(null);
	}
	setMeta<T extends BaseContentItem>(
		_collection: string,
		_slug: string,
		_data: CachedItemMeta<T>,
	): Promise<void> {
		return Promise.resolve();
	}
	getContent(
		_collection: string,
		_slug: string,
	): Promise<CachedItemContent | null> {
		return Promise.resolve(null);
	}
	setContent(
		_collection: string,
		_slug: string,
		_data: CachedItemContent,
	): Promise<void> {
		return Promise.resolve();
	}

	async invalidate(scope: InvalidateScope): Promise<void> {
		// next/cache は動的インポートで参照（ビルド時の型エラー回避）
		const nc = (await import("next/cache")) as unknown as {
			revalidateTag: (tag: string) => void;
		};

		if (scope === "all") {
			for (const tag of this.tags) nc.revalidateTag(tag);
			return;
		}

		const kind = scope.kind ?? "all";

		if ("slug" in scope) {
			if (kind === "all" || kind === "meta") {
				nc.revalidateTag(slugMetaTag(scope.collection, scope.slug));
			}
			if (kind === "all" || kind === "content") {
				nc.revalidateTag(slugContentTag(scope.collection, scope.slug));
			}
			return;
		}

		// collection スコープは粒度を分けても tag を持たないので、kind に関わらず collection tag を一発で revalidate
		nc.revalidateTag(collectionTag(scope.collection));
	}
}

/**
 * Next.js App Router 向け document キャッシュアダプタ。
 * `unstable_cache` / `revalidateTag` を利用する。`handles: ["document"]` のみ。
 */
export function nextCache(opts: NextCacheOptions = {}): CacheAdapter {
	return {
		name: "next",
		handles: ["document"] as const,
		doc: new NextDocumentOps(opts.tags ?? []),
	};
}
