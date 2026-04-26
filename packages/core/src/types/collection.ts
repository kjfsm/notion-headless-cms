import type { ContentResult } from "../content/blocks";
import type {
	BaseContentItem,
	CachedItemContent,
	ItemContentPayload,
} from "./content";

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

/**
 * `getItem` の返り値（メタデータ + lazy 本文アクセサ）。
 * `content.html()` / `content.markdown()` / `content.blocks` を呼んだ時点で
 * 初めてキャッシュ層から本文をロードする（または再生成する）。
 */
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
 *
 * **本文（HTML 等）は含めない**。差分判定はメタデータのみで完結し、
 * 本文は `invalidate({ kind: "content" })` で失効 + バックグラウンド再生成される。
 * クライアント側 (useSWR) は `mutate(metaKey, result.meta)` と `mutate(contentKey)` を
 * 順に呼ぶことで透過的に最新化できる。
 */
export type CheckForUpdateResult<T extends BaseContentItem = BaseContentItem> =
	| { changed: false }
	| { changed: true; meta: T };

/**
 * `checkListForUpdate` の戻り値。
 * changed: true の場合は最新のアイテム配列とバージョンを含む。
 */
export type CheckListForUpdateResult<
	T extends BaseContentItem = BaseContentItem,
> = { changed: false } | { changed: true; items: T[]; version: string };

/** `ItemContentPayload` を再 export（クライアント側で型を引きやすくするため）。 */
export type { CachedItemContent, ItemContentPayload };

/**
 * コレクション別の CMS クライアント。
 * `cms.posts.getItem(slug)` のようにアクセスする。
 */
export interface CollectionClient<T extends BaseContentItem = BaseContentItem> {
	// --- 基本取得 ---
	/**
	 * スラッグで単件取得 (本文 lazy アクセサ付き)。
	 *
	 * メタデータはキャッシュ or Notion から即時取得し、
	 * 本文（html/markdown/blocks）は `result.content.*()` を呼んだ時点で初めてロードする。
	 *
	 * SWR: TTL 未設定 or 期限内ならキャッシュ即時返却 + バックグラウンド差分チェック。
	 *      TTL 期限切れならブロッキングフェッチ。
	 *
	 * @returns キャッシュまたは Notion から取得したアイテム。存在しない場合は null。
	 */
	getItem(slug: string): Promise<ItemWithContent<T> | null>;

	/**
	 * メタデータのみを取得する軽量 API。
	 * `useSWR("/api/.../meta", () => cms.posts.getItemMeta(slug))` のような形で
	 * クライアントから fetcher として直接呼べる。本文は含まれない。
	 */
	getItemMeta(slug: string): Promise<T | null>;

	/**
	 * 本文ペイロード（html/markdown/blocks）を取得する。
	 * `useSWR("/api/.../content", () => cms.posts.getItemContent(slug))` で利用。
	 * 関数を含まない pure JSON を返す。
	 */
	getItemContent(slug: string): Promise<ItemContentPayload | null>;

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
	 * 指定スラッグのアイテムキャッシュを無効化する（メタ + 本文両方）。
	 * 次回の getItem 呼び出しで Notion から再取得される。
	 */
	revalidate(slug: string): Promise<void>;

	/** コレクション全体のキャッシュを無効化する。 */
	revalidateAll(): Promise<void>;

	/**
	 * 指定アイテムが since 以降に更新されたか確認する。
	 *
	 * メタデータのみを比較する軽量 API（本文 cache は破棄しない）。
	 * 差分があれば本文 cache を `kind: "content"` で失効させ、
	 * バックグラウンドで再生成を発火する（`waitUntil` あり時）。
	 *
	 * クライアント側 (useSWR) は戻り値の meta で `mutate(metaKey, meta)` し、
	 * `mutate(contentKey)` を呼べば透過的に最新化される。
	 */
	checkForUpdate(args: {
		slug: string;
		since: string;
	}): Promise<CheckForUpdateResult<T>>;

	/**
	 * リスト全体が since 以降に更新されたか確認する。
	 * 差分があった場合のみリストキャッシュを書き換える（本文 cache は触らない）。
	 */
	checkListForUpdate(args: {
		since: string;
		filter?: GetListOptions<T>;
	}): Promise<CheckListForUpdateResult<T>>;

	/** 全コンテンツをプリフェッチしてキャッシュ（メタ + 本文）に保存。 */
	prefetch(opts?: {
		concurrency?: number;
		onProgress?: (done: number, total: number) => void;
	}): Promise<{ ok: number; failed: number }>;
}
