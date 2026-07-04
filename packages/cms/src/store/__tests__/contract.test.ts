import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runBlobStoreContract, runDocStoreContract } from "../contract.js";
import { memoryBlobStore, memoryDocStore } from "../memory.js";
import { fileBlobStore, fileDocStore } from "../node-file.js";

describe("DocStore contract: memory", () => {
  runDocStoreContract({ factory: () => memoryDocStore() });
});

describe("BlobStore contract: memory", () => {
  runBlobStoreContract({ factory: () => memoryBlobStore() });
});

describe("DocStore contract: file", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
    );
  });
  runDocStoreContract({
    factory: async () => {
      const dir = await mkdtemp(join(tmpdir(), "v3-doc-"));
      dirs.push(dir);
      return fileDocStore(dir);
    },
  });
});

describe("BlobStore contract: file", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
    );
  });
  runBlobStoreContract({
    factory: async () => {
      const dir = await mkdtemp(join(tmpdir(), "v3-blob-"));
      dirs.push(dir);
      return fileBlobStore(dir);
    },
  });
});

describe("DocStore: file(keyToPath のエンコーディング可逆性)", () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(
      dirs.splice(0).map((d) => rm(d, { recursive: true, force: true })),
    );
  });

  it("`:` と `/` を両方含むキーでも list(prefix) が元のキーをそのまま復元する", async () => {
    const dir = await mkdtemp(join(tmpdir(), "v3-doc-encode-"));
    dirs.push(dir);
    const store = fileDocStore(dir);
    await store.put("index:posts:0", "a");
    await store.put("entry/posts/hello", "b");
    const keys = await store.list("");
    expect([...keys].sort()).toEqual(["entry/posts/hello", "index:posts:0"]);
  });
});
