import { afterEach, describe, expect, it, vi } from "vitest";

import { CMSError } from "../../errors.js";
import { readRestEnv, restR2Bucket } from "../rest.js";

const OPTS = { accountId: "acc1", apiToken: "token1" };

describe("restR2Bucket", () => {
  afterEach(() => vi.restoreAllMocks());

  it("get はバイト列と content-type を返す", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/png" },
      }),
    );
    const bucket = restR2Bucket({ ...OPTS, bucketName: "b1" });
    const obj = await bucket.get("k1");
    expect(obj?.httpMetadata?.contentType).toBe("image/png");
    expect(new Uint8Array(await obj!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("404 は null を返す", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 404 }));
    const bucket = restR2Bucket({ ...OPTS, bucketName: "b1" });
    expect(await bucket.get("missing")).toBeNull();
  });

  it("put は content-type ヘッダ付きで PUT する", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    const bucket = restR2Bucket({ ...OPTS, bucketName: "b1" });
    await bucket.put("k1", new Uint8Array([1, 2]), {
      httpMetadata: { contentType: "image/png" },
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/r2/buckets/b1/objects/k1"),
      expect.objectContaining({
        method: "PUT",
        headers: expect.objectContaining({ "content-type": "image/png" }),
      }),
    );
  });
});

describe("readRestEnv", () => {
  it("全環境変数が揃っていれば値を返す", () => {
    const env = {
      CLOUDFLARE_ACCOUNT_ID: "acc1",
      R2_BUCKET_NAME: "b1",
      CLOUDFLARE_API_TOKEN: "token1",
    };
    expect(readRestEnv(env)).toEqual({
      accountId: "acc1",
      bucketName: "b1",
      apiToken: "token1",
    });
  });

  it("不足があれば CMSError を投げる", () => {
    expect(() => readRestEnv({})).toThrow(CMSError);
  });
});
