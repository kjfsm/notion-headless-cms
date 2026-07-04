import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe } from "vitest";
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
