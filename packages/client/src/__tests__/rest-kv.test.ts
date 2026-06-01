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
  it("必要な環境変数が揃っていれば RestKvOptions を返す", () => {
    expect(readRestKvEnv(fullEnv)).toEqual({
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

  it("GET 404 は null を返す", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 404 }),
    );
    const kv = restKvNamespace(opts);
    expect(await kv.get("missing", "text")).toBeNull();
  });

  it("PUT は FormData で値を送る", async () => {
    const spy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("", { status: 200 }));
    const kv = restKvNamespace(opts);
    await kv.put("k", "v");
    expect(spy).toHaveBeenCalledTimes(1);
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("PUT");
    expect(init.body).toBeInstanceOf(FormData);
  });
});
