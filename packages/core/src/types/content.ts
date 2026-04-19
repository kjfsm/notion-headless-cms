/**
 * ライブラリが動作するために必須なフィールド。
 * 利用者はこのインターフェースを拡張して独自のコンテンツ型を定義する。
 *
 * @example
 * interface Post extends BaseContentItem {
 *   title: string;
 *   author: string;
 * }
 * createCMS<Post>({ source: notionAdapter({ ... }) })
 */
export interface BaseContentItem {
	id: string;
	slug: string;
	status: string;
	publishedAt: string;
	updatedAt: string;
}

/** ストレージにキャッシュされたレンダリング済みコンテンツ。 */
export interface CachedItem<T extends BaseContentItem = BaseContentItem> {
	html: string;
	item: T;
	notionUpdatedAt: string;
	cachedAt: number;
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
