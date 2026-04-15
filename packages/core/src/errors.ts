export type CMSErrorCode =
	| "CONFIG_INVALID"
	| "NOTION_ITEM_SCHEMA_INVALID"
	| "NOTION_FETCH_ITEMS_FAILED"
	| "NOTION_FETCH_ITEM_BY_SLUG_FAILED"
	| "NOTION_GET_BLOCKS_FAILED"
	| "NOTION_MARKDOWN_FETCH_FAILED"
	| "IMAGE_CACHE_FAILED"
	| "RENDERER_FAILED";

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
