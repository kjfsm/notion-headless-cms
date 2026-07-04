import type { BlobHead, BlobPutOptions, BlobStore, DocStore } from "./types.js";

/** テスト・Node 実行時向けの in-memory `DocStore`。 */
export function memoryDocStore(): DocStore {
  const map = new Map<string, string>();
  return {
    async get(key) {
      return map.get(key) ?? null;
    },
    async put(key, value) {
      map.set(key, value);
    },
    async delete(key) {
      map.delete(key);
    },
  };
}

/** テスト・Node 実行時向けの in-memory `BlobStore`。 */
export function memoryBlobStore(): BlobStore {
  const map = new Map<string, { bytes: Uint8Array; contentType?: string }>();
  return {
    async get(key) {
      return map.get(key)?.bytes ?? null;
    },
    async put(key, value, opts?: BlobPutOptions) {
      map.set(key, { bytes: value, contentType: opts?.contentType });
    },
    async head(key): Promise<BlobHead | null> {
      const entry = map.get(key);
      if (!entry) return null;
      return { contentType: entry.contentType, size: entry.bytes.byteLength };
    },
    async delete(key) {
      map.delete(key);
    },
  };
}
