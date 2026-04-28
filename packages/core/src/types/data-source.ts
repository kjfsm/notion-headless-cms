import type { ContentBlock, ImageRef } from "../content/blocks";
import type { BaseContentItem } from "./content";

/**
 * Notion プロパティ1件の型情報とプロパティ名を保持する。
 * CLI が生成する `*Properties` オブジェクトの各要素の型。
 */
export interface PropertyDef {
	type:
		| "title"
		| "richText"
		| "select"
		| "status"
		| "multiSelect"
		| "date"
		| "number"
		| "checkbox"
		| "url"
		| "lastEditedTime";
	/** Notion DB 上のプロパティ名（表示名）。 */
	notion: string;
}

/** Notion DB のプロパティ一覧マップ。CLI 生成の `*Properties` の型。 */
export type PropertyMap = Record<string, PropertyDef>;

/**
 * 無効化対象の粒度。
 * - "meta" — メタデータキャッシュのみ失効
 * - "content" — 本文キャッシュのみ失効（リスト次回読み出しで lazy 再生成）
 * - "all" — 両方（既定）
 */
export type InvalidateKind = "meta" | "content" | "all";

/**
 * キャッシュ無効化のスコープ。
 * `kind` を省略した場合は `"all"` 相当として扱う。
 */
export type InvalidateScope =
	| "all"
	| { collection: string; kind?: InvalidateKind }
	| { collection: string; slug: string; kind?: InvalidateKind };

/**
 * Webhook 受信時の検証設定。
 */
export interface WebhookConfig {
	/** 署名検証用シークレット。 */
	secret?: string;
}

/**
 * コンテンツソースを抽象化するインターフェース。
 *
 * ユーザーは直接実装しない。`@notion-headless-cms/notion-orm` 等の
 * ORM パッケージが実装する。core は Notion 固有の知識を持たず、
 * このインターフェース経由でのみデータを扱う。
 *
 * 将来 `googledocs-orm` 等の別ソースもこの I/F を満たせば差し替え可能。
 */
export interface DataSource<T extends BaseContentItem = BaseContentItem> {
	/** ソース識別子 (ロギング・デバッグ用)。 */
	readonly name: string;

	/**
	 * CLI 生成の `*Properties` に対応するプロパティマップ。
	 * Core が `findByProp` の Notion プロパティ名解決に使用する。
	 */
	readonly properties?: PropertyMap;

	// --- データ取得 ---
	/** 公開済みアイテム一覧を取得する。 */
	list(opts?: { publishedStatuses?: readonly string[] }): Promise<T[]>;

	/**
	 * 指定した Notion プロパティ名と値で1件検索する。
	 * Core が slug フィールドのルックアップに使用する。
	 */
	findByProp?(notionPropName: string, value: string): Promise<T | null>;

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
