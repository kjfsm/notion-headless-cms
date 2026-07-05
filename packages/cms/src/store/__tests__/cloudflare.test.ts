import { describe } from "vitest";
import { kvDocStore, r2BlobStore } from "../cloudflare.js";
import type {
  KVNamespaceLike,
  R2BucketLike,
  R2ObjectLike,
} from "../cloudflare-types.js";
import {
  runBlobStoreContract,
  runBlobStoreMetadataContract,
  runDocStoreContract,
} from "../contract.js";

function fakeKvNamespace(): KVNamespaceLike {
  const store = new Map<string, string>();
  return {
    async get(key) {
      return store.get(key) ?? null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
    async list(opts) {
      const prefix = opts?.prefix ?? "";
      const keys = [...store.keys()]
        .filter((k) => k.startsWith(prefix))
        .map((name) => ({ name }));
      return { keys, list_complete: true };
    },
  };
}

function fakeR2Bucket(): R2BucketLike {
  const store = new Map<
    string,
    {
      bytes: Uint8Array;
      contentType?: string;
      customMetadata?: Record<string, string>;
    }
  >();
  return {
    async get(key): Promise<R2ObjectLike | null> {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        arrayBuffer: async () => entry.bytes.buffer as ArrayBuffer,
        httpMetadata: { contentType: entry.contentType },
        customMetadata: entry.customMetadata,
        size: entry.bytes.byteLength,
      };
    },
    async head(key) {
      const entry = store.get(key);
      if (!entry) return null;
      return {
        httpMetadata: { contentType: entry.contentType },
        customMetadata: entry.customMetadata,
        size: entry.bytes.byteLength,
      };
    },
    async put(key, value, opts) {
      const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
      store.set(key, {
        bytes,
        contentType: opts?.httpMetadata?.contentType,
        customMetadata: opts?.customMetadata,
      });
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

describe("DocStore contract: KV (fake)", () => {
  runDocStoreContract({ factory: () => kvDocStore(fakeKvNamespace()) });
});

describe("BlobStore contract: R2 (fake)", () => {
  runBlobStoreContract({ factory: () => r2BlobStore(fakeR2Bucket()) });
  runBlobStoreMetadataContract({ factory: () => r2BlobStore(fakeR2Bucket()) });
});
