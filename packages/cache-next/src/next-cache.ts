import type {
	BaseContentItem,
	CachedItem,
	CachedItemList,
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

/** スラッグ単位の規約タグ。 */
function slugTag(collection: string, slug: string): string {
	return `nhc:col:${collection}:slug:${slug}`;
}

/**
 * Next.js App Router の unstable_cache / revalidateTag を利用した DocumentCacheAdapter。
 * setList / setItem は no-op（Next.js がキャッシュを管理するため）。
 * invalidate は規約タグ (`nhc:col:<name>` / `nhc:col:<name>:slug:<slug>`) と
 * ユーザー指定タグを revalidateTag で失効させる。
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

	async setList(_data: CachedItemList<T>): Promise<void> {
		// Next.js のキャッシュ層が管理するため no-op
	}

	async getItem(_slug: string): Promise<CachedItem<T> | null> {
		return null;
	}

	async setItem(_slug: string, _data: CachedItem<T>): Promise<void> {
		// Next.js のキャッシュ層が管理するため no-op
	}

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

		nc.revalidateTag(collectionTag(scope.collection));
		if ("slug" in scope) {
			nc.revalidateTag(slugTag(scope.collection, scope.slug));
		}
	}
}

/** Next.js App Router 向け DocumentCacheAdapter を生成するファクトリ。 */
export function nextCache<T extends BaseContentItem = BaseContentItem>(
	opts?: NextCacheOptions,
): DocumentCacheAdapter<T> {
	return new NextDocumentCache<T>(opts);
}
