import type { KVNamespaceLike } from "@notion-headless-cms/cache/cloudflare";

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
 * import { createCms, restKvNamespace } from "@notion-headless-cms/cloudflare";
 * import { schema } from "../app/generated/nhc.js";
 *
 * const kv = restKvNamespace({
 *   accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
 *   namespaceId: process.env.KV_NAMESPACE_ID!,
 *   apiToken: process.env.CLOUDFLARE_API_TOKEN!,
 * });
 *
 * const cms = createCms({
 *   schema,
 *   token: process.env.NOTION_TOKEN!,
 *   env: { DOC_CACHE: kv },
 *   ctx: { waitUntil: (p) => p.catch(console.error) },
 * });
 * await cms.posts.cache.warm({ onProgress: (done, total) => console.log(`${done}/${total}`) });
 */
export function restKvNamespace(opts: RestKvOptions): KVNamespaceLike {
  const base = `https://api.cloudflare.com/client/v4/accounts/${opts.accountId}/storage/kv/namespaces/${opts.namespaceId}`;
  const auth = { Authorization: `Bearer ${opts.apiToken}` };

  async function req(path: string, init?: RequestInit): Promise<Response> {
    return fetch(`${base}${path}`, {
      ...init,
      headers: { ...(init?.headers as Record<string, string> | undefined), ...auth },
    });
  }

  return {
    async get(key: string, _type: "text"): Promise<string | null> {
      const res = await req(`/values/${encodeURIComponent(key)}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`KV GET failed (${res.status}): ${await res.text()}`);
      return res.text();
    },

    async put(key: string, value: string): Promise<void> {
      const form = new FormData();
      form.append("value", value);
      // Content-Type は FormData が境界付きで自動設定するため明示しない
      const res = await req(`/values/${encodeURIComponent(key)}`, { method: "PUT", body: form });
      if (!res.ok) throw new Error(`KV PUT failed (${res.status}): ${await res.text()}`);
    },

    async delete(key: string): Promise<void> {
      const res = await req(`/values/${encodeURIComponent(key)}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404)
        throw new Error(`KV DELETE failed (${res.status}): ${await res.text()}`);
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
      if (!res.ok) throw new Error(`KV LIST failed (${res.status}): ${await res.text()}`);
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
