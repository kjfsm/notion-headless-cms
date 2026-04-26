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
 * `getList` の戻り値。アイテム配列とバージョン文字列を含む。
 * version は DataSource.getListVersion() が生成するフィルタ済みアイテムの識別子。
 */
export interface GetListResult<T extends BaseContentItem = BaseContentItem> {
	items: T[];
	/** フィルタ適用後のアイテム群を識別するバージョン文字列。 */
	version: string;
}

/**
 * `checkForUpdate` の戻り値。
 * changed: true の場合は最新の ItemWithContent を含む。
 */
export type CheckForUpdateResult<T extends BaseContentItem = BaseContentItem> =
	| { changed: false }
	| { changed: true; item: ItemWithContent<T> };

/**
 * `checkListForUpdate` の戻り値。
 * changed: true の場合は最新のアイテム配列とバージョンを含む。
 */
export type CheckListForUpdateResult<
	T extends BaseContentItem = BaseContentItem,
> = { changed: false } | { changed: true; items: T[]; version: string };

/**
 * コレクション別の CMS クライアント。
 * `cms.posts.getItem(slug)` のようにアクセスする。
 */
export interface CollectionClient<T extends BaseContentItem = BaseContentItem> {
	// --- 基本取得 ---
	/**
	 * スラッグで単件取得 (本文込み)。
	 *
	 * キャッシュヒット時はキャッシュを即時返却する (SWR)。
	 * TTL が切れている場合はブロッキングで Notion から再取得する。
	 * TTL 未設定の場合はキャッシュを即時返却しバックグラウンドで差分チェックする。
	 * 明示的に同期リフレッシュしたい場合は {@link revalidate} を先に呼ぶ。
	 *
	 * @returns キャッシュまたは Notion から取得したアイテム。存在しない場合は null。
	 */
	getItem(slug: string): Promise<ItemWithContent<T> | null>;

	/** 公開済みアイテム一覧 (本文なし、一覧ページ向け)。items とバージョン文字列を返す。 */
	getList(opts?: GetListOptions<T>): Promise<GetListResult<T>>;

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
	/**
	 * 指定スラッグのアイテムキャッシュを無効化する。
	 * 次回の getItem 呼び出しで Notion から再取得される。
	 */
	revalidate(slug: string): Promise<void>;

	/** コレクション全体のキャッシュを無効化する。 */
	revalidateAll(): Promise<void>;

	/**
	 * 指定アイテムが since 以降に更新されたか確認する。
	 * 内部で revalidate → getItem を実行し updatedAt を比較する。
	 * 更新があった場合は最新の ItemWithContent を返す。
	 */
	checkForUpdate(args: {
		slug: string;
		since: string;
	}): Promise<CheckForUpdateResult<T>>;

	/**
	 * リスト全体が since 以降に更新されたか確認する。
	 * 内部で revalidateAll → getList を実行しバージョンを比較する。
	 * 更新があった場合は最新の items と version を返す。
	 */
	checkListForUpdate(args: {
		since: string;
		filter?: GetListOptions<T>;
	}): Promise<CheckListForUpdateResult<T>>;

	/** 全コンテンツをプリフェッチしてキャッシュに保存。 */
	prefetch(opts?: {
		concurrency?: number;
		onProgress?: (done: number, total: number) => void;
	}): Promise<{ ok: number; failed: number }>;
}
