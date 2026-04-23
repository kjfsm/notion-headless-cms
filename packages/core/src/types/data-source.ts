import type { ContentBlock, ImageRef } from "../content/blocks";
import type { BaseContentItem } from "./content";

/**
 * キャッシュ無効化のスコープ (DataSource 層で参照する形)。
 */
export type InvalidateScope =
	| "all"
	| { collection: string }
	| { collection: string; slug: string };

/**
 * Webhook 受信時の検証設定。
 */
export interface WebhookConfig {
	/** 署名検証用シークレット。 */
	secret?: string;
}

/**
 * コンテンツソースを抽象化する v1 インターフェース。
 *
 * ユーザーは直接実装しない。`notion-orm` 等の ORM パッケージが実装する。
 * core は Notion 固有の知識を持たず、このインターフェース経由でのみデータを扱う。
 * 将来 `googledocs-orm` 等の別ソースもこの I/F を満たせば差し替え可能。
 */
export interface DataSource<T extends BaseContentItem = BaseContentItem> {
	/** ソース識別子 (ロギング・デバッグ用)。 */
	readonly name: string;

	/** 公開扱いするステータス値 (ORM 側デフォルト)。 */
	readonly publishedStatuses?: readonly string[];
	/** アクセス許可するステータス値 (ORM 側デフォルト)。 */
	readonly accessibleStatuses?: readonly string[];

	// --- データ取得 ---
	/** 公開済みアイテム一覧を取得する。 */
	list(opts?: { publishedStatuses?: readonly string[] }): Promise<T[]>;

	/** スラッグで単件取得。見つからなければ null。 */
	findBySlug(slug: string): Promise<T | null>;

	/** アイテム本文を ContentBlock 配列で返す。 */
	loadBlocks(item: T): Promise<ContentBlock[]>;

	/** アイテム本文を Markdown 文字列で返す (html() 生成の元ソース)。 */
	loadMarkdown(item: T): Promise<string>;

	// --- キャッシュ整合性 ---
	/** SWR 鮮度判定用。item の最終更新タイムスタンプ。 */
	getLastModified(item: T): string;

	/** リスト全体のバージョン文字列 (例: 最新 last_edited_time)。 */
	getListVersion(items: T[]): string;

	// --- 画像 ---
	/** 期限切れ画像 URL の再取得 (Notion の署名 URL 対応)。 */
	resolveImageUrl?(ref: ImageRef): Promise<string>;

	// --- Webhook ---
	/**
	 * Webhook リクエストをパースして無効化スコープを返す。
	 * 実装していない場合は `$handler` が body の `{ slug }` にフォールバック。
	 */
	parseWebhook?(req: Request, config: WebhookConfig): Promise<InvalidateScope>;
}

/**
 * `nhcSchema` の各コレクション設定エントリ。
 * ユーザーは CLI 生成の `nhcSchema` を渡すだけで、
 * この型は `createCMS` 内部で DataSource のファクトリに渡される。
 */
export interface CollectionConfig<T extends BaseContentItem = BaseContentItem> {
	/** Notion データソース (database) ID。 */
	databaseId: string;
	/** スキーマ情報 (ORM が解釈する不透明データ)。 */
	// biome-ignore lint/suspicious/noExplicitAny: ORM ごとにスキーマ形状は異なる
	schema?: any;
	/** 公開扱いするステータス値。 */
	publishedStatuses?: string[];
	/** アクセス許可するステータス値。 */
	accessibleStatuses?: string[];
	/** `T` を型レベルで持ち回るためのマーカー (ランタイム値なし)。 */
	__itemType?: T;
}

/**
 * `nhc generate` が生成する `nhcSchema` の型。
 * コレクション名をキーとして、各コレクションの設定を保持する。
 */
// biome-ignore lint/suspicious/noExplicitAny: 各コレクションの T が異なるため
export type CMSSchema = Record<string, CollectionConfig<any>>;

/** `CollectionConfig<T>` から `T` を抽出するユーティリティ型。 */
export type InferCollectionItem<C> =
	C extends CollectionConfig<infer T> ? T : BaseContentItem;

/**
 * DataSource を生成するファクトリ関数の型。
 * `createCMS` はコレクション名 → この関数 → DataSource の経路で組み立てる。
 *
 * ユーザーコードは直接呼ばない。`@notion-headless-cms/notion-orm` 等が provide する。
 */
export type DataSourceFactory = <T extends BaseContentItem>(args: {
	collection: string;
	config: CollectionConfig<T>;
	notionToken: string;
}) => DataSource<T>;
