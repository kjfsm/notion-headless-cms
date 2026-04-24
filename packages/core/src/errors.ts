type BuiltInCMSErrorCode =
	| "core/config_invalid"
	| "core/schema_invalid"
	| "core/notion_orm_missing"
	| "source/fetch_items_failed"
	| "source/fetch_item_failed"
	| "source/load_markdown_failed"
	| "cache/io_failed"
	| "cache/image_fetch_failed"
	| "renderer/failed"
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
