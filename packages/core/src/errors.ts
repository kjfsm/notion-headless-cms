/**
 * ライブラリ組み込みの CMS エラーコード。
 *
 * | コード | 発生条件 |
 * |---|---|
 * | `core/config_invalid` | 設定不備（token 未設定など） |
 * | `core/schema_invalid` | schema/mapping の型不整合 |
 * | `core/notion_orm_missing` | `@notion-headless-cms/notion-orm` の動的ロード失敗 |
 * | `source/fetch_items_failed` | `DataSource.list()` 失敗 |
 * | `source/fetch_item_failed` | `DataSource.findByProp()` 失敗 |
 * | `source/load_markdown_failed` | `DataSource.loadMarkdown()` 失敗 |
 * | `source/load_blocks_failed` | `DataSource.loadBlocks()` 失敗 |
 * | `cache/io_failed` | document / image キャッシュの I/O 失敗 |
 * | `cache/image_fetch_failed` | Notion 画像の HTTP 取得失敗 |
 * | `cache/image_invalid_content_type` | 画像レスポンスの Content-Type が不正 |
 * | `renderer/failed` | Markdown → HTML 変換失敗 |
 * | `swr/item_check_failed` | SWR バックグラウンドのアイテム差分チェック失敗 |
 * | `swr/list_check_failed` | SWR バックグラウンドのリスト差分チェック失敗 |
 * | `swr/content_rebuild_failed` | SWR バックグラウンドの本文再生成失敗 |
 * | `cli/config_invalid` | `nhc.config.ts` の内容不整合 |
 * | `cli/config_load_failed` | 設定ファイルの読み込み / 評価失敗 |
 * | `cli/schema_invalid` | CLI が受け取ったスキーマ / マッピング不整合 |
 * | `cli/generate_failed` | `nhc generate` の処理失敗 |
 * | `cli/init_failed` | `nhc init` の処理失敗 |
 * | `cli/notion_api_failed` | CLI が Notion API を呼び出す際の失敗 |
 * | `cli/env_file_not_found` | `--env-file` で指定したファイルが存在しない |
 *
 * サードパーティアダプタが独自コードを追加したい場合は `CMSErrorCode` を参照。
 */
export type BuiltInCMSErrorCode =
  | "core/config_invalid"
  | "core/schema_invalid"
  | "core/notion_orm_missing"
  | "source/fetch_items_failed"
  | "source/fetch_item_failed"
  | "source/load_markdown_failed"
  | "source/load_blocks_failed"
  | "cache/io_failed"
  | "cache/image_fetch_failed"
  | "cache/image_invalid_content_type"
  | "renderer/failed"
  | "swr/item_check_failed"
  | "swr/list_check_failed"
  | "swr/content_rebuild_failed"
  | "cli/config_invalid"
  | "cli/config_load_failed"
  | "cli/schema_invalid"
  | "cli/generate_failed"
  | "cli/init_failed"
  | "cli/notion_api_failed"
  | "cli/env_file_not_found";

/**
 * CMS エラーコード。
 * `BuiltInCMSErrorCode` のリテラル補完を維持しつつ、
 * サードパーティアダプタが独自コードを定義できるよう `string & {}` で拡張可能にする。
 */
export type CMSErrorCode = BuiltInCMSErrorCode | (string & {});

export interface CMSErrorContext {
  operation: string;
  slug?: string;
  dataSourceId?: string;
  pageId?: string;
  [key: string]: string | number | boolean | null | undefined;
}

export class CMSError extends Error {
  readonly code: CMSErrorCode;
  override readonly cause?: unknown;
  readonly context: CMSErrorContext;

  constructor(params: {
    code: CMSErrorCode;
    message: string;
    cause?: unknown;
    context: CMSErrorContext;
  }) {
    super(params.message, { cause: params.cause });
    this.name = "CMSError";
    this.code = params.code;
    this.cause = params.cause;
    this.context = params.context;
  }
}

export function isCMSError(error: unknown): error is CMSError {
  return error instanceof CMSError;
}

/** エラーコードが特定の名前空間に属するかを判定する（例: "source/"）。 */
export function isCMSErrorInNamespace(
  error: unknown,
  namespace: string,
): error is CMSError {
  return isCMSError(error) && error.code.startsWith(namespace);
}
