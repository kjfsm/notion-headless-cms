import type { ContentBlock } from "../content/blocks";
import type { BaseContentItem } from "./content";

/**
 * `where` フィルタの型。各フィールドに単一値、または OR 候補の配列を指定できる。
 * 配列を渡すと「いずれかに一致」(in-match) になる。
 */
export type WhereClause<T extends BaseContentItem> = {
  [K in keyof T]?: T[K] | readonly T[K][];
};

/** 並び順指定。 */
export interface SortOption<T extends BaseContentItem = BaseContentItem> {
  /** ソートするプロパティ名。 */
  by: keyof T & string;
  /** 昇順 / 降順。デフォルト "desc"。 */
  dir?: "asc" | "desc";
  /** カスタム comparator。指定した場合 `by` / `dir` より優先される。 */
  compare?: (a: T, b: T) => number;
}

/** `list()` のオプション。ページ取得に必要な絞り込み・ソート・ページングを表現する。 */
export interface ListOptions<T extends BaseContentItem = BaseContentItem> {
  /** ステータス絞り込み (`publishedStatuses` を上書き)。単一値または配列で指定。 */
  statuses?: string | readonly string[];
  /** プロパティ一致フィルタ (in-memory フィルタ)。配列は OR 一致。 */
  where?: WhereClause<T>;
  /** 任意ロジックのフィルタ関数。`where` より後に適用される。 */
  filter?: (item: T) => boolean;
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

/** `find()` のオプション。 */
export interface FindOptions {
  /** true なら TTL に関わらずブロッキングで再取得し、本文 cache を破棄する。 */
  bypassCache?: boolean;
}

/**
 * `find()` の戻り値。アイテム本体に `html()` / `markdown()` / `blocks()` が生える。
 * これらを呼んだ時点で初めて本文をロードする lazy 設計。
 */
export type ItemWithContent<T extends BaseContentItem> = T & {
  /** HTML 文字列を返す。 */
  html(): Promise<string>;
  /** Markdown 文字列を返す。 */
  markdown(): Promise<string>;
  /** コンテンツ AST（ContentBlock 配列）を返す。 */
  blocks(): Promise<ContentBlock[]>;
  /**
   * Notion API のブロックツリー（`BlockObjectResponse + children`）を返す。
   * DataSource が `loadNotionBlocks` を実装している場合のみ非 undefined。
   * react-renderer 等の Notion 固有 renderer に渡すために使う。
   * core はゼロ依存ルールに従い `unknown[]` 型として扱う（利用側でキャスト）。
   */
  notionBlocks(): Promise<unknown[] | undefined>;
};

/** `cache.warm()` のオプション。 */
export interface WarmOptions {
  /** 並列度。デフォルトは createCMS の rateLimiter.maxConcurrent。 */
  concurrency?: number;
  /** 進捗コールバック。 */
  onProgress?: (done: number, total: number) => void;
}

/** `cache.warm()` の戻り値。 */
export interface WarmResult {
  ok: number;
  failed: Array<{ slug: string; error: unknown }>;
}

/** コレクションごとのキャッシュ操作 namespace。 */
// biome-ignore lint/correctness/noUnusedVariables: <T> は将来の拡張のために保持
export interface CollectionCacheOps<T extends BaseContentItem> {
  /**
   * コレクション全体のキャッシュを失効させる。
   * 次回 `get` / `list` で source から再取得される。
   */
  invalidate(): Promise<void>;

  /**
   * 指定 slug のアイテムキャッシュを失効させる。
   * 次回 `get` で source から再取得される。
   */
  invalidateItem(slug: string): Promise<void>;

  /**
   * 全アイテムを並列に事前取得・レンダリングしてキャッシュに格納する。
   * SSG ビルド前のウォームアップに利用する。
   */
  warm(opts?: WarmOptions): Promise<WarmResult>;
}

/** `check()` の戻り値。差分なしか、差分ありの場合はアイテムを含む。 */
export type CheckResult<T extends BaseContentItem> =
  | { stale: false }
  | { stale: true; item: ItemWithContent<T> };

/**
 * コレクション別の CMS クライアント。
 * `cms.posts.find(slug)` / `cms.posts.list()` のようにアクセスする。
 */
export interface CollectionClient<T extends BaseContentItem = BaseContentItem> {
  /**
   * スラッグで単件取得。アイテム本体に `html()` / `markdown()` / `blocks()` が生える。
   *
   * SWR: TTL 未設定 or 期限内ならキャッシュ即時返却 + バックグラウンド差分チェック。
   *      TTL 期限切れ、または `opts.bypassCache === true` でブロッキング取得。
   *
   * @returns キャッシュまたは source から取得したアイテム。存在しない場合は null。
   */
  find(slug: string, opts?: FindOptions): Promise<ItemWithContent<T> | null>;

  /** 公開済みアイテム一覧を取得する。 */
  list(opts?: ListOptions<T>): Promise<T[]>;

  /** コレクション内の全スラッグを返す。`generateStaticParams` 等の SSG パラメータ生成に利用する。 */
  params(): Promise<string[]>;

  /**
   * Notion から最新版を取得し、`currentVersion`（`item.lastEditedTime`）と比較する。
   * 差分があればキャッシュを更新してアイテムを返す。
   * ページ表示後の1回限りのクライアント再検証エンドポイント用。
   *
   * @returns 差分なし: `{ stale: false }`、差分あり: `{ stale: true; item }`、
   *          アイテムが存在しない: `null`
   */
  check(slug: string, currentVersion: string): Promise<CheckResult<T> | null>;

  /** 前後アイテムのナビゲーション (リスト順序ベース)。 */
  adjacent(
    slug: string,
    opts?: AdjacencyOptions<T>,
  ): Promise<{ prev: T | null; next: T | null }>;

  /** キャッシュ操作 namespace。 */
  cache: CollectionCacheOps<T>;
}
