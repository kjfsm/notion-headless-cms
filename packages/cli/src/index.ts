/**
 * 1 コレクション分の生成設定。
 * `collections: { posts: { databaseId, slugField, ... } }` の値部分。
 */
export interface CollectionGenConfig {
  /**
   * Notion DB ID (UUID または短縮 ID)。`dbName` と排他。
   * どちらか一方を指定する必要がある。
   */
  databaseId?: string;
  /**
   * Notion DB 名。`databaseId` 未指定時に search で解決される。
   * 完全一致でのみマッチ。
   */
  dbName?: string;
  /** slug として使う TS フィールド名。デフォルト "slug"。 */
  slugField?: string;
  /** status として使う TS フィールド名。デフォルト "status"。 */
  statusField?: string;
  /** 公開扱いするステータス値。`list()` のデフォルト絞り込みに使う。 */
  publishedStatuses?: readonly string[];
  /** アクセス許可するステータス値。`find()` の閲覧可否判定に使う。 */
  accessibleStatuses?: readonly string[];
  /**
   * Notion プロパティ名 → TypeScript フィールド名の明示マッピング。
   * ASCII に変換できないプロパティ名（日本語など）はここで指定する。
   * @example { "タイトル": "customTitle", "カテゴリ": "category" }
   */
  fieldMappings?: Record<string, string>;
}

/**
 * `nhc.config.ts` のエクスポート型。
 *
 * @example
 * export default defineConfig({
 *   notionToken: env("NOTION_TOKEN"),
 *   output: "src/generated/nhc.ts",
 *   collections: {
 *     posts: {
 *       databaseId: env("NOTION_DATA_SOURCE_ID"),
 *       slugField: "slug",
 *       statusField: "status",
 *       publishedStatuses: ["公開済み"],
 *     }
 *   }
 * });
 */
export interface CMSConfig {
  /** 生成ファイルの出力パス。例: "src/generated/nhc.ts" */
  output: string;
  /** Notion API トークン。`env()` で環境変数から読み込むか、直接文字列を指定する。 */
  notionToken?: string;
  /** コレクション定義のマップ。キーがコレクション名 (cms.posts なら "posts")。 */
  collections: Record<string, CollectionGenConfig>;
}

/** `nhc.config.ts` で使う設定ヘルパー。型推論のみで実体は恒等関数。 */
export function defineConfig(config: CMSConfig): CMSConfig {
  return config;
}

/**
 * 環境変数を読み込む設定ヘルパー (Prisma の `env()` と同様)。
 * 環境変数が未設定の場合は空文字を返す。トークン未設定エラーは `nhc generate` 実行時に表示される。
 *
 * @example notionToken: env("NOTION_TOKEN")
 */
export function env(name: string): string {
  return process.env[name] ?? "";
}
