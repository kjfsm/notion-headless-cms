export type { DriftKind, PropertyDrift, SchemaDrift } from "./check.js";
export { diffSchema } from "./check.js";
export type {
  DoctorCheck,
  DoctorInput,
  DoctorReport,
  DoctorStatus,
} from "./doctor.js";
export { runDoctorChecks } from "./doctor.js";
export type { PullOptions } from "./pull.js";
export { generateCollectionScaffold } from "./pull.js";
export type { InitScaffoldOptions } from "./scaffold.js";
export {
  generateMountCodeTemplate,
  generateSchemaTemplate,
  generateWranglerToml,
} from "./scaffold.js";
export type {
  SyncCommandCoordinator,
  SyncCommandResult,
} from "./sync-command.js";
export { runSyncCommand } from "./sync-command.js";

/**
 * `nhc pull` / `nhc check` / `nhc doctor` が使う 1 コレクション分の Notion DB 解決情報。
 */
export interface CollectionSourceConfig {
  readonly databaseId?: string;
  readonly dbName?: string;
  /**
   * Notion プロパティ名 → TypeScript フィールド名の明示マッピング。
   * `nhc pull`/`nhc check` はここに無いプロパティを ASCII 識別子へ自動変換するが、
   * 日本語などの非 ASCII 名はここで明示した方が読みやすい識別子になる。
   * @example { "名前": "title", "URL": "slug" }
   */
  readonly fieldMappings?: Record<string, string>;
}

/**
 * `nhc.config.ts` のエクスポート型。
 * スキーマ本体は TS ファースト（`defineCollection`/`defineSchema`、codegen 廃止）で書き、
 * ここに置くのは Notion 側の解決情報とファイルパスのみ。
 *
 * @example
 * export default defineConfig({
 *   notionToken: env("NOTION_TOKEN"),
 *   schemaModule: "src/schema.ts",
 *   collections: {
 *     posts: {
 *       // dbName で Notion DB を検索して data_source_id を自動解決します
 *       dbName: "ブログ記事DB",
 *       // 日本語などのプロパティ名は明示マッピングしておくと nhc pull の出力が読みやすくなる
 *       fieldMappings: { 名前: "title", URL: "slug", ステータス: "status" },
 *     },
 *   },
 * });
 */
export interface CMSConfig {
  /** Notion API トークン。`env()` で環境変数から読み込むか、直接文字列を指定する。 */
  notionToken?: string;
  /** `nhc pull` が生成する雛形の出力先ディレクトリ。既定 "src/collections"。 */
  scaffoldDir?: string;
  /** `nhc check` が読み込む、ユーザーが書いた TS スキーマモジュールのパス。 */
  schemaModule?: string;
  /** コレクション名 → Notion DB 解決情報。キーは `defineCollection` の export 名と一致させる。 */
  collections: Record<string, CollectionSourceConfig>;
}

/** `nhc.config.ts` で使う設定ヘルパー。型推論のみで実体は恒等関数。 */
export function defineConfig(config: CMSConfig): CMSConfig {
  return config;
}

/**
 * 環境変数を遅延評価で読み込む (Prisma の `env()` 相当)。
 * 設定評価時には throw せず空文字を返し、トークン必要性のチェックは各コマンド実行時に行う。
 *
 * @example notionToken: env("NOTION_TOKEN")
 */
export function env(name: string): string {
  return process.env[name] ?? "";
}
