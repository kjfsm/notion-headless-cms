import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type {
  BlobGetResult,
  BlobHead,
  BlobPutOptions,
  BlobStore,
  DocStore,
} from "./types.js";

function keyToPath(root: string, key: string): string {
  // encodeURIComponent は `:` `/` を可逆的に区別してエスケープする。
  return join(root, `${encodeURIComponent(key)}.dat`);
}

/** Node ランタイム向けファイル永続化 `DocStore`(CI ローカルキャッシュ・オフライン開発用)。 */
export function fileDocStore(root: string): DocStore {
  return {
    async get(key) {
      try {
        return await readFile(keyToPath(root, key), "utf-8");
      } catch {
        return null;
      }
    },
    async put(key, value) {
      const path = keyToPath(root, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, value, "utf-8");
    },
    async delete(key) {
      try {
        await rm(keyToPath(root, key));
      } catch {
        // 既に存在しない場合は無視。
      }
    },
  };
}

/** Node ランタイム向けファイル永続化 `BlobStore`。 */
export function fileBlobStore(root: string): BlobStore {
  const metaPath = (key: string) => `${keyToPath(root, key)}.meta.json`;
  async function readMeta(key: string): Promise<{
    contentType?: string;
    customMetadata?: Record<string, string>;
  }> {
    try {
      return JSON.parse(await readFile(metaPath(key), "utf-8"));
    } catch {
      // メタデータなし(content-type 未指定で put された)。
      return {};
    }
  }
  return {
    async get(key) {
      try {
        const buf = await readFile(keyToPath(root, key));
        return new Uint8Array(buf);
      } catch {
        return null;
      }
    },
    async getWithMetadata(key): Promise<BlobGetResult | null> {
      try {
        const buf = await readFile(keyToPath(root, key));
        const meta = await readMeta(key);
        return { bytes: new Uint8Array(buf), contentType: meta.contentType };
      } catch {
        return null;
      }
    },
    async put(key, value, opts?: BlobPutOptions) {
      const path = keyToPath(root, key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, value);
      if (opts?.contentType || opts?.customMetadata) {
        await writeFile(
          metaPath(key),
          JSON.stringify({
            contentType: opts.contentType,
            customMetadata: opts.customMetadata,
          }),
        );
      }
    },
    async head(key): Promise<BlobHead | null> {
      try {
        const buf = await readFile(keyToPath(root, key));
        const meta = await readMeta(key);
        return {
          size: buf.byteLength,
          contentType: meta.contentType,
          customMetadata: meta.customMetadata,
        };
      } catch {
        return null;
      }
    },
    async delete(key) {
      try {
        await rm(keyToPath(root, key));
        await rm(metaPath(key)).catch(() => {});
      } catch {
        // 既に存在しない場合は無視。
      }
    },
  };
}
