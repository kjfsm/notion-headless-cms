import {
  APIErrorCode,
  APIResponseError,
  type DataSourceObjectResponse,
  RequestTimeoutError,
} from "@notionhq/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const searchMock = vi.fn();
const retrieveMock = vi.fn();

type NotionFetch = typeof globalThis.fetch;

let capturedClientOptions: { auth?: string; fetch?: NotionFetch } | undefined;

// 公式 SDK のエラークラス・型ガードはそのまま使うため、Client のみ差し替える。
// `as unknown as typeof import("@notionhq/client")` で公式モジュール shape との
// 互換性を最低限ながら型レベルで担保し、export 漏れに気付けるようにする
vi.mock("@notionhq/client", async () => {
  const actual =
    await vi.importActual<typeof import("@notionhq/client")>(
      "@notionhq/client",
    );
  return {
    ...actual,
    Client: class {
      constructor(opts: { auth?: string; fetch?: NotionFetch }) {
        capturedClientOptions = opts;
      }
      search = searchMock;
      dataSources = { retrieve: retrieveMock };
    },
  } as unknown as typeof import("@notionhq/client");
});

function makeDataSource(id: string, title: string) {
  return {
    object: "data_source",
    id,
    title: [{ plain_text: title }],
  } satisfies Pick<DataSourceObjectResponse, "object" | "id"> & {
    title: { plain_text: string }[];
  };
}

/** APIResponseError をテスト用に最小フィールドで生成する。 */
function makeAPIError(code: APIErrorCode, status: number, message: string) {
  return new APIResponseError({
    code,
    status,
    message,
    headers: new Headers(),
    rawBodyText: "",
    additional_data: undefined,
    request_id: undefined,
  });
}

describe("createNotionCLIClient.resolveId", () => {
  beforeEach(() => {
    searchMock.mockReset();
  });

  it("完全一致する dbName の id を返す", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    searchMock.mockResolvedValue({
      results: [
        makeDataSource("id-other", "ブログ記事DB 旧版"),
        makeDataSource("id-target", "ブログ記事DB"),
      ],
    });

    const client = createNotionCLIClient("test-token");
    const id = await client.resolveId("ブログ記事DB");
    expect(id).toBe("id-target");
  });

  it("完全一致が無い場合は null を返す（部分一致は採用しない）", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    searchMock.mockResolvedValue({
      results: [
        makeDataSource("id-1", "ブログ記事DB 旧版"),
        makeDataSource("id-2", "ブログ記事DB Archive"),
      ],
    });

    const client = createNotionCLIClient("test-token");
    const id = await client.resolveId("ブログ記事DB");
    expect(id).toBeNull();
  });

  it("検索結果が空なら null を返す", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    searchMock.mockResolvedValue({ results: [] });

    const client = createNotionCLIClient("test-token");
    const id = await client.resolveId("存在しないDB");
    expect(id).toBeNull();
  });

  it("data_source 以外のオブジェクトは無視する", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    searchMock.mockResolvedValue({
      results: [
        { object: "page", id: "page-1", title: [{ plain_text: "DB 名" }] },
        makeDataSource("ds-1", "DB 名"),
      ],
    });

    const client = createNotionCLIClient("test-token");
    const id = await client.resolveId("DB 名");
    expect(id).toBe("ds-1");
  });
});

describe("createNotionCLIClient.retrieveDataSource", () => {
  beforeEach(() => {
    retrieveMock.mockReset();
  });

  it("data_source オブジェクトを取得して返す", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    retrieveMock.mockResolvedValue(makeDataSource("ds-1", "My DB"));

    const client = createNotionCLIClient("test-token");
    const result = await client.retrieveDataSource("ds-1");
    expect(result.id).toBe("ds-1");
  });

  it("object が data_source でない場合は CMSError をスローする", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    retrieveMock.mockResolvedValue({ object: "page", id: "p1" });

    const client = createNotionCLIClient("test-token");
    await expect(client.retrieveDataSource("p1")).rejects.toThrow();
  });
});

