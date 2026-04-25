/**
 * ログの付加情報。よく使うフィールドを型安全に渡せるようにしつつ、
 * 任意の拡張フィールドは `[key: string]: unknown` で許容する。
 */
export interface LogContext {
	operation?: string;
	slug?: string;
	pageId?: string;
	durationMs?: number;
	attempt?: number;
	status?: number;
	error?: string;
	collection?: string;
	cacheAdapter?: string;
	/** キャッシュが保存された時刻(ms)。ヒット時の鮮度確認用 */
	cachedAt?: number;
	/** 画像キャッシュの SHA256 ハッシュキー。ストレージと対応付け用 */
	imageHash?: string;
	[key: string]: unknown;
}

export interface Logger {
	debug?: (message: string, context?: LogContext) => void;
	info?: (message: string, context?: LogContext) => void;
	warn?: (message: string, context?: LogContext) => void;
	error?: (message: string, context?: LogContext) => void;
}
