import type { KVNamespaceLike, R2BucketLike } from "./cloudflare-types.js";
import type { BlobHead, BlobPutOptions, BlobStore, DocStore } from "./types.js";

/** KV を `DocStore` として使う(コレクション index 用)。 */
export function kvDocStore(namespace: KVNamespaceLike): DocStore {
  return {
    async get(key) {
      return namespace.get(key, "text");
    },
    async put(key, value) {
      await namespace.put(key, value);
    },
    async list(prefix) {
      const names: string[] = [];
      let cursor: string | undefined;
      for (;;) {
        const page = await namespace.list({ prefix, cursor });
        names.push(...page.keys.map((k) => k.name));
        if (page.list_complete || !page.cursor) break;
        cursor = page.cursor;
      }
      return names;
    },
    async delete(key) {
      await namespace.delete(key);
    },
  };
}

/** R2 を `BlobStore` として使う(entry 本体・画像用)。read-after-write 強整合を前提にする。 */
export function r2BlobStore(bucket: R2BucketLike): BlobStore {
  return {
    async get(key) {
      const obj = await bucket.get(key);
      if (!obj) return null;
      return new Uint8Array(await obj.arrayBuffer());
    },
    async put(key, value, opts?: BlobPutOptions) {
      await bucket.put(
        key,
        value,
        opts?.contentType
          ? { httpMetadata: { contentType: opts.contentType } }
          : undefined,
      );
    },
    async head(key): Promise<BlobHead | null> {
      if (bucket.head) {
        const meta = await bucket.head(key);
        if (!meta) return null;
        return {
          contentType: meta.httpMetadata?.contentType,
          size: meta.size ?? 0,
        };
      }
      // head 未提供の実装向けフォールバック(本体 DL を伴う)。
      const obj = await bucket.get(key);
      if (!obj) return null;
      const buf = await obj.arrayBuffer();
      return {
        contentType: obj.httpMetadata?.contentType,
        size: buf.byteLength,
      };
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}
