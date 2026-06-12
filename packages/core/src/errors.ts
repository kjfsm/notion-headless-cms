/**
 * ライブラリ組み込みの CMS エラーコード。
 *
 * | コード | 発生条件 |
 * |---|---|
 * | `core/config_invalid` | 設定不備（token 未設定など） |
 * | `core/schema_invalid` | schema/mapping の型不整合 |
 * | `core/notion_orm_missing` | `@notion-headless-cms/notion-orm` の動的ロード失敗 |
 * | `core/sort_unsupported_type` | ソートキーの値型が string / number でない |
 * | `webhook/signature_invalid` | Webhook 署名検証失敗 |
 * | `webhook/payload_invalid` | Webhook ペイロード形式不正 |
 * | `webhook/unknown_collection` | Webhook の対象コレクションが未知 |
 * | `webhook/not_implemented` | DataSource が parseWebhook を実装していない |
 * | `version/unknown_collection` | バージョン照会 (`cms.handler()` の versions ルート) の対象コレクションが未知 |
 * | `source/fetch_items_failed` | `DataSource.list()` 失敗 |
 * | `source/fetch_item_failed` | `DataSource.findByProp()` 失敗 |
 * | `source/load_markdown_failed` | `DataSource.loadMarkdown()` 失敗 |
 * | `source/load_blocks_failed` | `DataSource.loadBlocks()` 失敗 |
 * | `source/blocks_unsupported` | 選択した fetch 戦略が NotionBlockTree 取得を提供していない (markdown 戦略選択時など) |
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
  | "core/sort_unsupported_type"
  | "webhook/signature_invalid"
  | "webhook/payload_invalid"
  | "webhook/unknown_collection"
  | "webhook/not_implemented"
  | "version/unknown_collection"
  | "source/fetch_items_failed"
  | "source/fetch_item_failed"
  | "source/load_markdown_failed"
  | "source/load_blocks_failed"
  | "source/blocks_unsupported"
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

/**
 * 組み込みエラーコードごとのドキュメント URL アンカーと既定の次アクション。
 * `CMSError` コンストラクタが呼び出し側の `docsUrl` / `nextSteps` 未指定時のフォールバックに使用する。
 *
 * `docs/ja/errors/index.md` の各セクション ID と同期させること。
 */
const ERROR_DOCS_BASE =
  "https://github.com/kjfsm/notion-headless-cms/blob/main/docs/ja/errors/index.md";

interface ErrorHelp {
  readonly docsAnchor: string;
  readonly nextSteps: readonly string[];
}

