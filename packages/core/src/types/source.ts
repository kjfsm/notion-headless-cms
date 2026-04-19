import type { BaseContentItem } from "./content";

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
}
