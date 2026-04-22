import { Client } from "@notionhq/client";
import type { DataSourceObjectResponse } from "@notionhq/client/build/src/api-endpoints/data-sources.js";

export type { DataSourceObjectResponse };

export interface NotionCLIClient {
	/** dbName で data_source を検索して ID を返す。完全一致優先、見つからない場合は null。 */
	resolveId(dbName: string): Promise<string | null>;
	/** data_source_id で DataSourceObjectResponse を取得する。 */
	retrieveDataSource(id: string): Promise<DataSourceObjectResponse>;
}

const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1000;

/** ネットワーク起因のエラー（fetch failed / ECONN* など）かどうか判定する。 */
function isRetriableNetworkError(err: unknown): boolean {
	if (!(err instanceof Error)) return false;
	if (err.message === "fetch failed") return true;
	const cause = (err as { cause?: { code?: string } }).cause;
	const code = cause?.code ?? (err as { code?: string }).code;
	if (!code) return false;
	return [
		"ECONNRESET",
		"ECONNREFUSED",
		"ETIMEDOUT",
		"ENOTFOUND",
		"EAI_AGAIN",
		"UND_ERR_SOCKET",
	].includes(code);
}

/** Notion API の一時的な失敗（429 / 5xx / ネットワークエラー）を指数バックオフでリトライする。 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		try {
			return await fn();
		} catch (err) {
			const status = (err as { status?: number }).status;
			const isRetriable =
				(status !== undefined && RETRY_STATUSES.has(status)) ||
				isRetriableNetworkError(err);
			if (!isRetriable) throw err;
			lastError = err;
			if (attempt < MAX_RETRIES) {
				const jitter = 0.5 + Math.random() * 0.5;
				const delay = BASE_DELAY_MS * 2 ** attempt * jitter;
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
	}
	throw lastError;
}

export function createNotionCLIClient(token: string): NotionCLIClient {
	const client = new Client({ auth: token });

	async function resolveId(dbName: string): Promise<string | null> {
		const response = await withRetry(() =>
			client.search({
				query: dbName,
				filter: { property: "object", value: "data_source" },
			}),
		);

		// 完全一致を優先
		for (const result of response.results) {
			if (result.object !== "data_source") continue;
			const ds = result as DataSourceObjectResponse;
			const title = ds.title.map((t) => t.plain_text).join("");
			if (title === dbName) return ds.id;
		}

		// フォールバック: 検索結果の先頭（部分一致）
		const first = response.results.find((r) => r.object === "data_source");
		return first?.id ?? null;
	}

	async function retrieveDataSource(
		id: string,
	): Promise<DataSourceObjectResponse> {
		const result = await withRetry(() =>
			client.dataSources.retrieve({ data_source_id: id }),
		);
		if (result.object !== "data_source") {
			throw new Error(`ID ${id} のデータソースが見つかりませんでした。`);
		}
		return result as DataSourceObjectResponse;
	}

	return { resolveId, retrieveDataSource };
}
