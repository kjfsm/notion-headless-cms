import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { IndexEntry } from "../types/collection-index.js";
import type { IndexStore, IndexUpsertInput, IndexWriteResult } from "./index-store.js";
import { memoryIndexStore } from "./index-store.js";
import type { BlobGetResult, BlobHead, BlobPutOptions, BlobStore } from "./types.js";

function keyToPath(root: string, key: string): string {
  // encodeURIComponent は `:` `/` を可逆的に区別してエスケープする。
  return join(root, `${encodeURIComponent(key)}.dat`);
}

function manifestPath(root: string): string {
  return join(root, "index-store.json");
}

/**
 * Node ランタイム向けファイル永続化 `IndexStore`(CI ローカルキャッシュ・オフライン開発・
 * `nhc sync` のウォーム用)。native 依存無しで cli を `@notion-headless-cms/cms` のみに
 * 依存させ続けるため、実装は `memoryIndexStore()` を JSON ファイルへ load/save するだけの
 * 薄いラッパーにする(SQL は張らない。永続化・スケールが要る用途は `@notion-headless-cms/sql` を使う)。
 */
export function fileIndexStore(root: string): IndexStore {
  const memory = memoryIndexStore();
  const path = manifestPath(root);
  let loaded = false;
  // memoryIndexStore はコレクション名の一覧を返す手段を持たないため、永続化対象の
  // コレクション名をここで別途追跡する(persist() の全件書き出しに必要)。
  const knownCollections = new Set<string>();

  async function ensureLoaded(): Promise<void> {
    if (loaded) return;
    loaded = true;
    try {
      const raw = JSON.parse(await readFile(path, "utf-8")) as Record<
        string,
        Record<string, IndexEntry>
      >;
      for (const [collection, entries] of Object.entries(raw)) {
        knownCollections.add(collection);
        for (const entry of Object.values(entries)) {
          await memory.upsertEntry(collection, entry, null);
        }
      }
    } catch {
      // ファイル未作成(初回実行)。空の状態から始める。
    }
  }

  async function persist(): Promise<void> {
    const snapshot: Record<string, Record<string, IndexEntry>> = {};
    for (const collection of knownCollections) {
      const entries: Record<string, IndexEntry> = {};
      for (const entry of await memory.listAllEntries(collection)) {
        entries[entry.slug] = entry;
      }
      snapshot[collection] = entries;
    }
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(snapshot), "utf-8");
  }

  return {
    async findEntry(collection, slug) {
      await ensureLoaded();
      return memory.findEntry(collection, slug);
    },
    async listEntries(collection, params) {
      await ensureLoaded();
      return memory.listEntries(collection, params);
    },
    async listAllEntries(collection) {
      await ensureLoaded();
      return memory.listAllEntries(collection);
    },
    async listSlugs(collection) {
      await ensureLoaded();
      return memory.listSlugs(collection);
    },
    async search(collection, query, params) {
      await ensureLoaded();
      return memory.search(collection, query, params);
    },
    async upsertEntry(
      collection: string,
      entry: IndexUpsertInput,
      knownExisting?: IndexEntry | null,
    ): Promise<IndexWriteResult> {
      await ensureLoaded();
      knownCollections.add(collection);
      const result = await memory.upsertEntry(collection, entry, knownExisting);
      if (result.wrote) await persist();
      return result;
    },
    async removeEntry(collection, slug) {
      await ensureLoaded();
      knownCollections.add(collection);
      const result = await memory.removeEntry(collection, slug);
      if (result.wrote) await persist();
      return result;
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
