import type { ContentResult } from "../content/blocks";
import type { BaseContentItem } from "./content";

/** 並び順指定。 */
export interface SortOption<T extends BaseContentItem = BaseContentItem> {
	/** ソートするプロパティ名。 */
	by: keyof T & string;
	/** 昇順 / 降順。デフォルト "desc"。 */
	direction?: "asc" | "desc";
}

/** `getList` のフィルタ / ソート / ページング。 */
export interface GetListOptions<T extends BaseContentItem = BaseContentItem> {
	/** ステータス絞り込み (`publishedStatuses` を上書き)。 */
	statuses?: string[];
	/** プロパティ一致フィルタ (in-memory フィルタ)。 */
	where?: Partial<Record<keyof T, unknown>>;
	/** タグ絞り込み (schema に tags: string[] フィールドがある場合)。 */
	tag?: string;
	/** ソート。デフォルトは publishedAt の降順。 */
	sort?: SortOption<T>;
	/** 最大件数。 */
	limit?: number;
	/** スキップ件数。 */
	skip?: number;
}

/** `adjacent` の並び順指定。 */
export interface AdjacencyOptions<T extends BaseContentItem = BaseContentItem> {
	sort?: SortOption<T>;
}

/** `getItem` の返り値 (本文常時同梱)。 */
export type ItemWithContent<T extends BaseContentItem> = T & {
	content: ContentResult;
};

/**
 * コレクション別の CMS クライアント。
 * `cms.posts.getItem(slug)` のようにアクセスする。
 */
export interface CollectionClient<T extends BaseContentItem = BaseContentItem> {
	// --- 基本取得 ---
	/** スラッグで単件取得 (本文込み)。キャッシュを経由 (SWR)。 */
	getItem(slug: string): Promise<ItemWithContent<T> | null>;

	/** 公開済みアイテム一覧 (本文なし、一覧ページ向け)。 */
	getList(opts?: GetListOptions<T>): Promise<T[]>;

	// --- SSG / ナビゲーション ---
	/** Next App Router の `generateStaticParams` 向け。 */
	getStaticParams(): Promise<{ slug: string }[]>;

	/** SSG のパス一覧 (スラッグ配列)。 */
	getStaticPaths(): Promise<string[]>;

	/** 前後記事のナビゲーション。 */
	adjacent(
		slug: string,
		opts?: AdjacencyOptions<T>,
	): Promise<{ prev: T | null; next: T | null }>;

	// --- キャッシュ ---
	/** 指定スコープのキャッシュを無効化する。 */
	revalidate(scope?: "all" | { slug: string }): Promise<void>;

	/** 全コンテンツをプリフェッチしてキャッシュに保存。 */
	prefetch(opts?: {
		concurrency?: number;
		onProgress?: (done: number, total: number) => void;
	}): Promise<{ ok: number; failed: number }>;
}
