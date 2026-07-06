import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  runBlobStoreContract,
  runBlobStoreMetadataContract,
  runIndexStoreContract,
} from "../contract.js";
import { memoryIndexStore } from "../index-store.js";
import { memoryBlobStore } from "../memory.js";
import { fileBlobStore, fileIndexStore } from "../node-file.js";

describe("IndexStore contract: memory", () => {
  runIndexStoreContract({ factory: () => memoryIndexStore() });
});

describe("BlobStore contract: memory", () => {
  runBlobStoreContract({ factory: () => memoryBlobStore() });
  runBlobStoreMetadataContract({ factory: () => memoryBlobStore() });

  // R2 は書き込み時にコピーを保持する(read-after-write 強整合の一部)。
  // memory 実装が内部の Uint8Array 参照をそのまま共有すると、この不変性を
  // 前提にしたコードが R2 実装とだけ整合し in-memory 実装では破損しうるため、
  // 参照分離を明示的に検証する(fake R2 はバッファ共有の制約があり同じ契約を
  // 課せないため、ここでは memory 実装のみを対象にする)。
  it("get で受け取ったバイト列を変更しても保存内容には影響しない", async () => {
    const store = memoryBlobStore();
    await store.put("k1", new Uint8Array([1, 2, 3]));
    const first = await store.get("k1");
    first?.set([9, 9, 9]);
    expect(await store.get("k1")).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("put に渡したバイト列を後から変更しても保存内容には影響しない", async () => {
    const store = memoryBlobStore();
    const bytes = new Uint8Array([1, 2, 3]);
    await store.put("k1", bytes);
    bytes.set([9, 9, 9]);
    expect(await store.get("k1")).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe("IndexStore contract: file", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });
  runIndexStoreContract({
    factory: async () => {
      const dir = await mkdtemp(join(tmpdir(), "v3-index-"));
      dirs.push(dir);
      return fileIndexStore(dir);
    },
  });
});

describe("BlobStore contract: file", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
  });
  runBlobStoreContract({
    factory: async () => {
      const dir = await mkdtemp(join(tmpdir(), "v3-blob-"));
      dirs.push(dir);
      return fileBlobStore(dir);
    },
  });
  runBlobStoreMetadataContract({
    factory: async () => {
      const dir = await mkdtemp(join(tmpdir(), "v3-blob-meta-"));
      dirs.push(dir);
      return fileBlobStore(dir);
    },
  });
});
