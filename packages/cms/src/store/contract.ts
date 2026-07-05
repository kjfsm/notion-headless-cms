import { expect, it } from "vitest";
import type { BlobStore, DocStore } from "./types.js";

export interface DocStoreContractOptions {
  factory: () => DocStore | Promise<DocStore>;
}

/**
 * `DocStore` 実装が満たすべき契約を検証する。同一スイートを
 * memory / file / (miniflare KV 等)複数実装に対して走らせ、差し替え可能性を保証する。
 */
export function runDocStoreContract(opts: DocStoreContractOptions) {
  it("put した値が get で読み戻せる", async () => {
    const store = await opts.factory();
    await store.put("k1", "hello");
    expect(await store.get("k1")).toBe("hello");
  });

  it("存在しないキーは null を返す", async () => {
    const store = await opts.factory();
    expect(await store.get("does-not-exist")).toBeNull();
  });

  it("同じキーへの put は上書きする", async () => {
    const store = await opts.factory();
    await store.put("k1", "a");
    await store.put("k1", "b");
    expect(await store.get("k1")).toBe("b");
  });

  it("delete 後は get が null を返す", async () => {
    const store = await opts.factory();
    await store.put("k1", "hello");
    await store.delete("k1");
    expect(await store.get("k1")).toBeNull();
  });
}

export interface BlobStoreContractOptions {
  factory: () => BlobStore | Promise<BlobStore>;
}

/** `BlobStore` 実装が満たすべき契約を検証する。 */
export function runBlobStoreContract(opts: BlobStoreContractOptions) {
  it("put したバイト列が get で読み戻せる", async () => {
    const store = await opts.factory();
    const bytes = new Uint8Array([1, 2, 3]);
    await store.put("k1", bytes);
    expect(await store.get("k1")).toEqual(bytes);
  });

  it("存在しないキーは null を返す", async () => {
    const store = await opts.factory();
    expect(await store.get("does-not-exist")).toBeNull();
  });

  it("head が本体を DL せずメタデータを返す", async () => {
    const store = await opts.factory();
    await store.put("k1", new Uint8Array([1, 2, 3, 4]), {
      contentType: "image/png",
    });
    const head = await store.head("k1");
    expect(head?.size).toBe(4);
    expect(head?.contentType).toBe("image/png");
  });

  it("存在しないキーの head は null", async () => {
    const store = await opts.factory();
    expect(await store.head("does-not-exist")).toBeNull();
  });

  it("delete 後は get / head が null を返す", async () => {
    const store = await opts.factory();
    await store.put("k1", new Uint8Array([1]));
    await store.delete("k1");
    expect(await store.get("k1")).toBeNull();
    expect(await store.head("k1")).toBeNull();
  });

  it("同じキーへの put はアトミックに上書きする(直前の内容は残らない)", async () => {
    const store = await opts.factory();
    await store.put("k1", new Uint8Array([1, 1, 1]));
    await store.put("k1", new Uint8Array([2, 2]));
    expect(await store.get("k1")).toEqual(new Uint8Array([2, 2]));
  });
}

/**
 * `customMetadata` と `getWithMetadata` に対応する `BlobStore` 実装向けの追加契約。
 * 未対応の実装(REST 経由等)には課さないため、基本契約とは分離している。
 */
export function runBlobStoreMetadataContract(opts: BlobStoreContractOptions) {
  it("put した customMetadata が head で読み戻せる", async () => {
    const store = await opts.factory();
    await store.put("k1", new Uint8Array([1, 2]), {
      contentType: "image/png",
      customMetadata: { width: "800", height: "600" },
    });
    const head = await store.head("k1");
    expect(head?.customMetadata).toEqual({ width: "800", height: "600" });
  });

  it("customMetadata 無しで put したキーの head は customMetadata を返さない", async () => {
    const store = await opts.factory();
    await store.put("k1", new Uint8Array([1]));
    const head = await store.head("k1");
    expect(head?.customMetadata ?? undefined).toBeUndefined();
  });

  it("getWithMetadata は本体と contentType を 1 回で返す", async () => {
    const store = await opts.factory();
    await store.put("k1", new Uint8Array([1, 2, 3]), {
      contentType: "image/png",
    });
    const result = await store.getWithMetadata?.("k1");
    expect(result?.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(result?.contentType).toBe("image/png");
  });

  it("存在しないキーの getWithMetadata は null を返す", async () => {
    const store = await opts.factory();
    expect(await store.getWithMetadata?.("does-not-exist")).toBeNull();
  });
}
