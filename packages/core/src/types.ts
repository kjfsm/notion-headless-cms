import type { RendererFn } from "@kjfsm/notion-headless-cms-renderer";
import type { BlockHandler } from "@kjfsm/notion-headless-cms-transformer";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { PluggableList } from "unified";

/**
 * ライブラリが動作するために必須なフィールド。
 * カスタムコンテンツ型はこのインターフェースを拡張する。
 */
export interface BaseContentItem {
	id: string;
	slug: string;
	status: string;
	publishedAt: string;
	updatedAt: string;
}

/**
 * デフォルトのコンテンツ型。ブログ記事など一般的なユースケース向け。
 */
export interface ContentItem extends BaseContentItem {
	title: string;
	author: string;
}

/** ストレージにキャッシュされたレンダリング済みコンテンツ。 */
export interface CachedItem<T extends BaseContentItem = ContentItem> {
	html: string;
	item: T;
	notionUpdatedAt: string;
	cachedAt: number;
}

/** ストレージにキャッシュされたコンテンツ一覧。 */
export interface CachedItemList<T extends BaseContentItem = ContentItem> {
	items: T[];
	cachedAt: number;
}

/** ストレージから取得したバイナリオブジェクト。 */
export interface StorageBinary {
	data: ArrayBuffer;
	contentType?: string;
}

/** CMSコアが依存するストレージ抽象。 */
export interface StorageAdapter {
	get(key: string): Promise<ArrayBuffer | null>;
	put(
		key: string,
		data: ArrayBuffer | ArrayBufferView | string,
		options?: { contentType?: string },
	): Promise<void>;
	json<T>(key: string): Promise<T | null>;
	binary(key: string): Promise<StorageBinary | null>;
}

/** ライブラリが必要とする最小限の環境バインディング。 */
export interface CMSEnv {
	NOTION_TOKEN: string;
	NOTION_DATA_SOURCE_ID: string;
}

/** Notionのプロパティ名マッピング（すべてオプション）。 */
export interface CMSSchemaProperties {
	/** Notionのタイトルプロパティ名。デフォルト: 'Title' */
	title?: string;
	/** Notionのスラッグプロパティ名。デフォルト: 'Slug' */
	slug?: string;
	/** Notionのステータスプロパティ名。デフォルト: 'Status' */
	status?: string;
	/** Notionの著者プロパティ名。デフォルト: 'Author' */
	author?: string;
	/** Notionの公開日プロパティ名。デフォルト: 'CreatedAt' */
	date?: string;
}

/**
 * CMSの設定オブジェクト。
 * ジェネリクス型 T にカスタムコンテンツ型を指定できる（デフォルト: ContentItem）。
 */
export interface CMSConfig<T extends BaseContentItem = ContentItem> {
	/** キャッシュ/画像保存用ストレージ。未設定時はキャッシュ機能を無効化。 */
	storage?: StorageAdapter;
	schema?: {
		/**
		 * Notionページをコンテンツ型 T にマッピングするカスタム関数。
		 * 指定した場合 properties の設定は無視される（slug プロパティ名のみ例外）。
		 */
		mapItem?: (page: PageObjectResponse) => T;
		/** mapItem 未使用時のプロパティ名マッピング。 */
		properties?: CMSSchemaProperties;
		/** getItems() で返す「公開済み」ステータス値の配列。デフォルト: [] （全件返す） */
		publishedStatuses?: string[];
		/** getItemBySlug() でアクセス可能なステータス値の配列。デフォルト: [] （全件許可） */
		accessibleStatuses?: string[];
	};
	transformer?: {
		/** カスタムブロックハンドラーのマップ。Notionブロックタイプをキーとする。 */
		blocks?: Record<string, BlockHandler>;
	};
	renderer?: {
		/** 画像プロキシのベースURL。デフォルト: '/api/images' */
		imageProxyBase?: string;
		/** 追加する remark プラグイン。 */
		remarkPlugins?: PluggableList;
		/** 追加する rehype プラグイン。 */
		rehypePlugins?: PluggableList;
		/** デフォルトのパイプラインを置き換えるカスタムレンダラー。 */
		render?: RendererFn;
	};
	cache?: {
		/** コンテンツ一覧のキャッシュキー。デフォルト: 'content.json' */
		listKey?: string;
		/** 個別コンテンツのキャッシュキープレフィックス。デフォルト: 'content/' */
		itemPrefix?: string;
		/** 画像キャッシュのキープレフィックス。デフォルト: 'images/' */
		imagePrefix?: string;
		/** キャッシュの有効期間（ミリ秒）。未設定の場合はTTLなし。 */
		ttlMs?: number;
	};
}
