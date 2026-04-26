import type {
	BaseContentItem,
	CachedItemContent,
	CachedItemList,
	CachedItemMeta,
	DocumentCacheAdapter,
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

/** コレクション単位の規約タグ。 */
function collectionTag(collection: string): string {
	return `nhc:col:${collection}`;
}

/** スラッグ単位（メタ）の規約タグ。 */
function slugMetaTag(collection: string, slug: string): string {
	return `nhc:col:${collection}:slug:${slug}:meta`;
}

/** スラッグ単位（本文）の規約タグ。 */
function slugContentTag(collection: string, slug: string): string {
	return `nhc:col:${collection}:slug:${slug}:content`;
}

/**
 * Next.js App Router の unstable_cache / revalidateTag を利用した DocumentCacheAdapter。
 *
 * setList / setItemMeta / setItemContent は no-op（Next.js がキャッシュ層を管理する）。
 * invalidate は規約タグを kind 別 (`:meta` / `:content`) に revalidateTag する。
 */
class NextDocumentCache<T extends BaseContentItem = BaseContentItem>
	implements DocumentCacheAdapter<T>
{
	readonly name = "next-cache";
	private readonly opts: Required<NextCacheOptions>;

	constructor(opts: NextCacheOptions = {}) {
		this.opts = {
			revalidate: opts.revalidate ?? 300,
			tags: opts.tags ?? [],
		};
	}

	async getList(): Promise<CachedItemList<T> | null> {
		return null;
	}

	async setList(_data: CachedItemList<T>): Promise<void> {}

	async getItemMeta(_slug: string): Promise<CachedItemMeta<T> | null> {
		return null;
	}

	async setItemMeta(_slug: string, _data: CachedItemMeta<T>): Promise<void> {}

	async getItemContent(_slug: string): Promise<CachedItemContent | null> {
		return null;
	}

	async setItemContent(
		_slug: string,
		_data: CachedItemContent,
	): Promise<void> {}

	async invalidate(scope: InvalidateScope): Promise<void> {
		// next/cache は動的インポートで参照（ビルド時の型エラー回避）
		const nc = (await import("next/cache")) as unknown as {
			revalidateTag: (tag: string) => void;
		};

		if (scope === "all") {
			for (const tag of this.opts.tags) {
				nc.revalidateTag(tag);
			}
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

		// collection スコープは粒度を分けても tag を持たないので、kind に関わらず collection tag を一発で revalidate する
		nc.revalidateTag(collectionTag(scope.collection));
	}
}

/** Next.js App Router 向け DocumentCacheAdapter を生成するファクトリ。 */
export function nextCache<T extends BaseContentItem = BaseContentItem>(
	opts?: NextCacheOptions,
): DocumentCacheAdapter<T> {
	return new NextDocumentCache<T>(opts);
}
