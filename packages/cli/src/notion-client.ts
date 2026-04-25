import { CMSError } from "@notion-headless-cms/core";
import { Client } from "@notionhq/client";
import type { DataSourceObjectResponse } from "@notionhq/client/build/src/api-endpoints/data-sources.js";

export type { DataSourceObjectResponse };

export interface NotionCLIClient {
	/** dbName と完全一致する data_source の ID を返す。一致するものが無い場合は null。 */
	resolveId(dbName: string): Promise<string | null>;
	/** data_source_id で DataSourceObjectResponse を取得する。 */
	retrieveDataSource(id: string): Promise<DataSourceObjectResponse>;
}

const RETRY_STATUSES = new Set([429, 502, 503, 504]);
const RETRIABLE_NETWORK_CODES = new Set([
	"ECONNRESET",
	"ECONNREFUSED",
	"ETIMEDOUT",
	"ENOTFOUND",
	"EAI_AGAIN",
	"UND_ERR_SOCKET",
]);
const MAX_RETRIES = 4;
const BASE_DELAY_MS = 1000;

/** エラーオブジェクトから OS/ネットワークレベルの `code` を取り出す。 */
function getErrorCode(err: unknown): string | undefined {
	if (typeof err !== "object" || err === null) return undefined;
	const record = err as { code?: unknown; cause?: { code?: unknown } };
	const direct = typeof record.code === "string" ? record.code : undefined;
	const nested =
		typeof record.cause?.code === "string" ? record.cause.code : undefined;
	return nested ?? direct;
}

/** HTTP レスポンスを持つエラーの status を取り出す。 */
function getHttpStatus(err: unknown): number | undefined {
	if (typeof err !== "object" || err === null) return undefined;
	const status = (err as { status?: unknown }).status;
	return typeof status === "number" ? status : undefined;
}

/** ネットワーク起因のエラー（fetch failed / ECONN* など）かどうか判定する。 */
function isRetriableNetworkError(err: unknown): boolean {
	if (err instanceof Error && err.message === "fetch failed") return true;
	const code = getErrorCode(err);
	return code !== undefined && RETRIABLE_NETWORK_CODES.has(code);
}

/** Notion API の一時的な失敗（429 / 5xx / ネットワークエラー）を指数バックオフでリトライする。 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
	let lastError: unknown;
	for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
		try {
			return await fn();
		} catch (err) {
			const status = getHttpStatus(err);
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

		// 完全一致のみ採用する。Notion search は部分一致を含むため、ここでフィルタする
		for (const result of response.results) {
			if (result.object !== "data_source") continue;
			const ds = result as DataSourceObjectResponse;
			const title = ds.title.map((t) => t.plain_text).join("");
			if (title === dbName) return ds.id;
		}
		return null;
	}

	async function retrieveDataSource(
		id: string,
	): Promise<DataSourceObjectResponse> {
		const result = await withRetry(() =>
			client.dataSources.retrieve({ data_source_id: id }),
		);
		if (result.object !== "data_source") {
			throw new CMSError({
				code: "cli/notion_api_failed",
				message: `ID ${id} のデータソースが見つかりませんでした。`,
				context: { operation: "retrieveDataSource", dataSourceId: id },
			});
		}
		return result as DataSourceObjectResponse;
	}

	return { resolveId, retrieveDataSource };
}
