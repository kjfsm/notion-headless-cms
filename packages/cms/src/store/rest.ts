import { CMSError } from "../errors.js";
import type { KVNamespaceLike, R2BucketLike, R2ObjectLike } from "./cloudflare-types.js";

/**
 * CI / ローカルから Cloudflare REST API で KV/R2 に書き込むドライバ
 * (`nhc sync warm` の土台。v2 の `restKvCache` を R2 対応に拡張)。
 */
export interface RestStoreOptions {
  readonly accountId: string;
  readonly apiToken: string;
}

export interface RestKvOptions extends RestStoreOptions {
  readonly namespaceId: string;
}

export interface RestR2Options extends RestStoreOptions {
  readonly bucketName: string;
}

function authHeaders(apiToken: string): Record<string, string> {
  return { Authorization: `Bearer ${apiToken}` };
}

/** Cloudflare KV REST API を `KVNamespaceLike` として使う(warm コマンド用)。 */
export function restKvNamespace(opts: RestKvOptions): KVNamespaceLike {
  const base = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/storage/kv/namespaces/${opts.namespaceId}`;
  const auth = authHeaders(opts.apiToken);

  async function req(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...(init?.headers as Record<string, string> | undefined),
        ...auth,
      },
    });
  }

  return {
    async get(key: string, _type: "text"): Promise<string | null> {
      const res = await req(`/values/${encodeURIComponent(key)}`);
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new CMSError({
          code: "store/rest_request_failed",
          message: `KV GET failed (${res.status}): ${await res.text()}`,
          context: { operation: "restKvNamespace.get", key },
        });
      }
      return res.text();
    },
    async put(key: string, value: string): Promise<void> {
      const form = new FormData();
      form.append("value", value);
      const res = await req(`/values/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: form,
      });
      if (!res.ok) {
        throw new CMSError({
          code: "store/rest_request_failed",
          message: `KV PUT failed (${res.status}): ${await res.text()}`,
          context: { operation: "restKvNamespace.put", key },
        });
      }
    },
    async delete(key: string): Promise<void> {
      const res = await req(`/values/${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new CMSError({
          code: "store/rest_request_failed",
          message: `KV DELETE failed (${res.status}): ${await res.text()}`,
          context: { operation: "restKvNamespace.delete", key },
        });
      }
    },
    async list(listOpts) {
      const params = new URLSearchParams();
      if (listOpts?.prefix) params.set("prefix", listOpts.prefix);
      if (listOpts?.cursor) params.set("cursor", listOpts.cursor);
      const res = await req(`/keys?${params.toString()}`);
      if (!res.ok) {
        throw new CMSError({
          code: "store/rest_request_failed",
          message: `KV LIST failed (${res.status}): ${await res.text()}`,
          context: { operation: "restKvNamespace.list" },
        });
      }
      const body = (await res.json()) as {
        result: { name: string }[];
        result_info?: { cursor?: string };
      };
      return {
        keys: body.result.map((k) => ({ name: k.name })),
        list_complete: !body.result_info?.cursor,
        cursor: body.result_info?.cursor,
      };
    },
  };
}

/** Cloudflare R2 REST API(v4)を `R2BucketLike` として使う(warm コマンド用)。 */
export function restR2Bucket(opts: RestR2Options): R2BucketLike {
  const base = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/r2/buckets/${opts.bucketName}/objects`;
  const auth = authHeaders(opts.apiToken);

  return {
    async get(key: string): Promise<R2ObjectLike | null> {
      const res = await fetch(`${base}/${encodeURIComponent(key)}`, {
        headers: auth,
      });
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new CMSError({
          code: "store/rest_request_failed",
          message: `R2 GET failed (${res.status}): ${await res.text()}`,
          context: { operation: "restR2Bucket.get", key },
        });
      }
      const contentType = res.headers.get("content-type") ?? undefined;
      return {
        arrayBuffer: () => res.arrayBuffer(),
        httpMetadata: { contentType },
      };
    },
    async put(key: string, value: ArrayBuffer | Uint8Array, putOpts) {
      const contentType = putOpts?.httpMetadata?.contentType ?? "application/octet-stream";
      const res = await fetch(`${base}/${encodeURIComponent(key)}`, {
        method: "PUT",
        headers: { ...auth, "content-type": contentType },
        body: value instanceof Uint8Array ? new Uint8Array(value) : value,
      });
      if (!res.ok) {
        throw new CMSError({
          code: "store/rest_request_failed",
          message: `R2 PUT failed (${res.status}): ${await res.text()}`,
          context: { operation: "restR2Bucket.put", key },
        });
      }
      return undefined;
    },
    async delete(key: string) {
      const res = await fetch(`${base}/${encodeURIComponent(key)}`, {
        method: "DELETE",
        headers: auth,
      });
      if (!res.ok && res.status !== 404) {
        throw new CMSError({
          code: "store/rest_request_failed",
          message: `R2 DELETE failed (${res.status}): ${await res.text()}`,
          context: { operation: "restR2Bucket.delete", key },
        });
      }
      return undefined;
    },
  };
}

/**
 * warm コマンド向けに、Cloudflare REST 認証情報を環境変数から読み取る(KV/R2 共通)。
 * 不足があれば `CMSError("store/rest_env_missing")` を投げる。
 *
 * 期待する環境変数: `CLOUDFLARE_ACCOUNT_ID` / `KV_NAMESPACE_ID` / `R2_BUCKET_NAME` / `CLOUDFLARE_API_TOKEN`
 */
export function readRestEnv(env: Record<string, string | undefined> = defaultProcessEnv()): {
  accountId: string;
  namespaceId: string;
  bucketName: string;
  apiToken: string;
} {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const namespaceId = env.KV_NAMESPACE_ID;
  const bucketName = env.R2_BUCKET_NAME;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  const missing = [
    !accountId && "CLOUDFLARE_ACCOUNT_ID",
    !namespaceId && "KV_NAMESPACE_ID",
    !bucketName && "R2_BUCKET_NAME",
    !apiToken && "CLOUDFLARE_API_TOKEN",
  ].filter((v): v is string => typeof v === "string");
  if (missing.length > 0) {
    throw new CMSError({
      code: "store/rest_env_missing",
      message: `warm に必要な環境変数が未設定です: ${missing.join(", ")}`,
      context: { operation: "readRestEnv", missing: missing.join(",") },
    });
  }
  return {
    accountId: accountId as string,
    namespaceId: namespaceId as string,
    bucketName: bucketName as string,
    apiToken: apiToken as string,
  };
}

function defaultProcessEnv(): Record<string, string | undefined> {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env ?? {};
}
