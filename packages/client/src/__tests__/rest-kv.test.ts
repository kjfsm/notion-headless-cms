import { isCMSError } from "@notion-headless-cms/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { readRestKvEnv, restKvCache, restKvNamespace } from "../cloudflare";

const fullEnv = {
  CLOUDFLARE_ACCOUNT_ID: "acc",
  KV_NAMESPACE_ID: "ns",
  CLOUDFLARE_API_TOKEN: "tok",
};

const opts = { accountId: "acc", namespaceId: "ns", apiToken: "tok" };

describe("readRestKvEnv", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("必要な環境変数が揃っていれば RestKvOptions を返す", () => {
    expect(readRestKvEnv(fullEnv)).toEqual({
      accountId: "acc",
      namespaceId: "ns",
      apiToken: "tok",
    });
  });

  it("引数省略時は process.env から読む", () => {
    vi.stubEnv("CLOUDFLARE_ACCOUNT_ID", "acc");
    vi.stubEnv("KV_NAMESPACE_ID", "ns");
    vi.stubEnv("CLOUDFLARE_API_TOKEN", "tok");
    expect(readRestKvEnv()).toEqual({
      accountId: "acc",
      namespaceId: "ns",
      apiToken: "tok",
    });
  });

  it("不足があれば cloudflare/warm_env_missing を投げ、不足名を含む", () => {
    try {
      readRestKvEnv({ CLOUDFLARE_ACCOUNT_ID: "acc" });
      expect.unreachable("should throw");
    } catch (err) {
      expect(isCMSError(err) && err.is("cloudflare/warm_env_missing")).toBe(
        true,
      );
      expect((err as Error).message).toContain("KV_NAMESPACE_ID");
      expect((err as Error).message).toContain("CLOUDFLARE_API_TOKEN");
    }
  });
});

describe("restKvCache", () => {
  it("ドキュメントキャッシュ用の CacheAdapter を返す", () => {
    const adapter = restKvCache(opts);
    expect(adapter.name).toBe("kv");
    expect(adapter.handles).toContain("document");
    expect(adapter.doc).toBeDefined();
  });

  it("prefix を指定しても CacheAdapter を返す", () => {
    const adapter = restKvCache({ ...opts, prefix: "blog:" });
    expect(adapter.handles).toContain("document");
  });
});

describe("restKvNamespace", () => {
  afterEach(() => vi.restoreAllMocks());

  const mockFetch = (impl: () => Response) =>
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => impl());

  it("GET は値を返し、Authorization ヘッダを付ける", async () => {
    const spy = mockFetch(() => new Response("value-1", { status: 200 }));
    const kv = restKvNamespace(opts);
    expect(await kv.get("k", "text")).toBe("value-1");
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer tok",
    );
  });

  it("GET 404 は null を返す", async () => {
    mockFetch(() => new Response("", { status: 404 }));
    const kv = restKvNamespace(opts);
    expect(await kv.get("missing", "text")).toBeNull();
  });

  it("GET が 404 以外の失敗なら throw する", async () => {
    mockFetch(() => new Response("boom", { status: 500 }));
    const kv = restKvNamespace(opts);
    await expect(kv.get("k", "text")).rejects.toThrow(/KV GET failed \(500\)/);
  });

  it("PUT は FormData で値を送る", async () => {
    const spy = mockFetch(() => new Response("", { status: 200 }));
    const kv = restKvNamespace(opts);
    await kv.put("k", "v");
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(init.body).toBeInstanceOf(FormData);
  });

  it("PUT 失敗は throw する", async () => {
    mockFetch(() => new Response("nope", { status: 403 }));
    const kv = restKvNamespace(opts);
    await expect(kv.put("k", "v")).rejects.toThrow(/KV PUT failed \(403\)/);
  });

  it("DELETE は 200 を許容する", async () => {
    mockFetch(() => new Response("", { status: 200 }));
    const kv = restKvNamespace(opts);
    await expect(kv.delete("k")).resolves.toBeUndefined();
  });

  it("DELETE は 404 も許容する", async () => {
    mockFetch(() => new Response("", { status: 404 }));
    const kv = restKvNamespace(opts);
    await expect(kv.delete("k")).resolves.toBeUndefined();
  });

  it("DELETE のその他失敗は throw する", async () => {
    mockFetch(() => new Response("err", { status: 500 }));
    const kv = restKvNamespace(opts);
    await expect(kv.delete("k")).rejects.toThrow(/KV DELETE failed \(500\)/);
  });

  it("LIST は keys を返し、prefix / cursor をクエリに載せる", async () => {
    const spy = mockFetch(
      () =>
        new Response(
          JSON.stringify({
            success: true,
            result: [{ name: "a" }, { name: "b" }],
            result_info: { cursor: "next-cursor" },
          }),
          { status: 200 },
        ),
    );
    const kv = restKvNamespace(opts);
    const res = await kv.list({ prefix: "p:", cursor: "c0" });
    expect(res.keys).toEqual([{ name: "a" }, { name: "b" }]);
    expect(res.list_complete).toBe(false);
    expect(res.cursor).toBe("next-cursor");
    const [url] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("prefix=p%3A");
    expect(url).toContain("cursor=c0");
  });

  it("LIST は cursor 無しで list_complete=true を返す", async () => {
    mockFetch(
      () =>
        new Response(
          JSON.stringify({ success: true, result: [], result_info: {} }),
          { status: 200 },
        ),
    );
    const kv = restKvNamespace(opts);
    const res = await kv.list();
    expect(res.list_complete).toBe(true);
  });

  it("LIST の HTTP 失敗は throw する", async () => {
    mockFetch(() => new Response("x", { status: 500 }));
    const kv = restKvNamespace(opts);
    await expect(kv.list()).rejects.toThrow(/KV LIST failed \(500\)/);
  });

  it("LIST の success=false は throw する", async () => {
    mockFetch(
      () => new Response(JSON.stringify({ success: false, result: [] })),
    );
    const kv = restKvNamespace(opts);
    await expect(kv.list()).rejects.toThrow(/success=false/);
  });
});
