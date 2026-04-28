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
  /** ページ ID（変更検知に必須）。 */
  id: string;
  /** URL キー（必須）。 */
  slug: string;
  /** ページ名（title 型プロパティのテキスト）。 */
  title?: string | null;
  /** 最終更新タイムスタンプ（変更検知に必須）。 */
  updatedAt: string;
  /** コンテンツのステータス。ステータスのない DB では省略可能。 */
  status?: string | null;
  /** 公開日時。日付プロパティのない DB では省略可能。 */
  publishedAt?: string | null;
  /** ページ作成日時（ISO8601）。 */
  createdAt?: string;
  /** Notion の archived フラグ (手動アーカイブ)。list() から自動的に除外される。 */
  isArchived?: boolean;
  /** Notion の in_trash フラグ (ゴミ箱)。list() から自動的に除外される。 */
  isInTrash?: boolean;
  /** カバー画像の URL。cover が設定されていない場合は null。 */
  coverImageUrl?: string | null;
  /** 絵文字アイコン。icon が絵文字でない場合や未設定の場合は null。 */
  iconEmoji?: string | null;
}

/**
 * メタデータのみの軽量キャッシュエントリ。
 * `checkForUpdate` の差分判定や一覧表示など、本文を必要としないパスで使う。
 */
export interface CachedItemMeta<T extends BaseContentItem = BaseContentItem> {
  item: T;
  /** Notion 側の最終更新時刻（差分検知用）。 */
  notionUpdatedAt: string;
  /** キャッシュ書き込み時刻（TTL 判定用、ms）。 */
  cachedAt: number;
}

/**
 * 本文（HTML / Markdown / blocks）のキャッシュエントリ。
 * メタデータと別ストレージキーで保存し、必要時のみロードする。
 */
export interface CachedItemContent {
  html: string;
  markdown: string;
  blocks: ContentBlock[];
  /** メタデータ整合性検証用に同じ値を保持する。 */
  notionUpdatedAt: string;
  cachedAt: number;
}

/**
 * 本文クライアント送信用 DTO（cachedAt を除いた `CachedItemContent`）。
 * `useSWR` の cache に格納できるよう関数を含まない pure JSON。
 */
export interface ItemContentPayload {
  html: string;
  markdown: string;
  blocks: ContentBlock[];
  notionUpdatedAt: string;
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
