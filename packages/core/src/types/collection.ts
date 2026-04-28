import type { BaseContentItem } from "./content";

/** 並び順指定。 */
export interface SortOption<T extends BaseContentItem = BaseContentItem> {
	/** ソートするプロパティ名。 */
	by: keyof T & string;
	/** 昇順 / 降順。デフォルト "desc"。 */
	dir?: "asc" | "desc";
}

/** `list()` のオプション。ページ取得に必要な絞り込み・ソート・ページングを表現する。 */
export interface ListOptions<T extends BaseContentItem = BaseContentItem> {
	/** ステータス絞り込み (`publishedStatuses` を上書き)。 */
	status?: string | readonly string[];
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

/** `cache.adjacent` のオプション。 */
export interface AdjacencyOptions<T extends BaseContentItem = BaseContentItem> {
	sort?: SortOption<T>;
}

/** `get()` のオプション。 */
export interface GetOptions {
	/** true なら TTL に関わらずブロッキングで再取得し、本文 cache を破棄する。 */
	fresh?: boolean;
}

/**
 * `get()` の戻り値。アイテム本体に `render()` が生える。
 * `render()` を呼んだ時点で初めて本文をロードする lazy 設計。
 */
export type ItemWithRender<T extends BaseContentItem> = T & {
	/**
	 * 本文を文字列で返す。デフォルトは HTML。
	 * `format: "markdown"` で Markdown を返す。
	 */
	render(opts?: { format?: "html" | "markdown" }): Promise<string>;
};

/** `cache.warm()` のオプション。 */
export interface WarmOptions {
	/** 並列度。デフォルトは createCMS の rateLimiter.maxConcurrent。 */
	concurrency?: number;
	/** 進捗コールバック。 */
	onProgress?: (done: number, total: number) => void;
}

/** コレクションごとのキャッシュ操作 namespace。 */
export interface CollectionCacheOps<T extends BaseContentItem> {
	/**
	 * 指定 slug、または slug 省略時はコレクション全体のキャッシュを失効させる。
	 * 次回 `get` / `list` で source から再取得される。
	 */
	invalidate(slug?: string): Promise<void>;

	/**
	 * 全アイテムを並列に事前取得・レンダリングしてキャッシュに格納する。
	 * SSG ビルド前のウォームアップに利用する。
	 */
	warm(opts?: WarmOptions): Promise<{ ok: number; failed: number }>;

	/** 前後アイテムのナビゲーション (リスト順序ベース)。 */
	adjacent(
		slug: string,
		opts?: AdjacencyOptions<T>,
	): Promise<{ prev: T | null; next: T | null }>;
}

/** `check()` の戻り値。差分なしか、差分ありの場合はアイテムを含む。 */
export type CheckResult<T extends BaseContentItem> =
	| { stale: false }
	| { stale: true; item: ItemWithRender<T> };

/**
 * コレクション別の CMS クライアント。
 * `cms.posts.get(slug)` / `cms.posts.list()` のようにアクセスする。
 */
export interface CollectionClient<T extends BaseContentItem = BaseContentItem> {
	/**
	 * スラッグで単件取得。アイテム本体に `render()` が生える。
	 *
	 * SWR: TTL 未設定 or 期限内ならキャッシュ即時返却 + バックグラウンド差分チェック。
	 *      TTL 期限切れ、または `opts.fresh === true` でブロッキング取得。
	 *
	 * @returns キャッシュまたは source から取得したアイテム。存在しない場合は null。
	 */
	get(slug: string, opts?: GetOptions): Promise<ItemWithRender<T> | null>;

	/** 公開済みアイテム一覧を取得する。 */
	list(opts?: ListOptions<T>): Promise<T[]>;

	/** SSG パラメータ生成 (Next App Router の `generateStaticParams` 互換)。 */
	params(): Promise<{ slug: string }[]>;

	/**
	 * Notion から最新版を取得し、`currentVersion`（`item.updatedAt`）と比較する。
	 * 差分があればキャッシュを更新してアイテムを返す。
	 * ページ表示後の1回限りのクライアント再検証エンドポイント用。
	 *
	 * @returns 差分なし: `{ stale: false }`、差分あり: `{ stale: true; item }`、
	 *          アイテムが存在しない: `null`
	 */
	check(slug: string, currentVersion: string): Promise<CheckResult<T> | null>;

	/** キャッシュ操作 namespace。 */
	cache: CollectionCacheOps<T>;
}
