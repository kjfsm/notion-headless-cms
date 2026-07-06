import { afterEach, describe, vi } from "vitest";

import { r2BlobStore } from "../cloudflare.js";
import { runBlobStoreContract } from "../contract.js";
import { restR2Bucket } from "../rest.js";

const OPTS = { accountId: "acc1", apiToken: "token1" };

/**
 * `restR2Bucket` が叩く Cloudflare REST API を最小再現する fake。
 * BlobStore の契約テストは put→get→delete を素直に叩くだけなので、
 * 実際の Cloudflare 応答仕様(404/JSON 形状)さえ再現すれば十分。
 */
function fakeCloudflareRestApi(): typeof fetch {
  const r2 = new Map<string, { bytes: Uint8Array; contentType?: string }>();

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    const method = init?.method ?? "GET";

    const r2Object = url.pathname.match(/\/r2\/buckets\/[^/]+\/objects\/(.+)$/);
    if (r2Object) {
      const key = decodeURIComponent(r2Object[1] as string);
      if (method === "GET") {
        const obj = r2.get(key);
        if (!obj) return new Response(null, { status: 404 });
        return new Response(obj.bytes as BodyInit, {
          status: 200,
          headers: obj.contentType ? { "content-type": obj.contentType } : undefined,
        });
      }
      if (method === "PUT") {
        const body = init?.body as Uint8Array;
        const contentType = (init!.headers as Record<string, string>)["content-type"];
        r2.set(key, { bytes: body, contentType });
        return new Response(null, { status: 200 });
      }
      if (method === "DELETE") {
        r2.delete(key);
        return new Response(null, { status: 200 });
      }
    }

    throw new Error(`unhandled fake fetch: ${method} ${url.pathname}`);
  }) as typeof fetch;
}

describe("BlobStore contract: r2BlobStore(restR2Bucket)", () => {
  afterEach(() => vi.restoreAllMocks());
  runBlobStoreContract({
    factory: () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(fakeCloudflareRestApi());
      const bucket = restR2Bucket({ ...OPTS, bucketName: "b1" });
      return r2BlobStore(bucket);
    },
  });
});