const BUILT_IN_ERROR_HELP: Record<BuiltInCMSErrorCode, ErrorHelp> = {
  "core/config_invalid": {
    docsAnchor: "core-config_invalid",
    nextSteps: [
      "createClient の必須オプション (sources / collections) を確認する",
      "NOTION_TOKEN が環境変数または .dev.vars に設定されているか確認する",
    ],
  },
  "core/schema_invalid": {
    docsAnchor: "core-schema_invalid",
    nextSteps: [
      "nhc generate を再実行して schema を最新化する",
      "PropertyMap / PropertyDef の型が定義どおりか確認する",
    ],
  },
  "core/notion_orm_missing": {
    docsAnchor: "core-notion_orm_missing",
    nextSteps: [
      "@notion-headless-cms/notion-orm をインストールする",
      "実行ランタイムが動的 import を許可しているか確認する",
    ],
  },
  "core/sort_unsupported_type": {
    docsAnchor: "core-sort_unsupported_type",
    nextSteps: [
      "sort.by に指定したフィールドの値型が string / number になっているか確認する",
      "別フィールドでソートするか、source 側で正規化する",
    ],
  },
  "webhook/signature_invalid": {
    docsAnchor: "webhook-signature_invalid",
    nextSteps: [
      "Notion 側で発行された webhook secret が一致しているか確認する",
      "プロキシ / WAF がリクエストボディを書き換えていないか確認する",
    ],
  },
  "webhook/payload_invalid": {
    docsAnchor: "webhook-payload_invalid",
    nextSteps: [
      "リクエストボディが JSON で送信されているか確認する",
      "DataSource.parseWebhook の期待するフィールド構造と一致しているか確認する",
    ],
  },
  "webhook/unknown_collection": {
    docsAnchor: "webhook-unknown_collection",
    nextSteps: [
      "createClient の sources / collections に該当 collection が登録されているか確認する",
      "Webhook URL が `?collection=` で正しいコレクション名を指しているか確認する",
    ],
  },
  "webhook/not_implemented": {
    docsAnchor: "webhook-not_implemented",
    nextSteps: [
      "対象 collection の DataSource に parseWebhook を実装する",
      "Webhook を使わない場合は cms.invalidate() を直接呼ぶ運用に切り替える",
    ],
  },
  "version/unknown_collection": {
    docsAnchor: "version-unknown_collection",
    nextSteps: [
      "versions ポーリング URL が登録済みのコレクション名を指しているか確認する",
      "createCMS の collections に該当コレクションが定義されているか確認する",
    ],
  },
  "source/fetch_items_failed": {
    docsAnchor: "source-fetch_items_failed",
    nextSteps: [
      "NOTION_TOKEN がインテグレーションに紐づいているか確認する",
      "Notion DB がインテグレーションに接続済みか確認する",
      "ネットワーク / Notion API の障害状況 (status.notion.so) を確認する",
      "rateLimiter.maxRetries / baseDelayMs を調整してリトライ余地を増やす",
    ],
  },
  "source/fetch_item_failed": {
    docsAnchor: "source-fetch_item_failed",
    nextSteps: [
      "slug プロパティが Notion DB に存在し、値がユニークか確認する",
      "対象ページがインテグレーションに共有されているか確認する",
    ],
  },
  "source/load_markdown_failed": {
    docsAnchor: "source-load_markdown_failed",
    nextSteps: [
      "対象ページがアーカイブされていないか確認する",
      "未対応ブロック (file / video など) が原因なら fetch 戦略を `markdownFetcher()` に切り替えるか、対象ブロックを除外する",
    ],
  },
  "source/load_blocks_failed": {
    docsAnchor: "source-load_blocks_failed",
    nextSteps: [
      "対象ページが削除 / アーカイブされていないか確認する",
      "Notion API の rate limit に当たっていないかログで確認する",
    ],
  },
  "source/blocks_unsupported": {
    docsAnchor: "source-blocks_unsupported",
    nextSteps: [
      "react-renderer を使う場合は fetch 戦略を `fetchBlockTree()` に切り替える",
      "あるいは markdown 経路で本文表示にフォールバックする",
    ],
  },
  "cache/io_failed": {
    docsAnchor: "cache-io_failed",
    nextSteps: [
      "KV / R2 / メモリキャッシュの binding (env.DOC_CACHE / env.IMG_BUCKET) が正しいか確認する",
      "wrangler.toml の binding 名と createClient に渡した env が一致しているか確認する",
      "一時的な障害なら SWR が次回読み込み時に自己回復する",
    ],
  },
  "cache/image_fetch_failed": {
    docsAnchor: "cache-image_fetch_failed",
    nextSteps: [
      "Notion 署名 URL の有効期限 (約 1 時間) が切れていないか確認する",
      "Worker / Node のアウトバウンドネットワークが許可されているか確認する",
    ],
  },
  "cache/image_invalid_content_type": {
    docsAnchor: "cache-image_invalid_content_type",
    nextSteps: [
      "Notion 画像 URL を直接ブラウザで開いて image/* を返すか確認する",
      "プロキシ / CDN が Content-Type を書き換えていないか確認する",
    ],
  },
  "renderer/failed": {
    docsAnchor: "renderer-failed",
    nextSteps: [
      "renderer に渡している remark / rehype プラグインの組み合わせを確認する",
      "fetch 戦略と renderer の組み合わせが整合しているか (Notion enhanced markdown には notionMarkdownRenderer が必要) を確認する",
    ],
  },
  "swr/item_check_failed": {
    docsAnchor: "swr-item_check_failed",
    nextSteps: [
      "ログで cause を確認し、source/fetch_item_failed と同じ手順で原因を切り分ける",
      "バックグラウンドの失敗は次回 SWR で自動再試行されるため恒久対処不要なケースもある",
    ],
  },
  "swr/list_check_failed": {
    docsAnchor: "swr-list_check_failed",
    nextSteps: [
      "ログで cause を確認し、source/fetch_items_failed と同じ手順で原因を切り分ける",
      "Notion API の rate limit に近い場合は rateLimiter を絞る",
    ],
  },
  "swr/content_rebuild_failed": {
    docsAnchor: "swr-content_rebuild_failed",
    nextSteps: [
      "renderer / loadMarkdown が一時的に失敗しただけならログを確認のうえ放置可",
      "恒常的に再発する場合は対象 slug を fresh: true で取り直して再現を確認する",
    ],
  },
  "cli/config_invalid": {
    docsAnchor: "cli-config_invalid",
    nextSteps: [
      "nhc.config.ts が defineConfig() を default export しているか確認する",
      "collections に少なくとも 1 件、databaseId または dbName が指定されているか確認する",
    ],
  },
  "cli/config_load_failed": {
    docsAnchor: "cli-config_load_failed",
    nextSteps: [
      "nhc.config.ts に構文エラーがないか tsc / エディタで確認する",
      "ESM の import パスが拡張子付き (.js) になっているか確認する",
    ],
  },
  "cli/schema_invalid": {
    docsAnchor: "cli-schema_invalid",
    nextSteps: [
      "Notion DB のプロパティ型が CLI 対応 (title / richText / select / status / multiSelect / date / number / checkbox / url) のいずれかか確認する",
      "未対応プロパティをスキップするか、Notion 側で型を変える",
    ],
  },
  "cli/generate_failed": {
    docsAnchor: "cli-generate_failed",
    nextSteps: [
      "--verbose を付けて再実行し、失敗箇所のスタックトレースを確認する",
      "出力先ディレクトリの書き込み権限を確認する",
    ],
  },
  "cli/init_failed": {
    docsAnchor: "cli-init_failed",
    nextSteps: [
      "出力先パスに既存ファイルがある場合は --force を付けるか別パスを指定する",
      "親ディレクトリの書き込み権限を確認する",
    ],
  },
  "cli/notion_api_failed": {
    docsAnchor: "cli-notion_api_failed",
    nextSteps: [
      "NOTION_TOKEN がインテグレーションに紐づいているか確認する",
      "対象 DB がインテグレーションに接続されているか (Notion DB → … → Connections) 確認する",
      "DB 名で解決している場合は完全一致 (前後空白 / 全角半角) を確認する",
      "--verbose で Notion API レスポンスの status / code を確認する",
    ],
  },
  "cli/env_file_not_found": {
    docsAnchor: "cli-env_file_not_found",
    nextSteps: [
      "--env-file で指定したパスを実ファイルパスで確認する",
      "プロジェクトルートで実行しているか (相対パスは cwd 基準)",
    ],
  },
};

