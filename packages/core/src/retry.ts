export interface RetryConfig {
	retryOn: number[];
	maxRetries: number;
	baseDelayMs: number;
	/** true のとき指数バックオフにランダムジッターを加える（Thundering Herd 対策）。デフォルト: true */
	jitter?: boolean;
	onRetry?: (attempt: number, status: number) => void;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
	retryOn: [429, 502, 503],
	maxRetries: 4,
	baseDelayMs: 1000,
	jitter: true,
};

/**
 * 指数バックオフ（オプションでジッター付き）でリトライする。
 *
 * `config.retryOn` に含まれるステータスコードを持つエラーのみリトライ対象。
 * 遅延は `baseDelayMs * 2^attempt` の指数バックオフ。
 * `jitter` が `true`（デフォルト）の場合、0.5〜1.0 の乱数係数を乗算して
 * Thundering Herd を防ぐ。`false` にすると確定的な遅延になる。
 */
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
				const jitterFactor =
					config.jitter !== false ? 0.5 + Math.random() * 0.5 : 1;
				const delay = config.baseDelayMs * 2 ** attempt * jitterFactor;
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}
	throw lastError;
}
