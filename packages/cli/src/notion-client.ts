import { CMSError } from "@notion-headless-cms/cms";
import {
  APIErrorCode,
  Client,
  ClientErrorCode,
  type DataSourceObjectResponse,
  isFullPage,
  isNotionClientError,
  type PageObjectResponse,
} from "@notionhq/client";

export type { DataSourceObjectResponse, PageObjectResponse };

export interface NotionCLIClient {
  /** dbName と完全一致する data_source の ID を返す。一致するものが無い場合は null。 */
  resolveId(dbName: string): Promise<string | null>;
  /** data_source_id で DataSourceObjectResponse を取得する。 */
  retrieveDataSource(id: string): Promise<DataSourceObjectResponse>;
  /** token が有効かを軽量に検証する(`nhc doctor`)。401 のみ false、それ以外は throw。 */
  validateToken(): Promise<boolean>;
  /** data_source の全ページを取得する(`nhc doctor` の slug 重複検出用)。 */
  queryAllPages(id: string): Promise<readonly PageObjectResponse[]>;
}

// 公式 SDK が分類する一時的な失敗コード一覧。
// SDK が `isNotionClientError` で識別するすべてのエラーから、これに該当するものをリトライする。
const RETRIABLE_NOTION_CODES = new Set<string>([
  APIErrorCode.RateLimited,
  APIErrorCode.InternalServerError,
  APIErrorCode.ServiceUnavailable,
  APIErrorCode.GatewayTimeout,
  ClientErrorCode.RequestTimeout,
  ClientErrorCode.ResponseError,
]);
// SDK 経由ではなく fetch 直下で発生する素のネットワークエラー。
// SDK の retry が及ばないケースの保険として最小限だけ識別する。
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

/** ネットワーク層エラーを cause チェーンも含めて検出する。 */
function isRawNetworkError(err: unknown): boolean {
  if (err instanceof Error && err.message === "fetch failed") return true;
  const record = err as { code?: unknown; cause?: { code?: unknown } } | null;
  if (record === null || typeof record !== "object") return false;
  const direct = typeof record.code === "string" ? record.code : undefined;
  const nested =
    typeof record.cause?.code === "string" ? record.cause.code : undefined;
  const code = nested ?? direct;
  return code !== undefined && RETRIABLE_NETWORK_CODES.has(code);
}

/** Notion API の一時的な失敗を指数バックオフでリトライする。 */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isRetriable =
        (isNotionClientError(err) && RETRIABLE_NOTION_CODES.has(err.code)) ||
        isRawNetworkError(err);
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
  const client = new Client({
    auth: token,
    // CLI 実行時は常に最新データを取得するためキャッシュを無効化する
    fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }),
  });

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

  async function validateToken(): Promise<boolean> {
    try {
      await withRetry(() => client.users.me({}));
      return true;
    } catch (err) {
      if (isNotionClientError(err) && err.code === APIErrorCode.Unauthorized) {
        return false;
      }
      throw err;
    }
  }

  async function queryAllPages(
    id: string,
  ): Promise<readonly PageObjectResponse[]> {
    const pages: PageObjectResponse[] = [];
    let cursor: string | undefined;
    do {
      const res = await withRetry(() =>
        client.dataSources.query({
          data_source_id: id,
          start_cursor: cursor,
          page_size: 100,
        }),
      );
      pages.push(...res.results.filter(isFullPage));
      cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
    } while (cursor);
    return pages;
  }

  return { resolveId, retrieveDataSource, validateToken, queryAllPages };
}
