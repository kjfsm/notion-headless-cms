import type { BaseContentItem } from "./content";

/** ソース側クエリのフィルタ・ソート条件。 */
export interface SourceQueryOptions {
	filter?: {
		statuses?: string[];
		tags?: string[];
		[key: string]: unknown;
	};
	sort?: { property: string; direction: "asc" | "desc" }[];
	pageSize?: number;
	cursor?: string;
}

/** ソース側クエリの結果。 */
export interface SourceQueryResult<T> {
	items: T[];
	hasMore: boolean;
	nextCursor?: string;
}

/**
 * コンテンツソース（Notion など）を抽象化するインターフェース。
 * core は Notion の知識を持たず、DataSourceAdapter 経由でのみデータを取得する。
 */
export interface DataSourceAdapter<
	T extends BaseContentItem = BaseContentItem,
> {
	readonly name: string;
	readonly publishedStatuses?: readonly string[];
	readonly accessibleStatuses?: readonly string[];
	list(opts?: { publishedStatuses?: readonly string[] }): Promise<T[]>;
	findBySlug(slug: string): Promise<T | null>;
	loadMarkdown(item: T): Promise<string>;
	/** Notion 側でフィルタ・ソートを行うクエリ（オプション）。 */
	query?(opts: SourceQueryOptions): Promise<SourceQueryResult<T>>;
}
