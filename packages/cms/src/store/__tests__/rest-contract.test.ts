import { afterEach, describe, vi } from "vitest";
import { kvDocStore, r2BlobStore } from "../cloudflare.js";
import { runBlobStoreContract, runDocStoreContract } from "../contract.js";
import { restKvNamespace, restR2Bucket } from "../rest.js";

const OPTS = { accountId: "acc1", apiToken: "token1" };

/**
 * `restKvNamespace`/`restR2Bucket` が叩く Cloudflare REST API を最小再現する fake。
 * DocStore/BlobStore の契約テストは put→get→list→delete を素直に叩くだけなので、
 * 実際の Cloudflare 応答仕様(404/FormData/JSON 形状)さえ再現すれば十分。
 */
function fakeCloudflareRestApi(): typeof fetch {
  const kv = new Map<string, string>();
  const r2 = new Map<string, { bytes: Uint8Array; contentType?: string }>();

  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";

    const kvValue = url.pathname.match(
      /\/storage\/kv\/namespaces\/[^/]+\/values\/(.+)$/,
    );
    if (kvValue) {
      const key = decodeURIComponent(kvValue[1] as string);
      if (method === "GET") {
        return kv.has(key)
          ? new Response(kv.get(key))
          : new Response(null, { status: 404 });
      }
      if (method === "PUT") {
        const value = String((init?.body as FormData).get("value"));
        kv.set(key, value);
        return new Response(null, { status: 200 });
      }
      if (method === "DELETE") {
        kv.delete(key);
        return new Response(null, { status: 200 });
      }
    }

    if (url.pathname.match(/\/storage\/kv\/namespaces\/[^/]+\/keys$/)) {
      const prefix = url.searchParams.get("prefix") ?? "";
      const names = [...kv.keys()].filter((k) => k.startsWith(prefix)).sort();
      return new Response(
        JSON.stringify({ result: names.map((name) => ({ name })) }),
        { status: 200 },
      );
    }

    const r2Object = url.pathname.match(/\/r2\/buckets\/[^/]+\/objects\/(.+)$/);
    if (r2Object) {
      const key = decodeURIComponent(r2Object[1] as string);
      if (method === "GET") {
        const obj = r2.get(key);
        if (!obj) return new Response(null, { status: 404 });
        return new Response(obj.bytes as BodyInit, {
          status: 200,
          headers: obj.contentType
            ? { "content-type": obj.contentType }
            : undefined,
        });
      }
      if (method === "PUT") {
        const body = init?.body as Uint8Array;
        const contentType = (init?.headers as Record<string, string>)[
          "content-type"
        ];
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

describe("DocStore contract: kvDocStore(restKvNamespace)", () => {
  afterEach(() => vi.restoreAllMocks());
  runDocStoreContract({
    factory: () => {
      vi.spyOn(globalThis, "fetch").mockImplementation(fakeCloudflareRestApi());
      const namespace = restKvNamespace({ ...OPTS, namespaceId: "ns1" });
      return kvDocStore(namespace);
    },
  });
});

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
