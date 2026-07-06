import type { KVNamespaceLike, R2BucketLike } from "./cloudflare-types.js";
import type { BlobGetResult, BlobHead, BlobPutOptions, BlobStore, DocStore } from "./types.js";

/** KV を `DocStore` として使う(コレクション index 用)。 */
export function kvDocStore(namespace: KVNamespaceLike): DocStore {
  return {
    async get(key) {
      return namespace.get(key, "text");
    },
    async put(key, value) {
      await namespace.put(key, value);
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
    async getWithMetadata(key): Promise<BlobGetResult | null> {
      const obj = await bucket.get(key);
      if (!obj) return null;
      return {
        bytes: new Uint8Array(await obj.arrayBuffer()),
        contentType: obj.httpMetadata?.contentType,
      };
    },
    async put(key, value, opts?: BlobPutOptions) {
      await bucket.put(
        key,
        value,
        opts?.contentType || opts?.customMetadata
          ? {
              httpMetadata: opts.contentType ? { contentType: opts.contentType } : undefined,
              customMetadata: opts.customMetadata ? { ...opts.customMetadata } : undefined,
            }
          : undefined,
      );
    },
    async head(key): Promise<BlobHead | null> {
      if (bucket.head) {
        const meta = await bucket.head(key);
        if (!meta) return null;
        return {
          contentType: meta.httpMetadata?.contentType,
          customMetadata: meta.customMetadata,
          size: meta.size ?? 0,
        };
      }
      // head 未提供の実装向けフォールバック(本体 DL を伴う)。
      const obj = await bucket.get(key);
      if (!obj) return null;
      const buf = await obj.arrayBuffer();
      return {
        contentType: obj.httpMetadata?.contentType,
        customMetadata: obj.customMetadata,
        size: buf.byteLength,
      };
    },
    async delete(key) {
      await bucket.delete(key);
    },
  };
}
