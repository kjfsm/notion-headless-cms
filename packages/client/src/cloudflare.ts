import {
  type KVNamespaceLike,
  kvCache,
} from "@notion-headless-cms/cache/cloudflare";
import { type CacheAdapter, CMSError } from "@notion-headless-cms/core";

export type {
  CloudflareExecutionContextLike,
  CloudflarePresetEnv,
  CloudflarePresetOptions,
  CloudflarePresetTestOptions,
} from "@notion-headless-cms/cache/cloudflare";
export { cloudflarePreset } from "@notion-headless-cms/cache/cloudflare";

/** Cloudflare KV REST API に接続するための認証情報。 */
export interface RestKvOptions {
  /** Cloudflare アカウント ID。 */
  accountId: string;
  /** KV namespace ID (`wrangler kv namespace list` で確認)。 */
  namespaceId: string;
  /**
   * Cloudflare API トークン。
   * 「Account > Cloudflare Workers KV Storage: Edit」権限が必要。
   * コードにハードコードせず環境変数から渡すこと。
   */
  apiToken: string;
}

/**
 * Cloudflare KV REST API を `KVNamespaceLike` として実装するアダプタ。
 * Node.js warm スクリプトから Cloudflare KV へ書き込む際に使用する。
 * Cloudflare Workers 上では env.DOC_CACHE（ネイティブバインディング）を使うこと。
 *
 * @example
 * // scripts/warm-kv.ts
 * import { createCMS, restKvNamespace } from "@notion-headless-cms/client/cloudflare";
 * import { schema } from "../app/generated/nhc.js";
 *
 * const kv = restKvNamespace({
 *   accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
 *   namespaceId: process.env.KV_NAMESPACE_ID!,
 *   apiToken: process.env.CLOUDFLARE_API_TOKEN!,
 * });
 *
 * const cms = createCMS({
 *   schema,
 *   token: process.env.NOTION_TOKEN!,
 *   runtime: { cache: [restKvCache({ accountId, namespaceId, apiToken })] },
 * });
 * await cms.posts.cache.warm({ onProgress: (done, total) => console.log(`${done}/${total}`) });
 */
export function restKvNamespace(opts: RestKvOptions): KVNamespaceLike {
  const base = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/storage/kv/namespaces/${opts.namespaceId}`;
  const auth = { Authorization: `Bearer ${opts.apiToken}` };

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
      if (!res.ok)
        throw new Error(`KV GET failed (${res.status}): ${await res.text()}`);
      return res.text();
    },

    async put(key: string, value: string): Promise<void> {
      const form = new FormData();
      form.append("value", value);
      // Content-Type は FormData が境界付きで自動設定するため明示しない
      const res = await req(`/values/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: form,
      });
      if (!res.ok)
        throw new Error(`KV PUT failed (${res.status}): ${await res.text()}`);
    },

    async delete(key: string): Promise<void> {
      const res = await req(`/values/${encodeURIComponent(key)}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 404)
        throw new Error(
          `KV DELETE failed (${res.status}): ${await res.text()}`,
        );
    },

    async list(listOpts?: { prefix?: string; cursor?: string }): Promise<{
      keys: { name: string }[];
      list_complete: boolean;
      cursor?: string;
    }> {
      const params = new URLSearchParams({ limit: "1000" });
      if (listOpts?.prefix) params.set("prefix", listOpts.prefix);
      if (listOpts?.cursor) params.set("cursor", listOpts.cursor);
      const res = await req(`/keys?${params}`);
      if (!res.ok)
        throw new Error(`KV LIST failed (${res.status}): ${await res.text()}`);
      const json = (await res.json()) as {
        success: boolean;
        result: { name: string }[];
        result_info?: { cursor?: string };
      };
      if (!json.success) throw new Error("KV LIST: API returned success=false");
      const cursor = json.result_info?.cursor;
      return { keys: json.result, list_complete: !cursor, cursor };
    },
  };
}

/** `restKvCache()` のオプション。`prefix` で複数サイトの相乗りキーを分離できる。 */
export interface RestKvCacheOptions extends RestKvOptions {
  /** キャッシュキーの接頭辞 (例: `"blog:"`)。 */
  prefix?: string;
}

/**
 * Cloudflare KV REST API をドキュメントキャッシュ (`CacheAdapter`) として返す。
 * Node.js の warm スクリプトで `createCMS({ runtime: { cache: [restKvCache(...)] } })` に渡し、
 * `cms.<collection>.cache.warm()` を実行すると、Workers が読むのと同じ KV に書き込める。
 *
 * @example
 * import { createCMS, restKvCache, readRestKvEnv } from "@notion-headless-cms/client/cloudflare";
 * import { schema } from "../app/generated/nhc.js";
 *
 * const cms = createCMS({
 *   schema,
 *   token: process.env.NOTION_TOKEN!,
 *   runtime: { cache: [restKvCache(readRestKvEnv())] },
 * });
 * await cms.posts.cache.warm({ onProgress: (d, t) => console.log(`${d}/${t}`) });
 */
export function restKvCache(opts: RestKvCacheOptions): CacheAdapter {
  const namespace = restKvNamespace(opts);
  return kvCache(
    opts.prefix ? { namespace, prefix: opts.prefix } : { namespace },
  );
}

/**
 * warm スクリプト向けに、Cloudflare KV REST 認証情報を環境変数から読み取る。
 * 不足があれば `cloudflare/warm_env_missing` の `CMSError` を投げる。
 *
 * 期待する環境変数:
 * - `CLOUDFLARE_ACCOUNT_ID`
 * - `KV_NAMESPACE_ID`
 * - `CLOUDFLARE_API_TOKEN`
 */
export function readRestKvEnv(
  env: Record<string, string | undefined> = defaultProcessEnv(),
): RestKvOptions {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const namespaceId = env.KV_NAMESPACE_ID;
  const apiToken = env.CLOUDFLARE_API_TOKEN;
  const missing = [
    !accountId && "CLOUDFLARE_ACCOUNT_ID",
    !namespaceId && "KV_NAMESPACE_ID",
    !apiToken && "CLOUDFLARE_API_TOKEN",
  ].filter((v): v is string => typeof v === "string");
  if (missing.length > 0) {
    throw new CMSError({
      code: "cloudflare/warm_env_missing",
      message: `KV warm に必要な環境変数が未設定です: ${missing.join(", ")}`,
      context: { operation: "readRestKvEnv", missing: missing.join(", ") },
    });
  }
  // missing が空なので非 undefined が保証される。
  return {
    accountId: accountId as string,
    namespaceId: namespaceId as string,
    apiToken: apiToken as string,
  };
}

/**
 * Node 実行時の `process.env` を型依存なしで取得する。
 * Workers 向けに `@types/node` を含めないため、`globalThis` 経由で参照する
 * (Workers 上では空オブジェクトになる)。
 */
function defaultProcessEnv(): Record<string, string | undefined> {
  const proc = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process;
  return proc?.env ?? {};
}
