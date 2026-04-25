import type { ContentBlock } from "../content/blocks";

/**
 * ライブラリが動作するために必須なフィールド。
 * 利用者はこのインターフェースを拡張して独自のコンテンツ型を定義する。
 *
 * @example
 * interface Post extends BaseContentItem {
 *   title: string;
 *   author: string;
 * }
 * createCMS<Post>({ source: createNotionCollection({ ... }) })
 */
export interface BaseContentItem {
	/** Notion ページ ID（変更検知に必須）。 */
	id: string;
	/** URL キー（必須）。 */
	slug: string;
	/** Notion ページ名（title 型プロパティのテキスト）。 */
	title?: string | null;
	/** 最終更新タイムスタンプ（変更検知に必須）。 */
	updatedAt: string;
	/** コンテンツのステータス。ステータスのない DB では省略可能。 */
	status?: string;
	/** 公開日時。日付プロパティのない DB では省略可能。 */
	publishedAt?: string;
}

/** ストレージにキャッシュされたレンダリング済みコンテンツ。 */
export interface CachedItem<T extends BaseContentItem = BaseContentItem> {
	html: string;
	item: T;
	notionUpdatedAt: string;
	cachedAt: number;
	blocks?: ContentBlock[];
	markdown?: string;
}

/** ストレージにキャッシュされたコンテンツ一覧。 */
export interface CachedItemList<T extends BaseContentItem = BaseContentItem> {
	items: T[];
	cachedAt: number;
}

/** ストレージから取得したバイナリオブジェクト。 */
export interface StorageBinary {
	data: ArrayBuffer;
	contentType?: string;
}

/** Notionのプロパティ名マッピング（すべてオプション）。 */
export interface CMSSchemaProperties {
	/** Notionのスラッグプロパティ名。デフォルト: 'Slug' */
	slug?: string;
	/** Notionのステータスプロパティ名。デフォルト: 'Status' */
	status?: string;
	/** Notionの公開日プロパティ名。デフォルト: 'CreatedAt' */
	date?: string;
}
