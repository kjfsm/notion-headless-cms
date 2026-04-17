export type NotionHeadlessCMSErrorCode =
	| "CONFIG_INVALID"
	| "NOTION_ITEM_SCHEMA_INVALID"
	| "NOTION_FETCH_ITEMS_FAILED"
	| "NOTION_FETCH_ITEM_BY_SLUG_FAILED"
	| "NOTION_GET_BLOCKS_FAILED"
	| "NOTION_MARKDOWN_FETCH_FAILED"
	| "IMAGE_CACHE_FAILED"
	| "RENDERER_FAILED";

export interface NotionHeadlessCMSErrorContext {
	operation: string;
	slug?: string;
	dataSourceId?: string;
	pageId?: string;
	[key: string]: string | number | boolean | null | undefined;
}

export class NotionHeadlessCMSError extends Error {
	readonly code: NotionHeadlessCMSErrorCode;
	override readonly cause?: unknown;
	readonly context: NotionHeadlessCMSErrorContext;

	constructor(params: {
		code: NotionHeadlessCMSErrorCode;
		message: string;
		cause?: unknown;
		context: NotionHeadlessCMSErrorContext;
	}) {
		super(params.message, { cause: params.cause });
		this.name = "NotionHeadlessCMSError";
		this.code = params.code;
		this.cause = params.cause;
		this.context = params.context;
	}
}

export function isNotionHeadlessCMSError(
	error: unknown,
): error is NotionHeadlessCMSError {
	return error instanceof NotionHeadlessCMSError;
}
