import type { BlobGetResult, BlobHead, BlobPutOptions, BlobStore } from "./types.js";

/** テスト・Node 実行時向けの in-memory `BlobStore`。 */
export function memoryBlobStore(): BlobStore {
  const map = new Map<
    string,
    {
      bytes: Uint8Array;
      contentType?: string;
      customMetadata?: Readonly<Record<string, string>>;
    }
  >();
  return {
    // R2 は書き込み時にバイト列をコピーして保持する(呼び出し側の配列を後から
    // 変異させても保存内容には影響しない)。in-memory 実装が参照をそのまま
    // 共有すると、この不変性を前提にしたコードが R2 実装とだけ整合し、
    // in-memory 実装ではデータ破損する形でコントラクトテストの穴になる。
    // put/get の両方で `.slice()` してコピーを渡すことで挙動を合わせる。
    async get(key) {
      const entry = map.get(key);
      return entry ? entry.bytes.slice() : null;
    },
    async getWithMetadata(key): Promise<BlobGetResult | null> {
      const entry = map.get(key);
      if (!entry) return null;
      return { bytes: entry.bytes.slice(), contentType: entry.contentType };
    },
    async put(key, value, opts?: BlobPutOptions) {
      map.set(key, {
        bytes: value.slice(),
        contentType: opts?.contentType,
        customMetadata: opts?.customMetadata,
      });
    },
    async head(key): Promise<BlobHead | null> {
      const entry = map.get(key);
      if (!entry) return null;
      return {
        contentType: entry.contentType,
        customMetadata: entry.customMetadata,
        size: entry.bytes.byteLength,
      };
    },
    async delete(key) {
      map.delete(key);
    },
  };
}
