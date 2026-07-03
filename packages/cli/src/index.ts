// v3(#437 ゼロベース再設計)向けの新コマンド群(pull/check/doctor/sync)。
// 詳細は ./v3/index.ts を参照。旧来の codegen 中心コマンド(generate/init)とは
// 独立して段階的に追加していく。
export * from "./v3/index.js";

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
  /**
   * コレクション種別。
   * - `"page"`（既定）: URL ルーティングする記事・固定ページ。slug を持つ。
   * - `"data"`: URL を持たない要素（設定値一覧・選択肢リストなど）。slug 不要で
   *   `list()` / `get(id)` のみのクライアントになる。Notion DB に slug 列を用意しなくてよい。
   */
  kind?: "page" | "data";
  /** slug として使う TS フィールド名。デフォルト "slug"。`kind: "data"` では無視される。 */
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
 * `nhc pull` / `nhc check`（v3, #437）が使う 1 コレクション分の Notion DB 解決情報。
 * `databaseId`/`dbName` の意味は v2 の `CollectionGenConfig` と同じ（どちらか一方必須）。
 */
export interface V3CollectionSourceConfig {
  readonly databaseId?: string;
  readonly dbName?: string;
}

/**
 * v3(#437)向けの pull/check 設定。スキーマ本体は TS ファースト（`defineCollection`/
 * `defineSchema`、codegen 廃止）のままで、ここに置くのは Notion 側の解決情報と
 * ファイルパスのみ。
 */
export interface V3Config {
  /** `nhc pull` が生成する雛形の出力先ディレクトリ。既定 "src/collections"。 */
  readonly scaffoldDir?: string;
  /** `nhc check` が読み込む、ユーザーが書いた TS スキーマモジュールのパス。 */
  readonly schemaModule?: string;
  /** コレクション名 → Notion DB 解決情報。キーは `defineCollection` の export 名と一致させる。 */
  readonly collections: Record<string, V3CollectionSourceConfig>;
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
 *   },
 *   // v3(#437) を使う場合はこちらも定義する
 *   v3: {
 *     schemaModule: "src/schema.ts",
 *     collections: { posts: { dbName: "ブログ記事DB" } },
 *   },
 * });
 */
export interface CMSConfig {
  /** 生成ファイルの出力パス。例: "src/generated/nhc.ts" */
  output: string;
  /** Notion API トークン。`env()` で環境変数から読み込むか、直接文字列を指定する。 */
  notionToken?: string;
  /** コレクション定義のマップ。キーがコレクション名 (cms.posts なら "posts")。 */
  collections: Record<string, CollectionGenConfig>;
  /** v3(#437)向けの `nhc pull`/`nhc check` 設定。省略時はそれらのコマンドが使えない。 */
  v3?: V3Config;
}

/** `nhc.config.ts` で使う設定ヘルパー。型推論のみで実体は恒等関数。 */
export function defineConfig(config: CMSConfig): CMSConfig {
  return config;
}

/**
 * 環境変数を遅延評価で読み込む (Prisma の `env()` 相当)。
 * 設定評価時には throw せず空文字を返し、トークン必要性のチェックは `nhc generate` 実行時に行う。
 *
 * @example notionToken: env("NOTION_TOKEN")
 */
export function env(name: string): string {
  return process.env[name] ?? "";
}
