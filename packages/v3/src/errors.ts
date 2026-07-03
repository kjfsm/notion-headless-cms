/**
 * v3 の組み込みエラーコード。v2 の `CMSError`（`packages/core/src/errors.ts`）と
 * 同じ `<namespace>/<kind>` 方式を継承し、名前空間を新アーキテクチャの層に合わせて
 * 再編する（schema / query / store / sync / pipeline / handler / preview / render / cli）。
 * 各サブissueの実装が進むごとにコードを追加していく。
 */
export type BuiltInCMSErrorCode =
  | "schema/status_property_required"
  | "schema/reserved_collection_name"
  | "schema/notion_config_missing"
  | "store/rest_request_failed"
  | "store/rest_env_missing"
  | "handler/signature_invalid"
  | "handler/ogp_url_forbidden"
  | "handler/ogp_fetch_failed"
  | "sync/notion_query_failed"
  | "sync/slug_missing"
  | "cli/config_invalid"
  | "cli/notion_api_failed"
  | "cli/schema_invalid"
  | "cli/env_file_not_found"
  | "cli/init_failed";

export type CMSErrorCode = BuiltInCMSErrorCode | (string & {});

export interface CMSErrorContext {
  operation: string;
  collection?: string;
  slug?: string;
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

  is(code: CMSErrorCode): boolean {
    return this.code === code;
  }

  inNamespace(namespace: string): boolean {
    return this.code.startsWith(namespace);
  }
}

export function isCMSError(error: unknown): error is CMSError {
  return error instanceof CMSError;
}

export function isCMSErrorInNamespace(
  error: unknown,
  namespace: string,
): error is CMSError {
  return isCMSError(error) && error.code.startsWith(namespace);
}

type CMSErrorHandler<R> = (err: CMSError) => R;

/**
 * `CMSError` を switch 式のように分岐して処理するユーティリティ（v2 から継承）。
 * `_` キーはフォールバック（CMSError 以外 or 未マッチ時）に使われる。
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