function lookupBuiltInHelp(code: CMSErrorCode): ErrorHelp | undefined {
  return BUILT_IN_ERROR_HELP[code as BuiltInCMSErrorCode];
}

export class CMSError extends Error {
  readonly code: CMSErrorCode;
  override readonly cause?: unknown;
  readonly context: CMSErrorContext;
  /** エラーを解消するための次のアクション（表示用）。 */
  readonly nextSteps?: readonly string[];
  /** 詳細ドキュメントへの URL（表示用）。 */
  readonly docsUrl?: string;

  constructor(params: {
    code: CMSErrorCode;
    message: string;
    cause?: unknown;
    context: CMSErrorContext;
    nextSteps?: readonly string[];
    docsUrl?: string;
  }) {
    super(params.message, { cause: params.cause });
    this.name = "CMSError";
    this.code = params.code;
    this.cause = params.cause;
    this.context = params.context;

    // 呼び出し側が nextSteps / docsUrl を指定していない場合は、組み込みコード向けの既定値で補完する。
    // サードパーティコードや未登録コードは undefined のままにする。
    const help = lookupBuiltInHelp(params.code);
    this.nextSteps = params.nextSteps ?? help?.nextSteps;
    this.docsUrl =
      params.docsUrl ??
      (help ? `${ERROR_DOCS_BASE}#${help.docsAnchor}` : undefined);
  }

  /** エラーコードが指定した値と一致するか判定する。 */
  is(code: CMSErrorCode): boolean {
    return this.code === code;
  }

  /** エラーコードが指定した名前空間に属するか判定する（例: `"source/"`）。 */
  inNamespace(namespace: string): boolean {
    return this.code.startsWith(namespace);
  }

  /**
   * nextSteps と docsUrl を含む人間向けの詳細メッセージを返す。
   * エラーダイアログ・ログ出力時に使う。
   */
  format(): string {
    const lines: string[] = [this.message];
    if (this.nextSteps?.length) {
      lines.push("\n次にやること:");
      for (const step of this.nextSteps) {
        lines.push(`  - ${step}`);
      }
    }
    if (this.docsUrl) {
      lines.push(`\n詳細: ${this.docsUrl}`);
    }
    return lines.join("\n");
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

type CMSErrorHandler<R> = (err: CMSError) => R;

/**
 * `CMSError` を switch 式のように分岐して処理するユーティリティ。
 * `_` キーはフォールバック（CMSError 以外 or 未マッチ時）に使われる。
 *
 * @example
 * matchCMSError(err, {
 *   "source/fetch_items_failed": (e) => handleFetchError(e),
 *   _: (e) => { throw e; },
 * });
 */
export function matchCMSError<R>(
  error: unknown,
  handlers: Partial<Record<CMSErrorCode, CMSErrorHandler<R>>> & {
    _?: (err: unknown) => R;
  },
): R | undefined {
  if (!isCMSError(error)) {
    return handlers._?.(error);
  }
  const handler =
    handlers[error.code as CMSErrorCode] ??
    (handlers._ as CMSErrorHandler<R> | undefined);
  return handler?.(error);
}
