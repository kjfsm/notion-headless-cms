export interface RetryConfig {
	maxConcurrent: number;
	retryOn: number[];
	maxRetries: number;
	baseDelayMs: number;
	onRetry?: (attempt: number, status: number) => void;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxConcurrent: 3,
	retryOn: [429, 502, 503],
	maxRetries: 4,
	baseDelayMs: 1000,
};

/** 指数バックオフでリトライする。retryOn に含まれる HTTP エラーのみ対象。 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	config: RetryConfig,
): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
		try {
			return await fn();
		} catch (err) {
			const status = (err as { status?: number }).status;
			if (status === undefined || !config.retryOn.includes(status)) {
				throw err;
			}
			lastError = err;
			if (attempt < config.maxRetries) {
				config.onRetry?.(attempt + 1, status);
				await new Promise((resolve) =>
					setTimeout(resolve, config.baseDelayMs * 2 ** attempt),
				);
			}
		}
	}
	throw lastError;
}