describe("createNotionCLIClient: リトライロジック", () => {
  beforeEach(() => {
    searchMock.mockReset();
    retrieveMock.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rate_limited (429) でリトライし MAX_RETRIES 回後にエラーをスローする", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    searchMock.mockRejectedValue(
      makeAPIError(APIErrorCode.RateLimited, 429, "rate limited"),
    );

    const client = createNotionCLIClient("test-token");
    // rejects ハンドラを先にアタッチしてから timers を進める（unhandled rejection 防止）
    const promise = client.resolveId("DB");
    const rejectCheck = expect(promise).rejects.toThrow();
    await vi.runAllTimersAsync();
    await rejectCheck;
    expect(searchMock).toHaveBeenCalledTimes(5);
  });

  it("internal_server_error (502 相当) でリトライして成功する", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    searchMock
      .mockRejectedValueOnce(
        makeAPIError(APIErrorCode.InternalServerError, 502, "bad gateway"),
      )
      .mockResolvedValue({ results: [] });

    const client = createNotionCLIClient("test-token");
    const promise = client.resolveId("DB");
    await vi.runAllTimersAsync();
    expect(await promise).toBeNull();
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it("RequestTimeoutError でリトライして成功する", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    searchMock
      .mockRejectedValueOnce(new RequestTimeoutError("timeout"))
      .mockResolvedValue({ results: [makeDataSource("id-x", "DB")] });

    const client = createNotionCLIClient("test-token");
    const promise = client.resolveId("DB");
    await vi.runAllTimersAsync();
    expect(await promise).toBe("id-x");
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it("fetch failed ネットワークエラーでリトライする", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    searchMock
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValue({ results: [makeDataSource("id-x", "DB")] });

    const client = createNotionCLIClient("test-token");
    const promise = client.resolveId("DB");
    await vi.runAllTimersAsync();
    expect(await promise).toBe("id-x");
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it("ECONNRESET コードでリトライする", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    searchMock
      .mockRejectedValueOnce(
        Object.assign(new Error("connection reset"), { code: "ECONNRESET" }),
      )
      .mockResolvedValue({ results: [] });

    const client = createNotionCLIClient("test-token");
    const promise = client.resolveId("DB");
    await vi.runAllTimersAsync();
    expect(await promise).toBeNull();
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it("cause.code を持つネストエラー（ETIMEDOUT）でリトライする", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    searchMock
      .mockRejectedValueOnce(
        Object.assign(new Error("outer"), { cause: { code: "ETIMEDOUT" } }),
      )
      .mockResolvedValue({ results: [] });

    const client = createNotionCLIClient("test-token");
    const promise = client.resolveId("DB");
    await vi.runAllTimersAsync();
    expect(await promise).toBeNull();
    expect(searchMock).toHaveBeenCalledTimes(2);
  });

  it("リトライ不可能なエラー（object_not_found）はすぐにスローする", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    searchMock.mockRejectedValue(
      makeAPIError(APIErrorCode.ObjectNotFound, 404, "not found"),
    );

    const client = createNotionCLIClient("test-token");
    await expect(client.resolveId("DB")).rejects.toThrow();
    expect(searchMock).toHaveBeenCalledTimes(1);
  });

  it("retrieveDataSource が service_unavailable (503) でリトライして成功する", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    const ds = makeDataSource("ds-2", "Retried DB");
    retrieveMock
      .mockRejectedValueOnce(
        makeAPIError(
          APIErrorCode.ServiceUnavailable,
          503,
          "service unavailable",
        ),
      )
      .mockResolvedValue(ds);

    const client = createNotionCLIClient("test-token");
    const promise = client.retrieveDataSource("ds-2");
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result.id).toBe("ds-2");
    expect(retrieveMock).toHaveBeenCalledTimes(2);
  });
});

describe("createNotionCLIClient: no-cache fetch", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    capturedClientOptions = undefined;
    fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("{}"));
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("Notion Client に cache: no-store 付きカスタム fetch を渡す", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    createNotionCLIClient("test-token");

    expect(capturedClientOptions).toBeDefined();
    expect(typeof capturedClientOptions?.fetch).toBe("function");
  });

  it("カスタム fetch は元の init に cache: no-store を付与して呼ぶ", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    createNotionCLIClient("test-token");

    const customFetch = capturedClientOptions?.fetch;
    expect(customFetch).toBeDefined();
    if (!customFetch) return;

    await customFetch("https://api.notion.com/v1/test", {
      method: "GET",
      headers: { Authorization: "Bearer token" },
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.notion.com/v1/test",
      expect.objectContaining({
        method: "GET",
        cache: "no-store",
      }),
    );
  });

  it("init が未指定でも cache: no-store を付与する", async () => {
    const { createNotionCLIClient } = await import("../notion-client.js");
    createNotionCLIClient("test-token");

    const customFetch = capturedClientOptions?.fetch;
    expect(customFetch).toBeDefined();
    if (!customFetch) return;

    await customFetch("https://api.notion.com/v1/test", undefined);

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.notion.com/v1/test",
      expect.objectContaining({ cache: "no-store" }),
    );
  });
});
