---
description: vitest によるテスト執筆パターン（KV/R2 fake / fakeTimers / fetch モック / CMSError 検証）
paths:
  - "packages/**/__tests__/**"
  - "packages/**/*.test.ts"
  - "vitest.workspace.ts"
---

# テスト執筆パターン

## ファイル配置

- 各パッケージの `src/__tests__/*.test.ts`
- `vitest.workspace.ts` に登録済みのパッケージのみワークスペースで実行される

## 実行

```bash
pnpm test                                    # ワークスペース全体
pnpm --filter @notion-headless-cms/cms test  # 個別
pnpm exec vitest --watch                     # watch
```

## パターン 1: KV/R2 fake（`Map` ベース）

`packages/cms/src/store/__tests__/cloudflare.test.ts` を参考。`KVNamespaceLike`/`R2BucketLike` の構造型を満たす fake:

```ts
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
      const keys = [...store.keys()].filter((k) => k.startsWith(prefix)).map((name) => ({ name }));
      return { keys, list_complete: true };
    },
  };
}
```

`store/contract.ts` の `runDocStoreContract`/`runBlobStoreContract` に fake を渡せば、実装間で共通のテストを再利用できる。

## パターン 2: fetch モック

画像フェッチ・OGP・Notion API のテストでは `global.fetch` を置換:

```ts
const fetchSpy = vi
  .spyOn(global, "fetch")
  .mockResolvedValue(
    new Response(new ArrayBuffer(8), { headers: { "content-type": "image/png" } }),
  );
```

## パターン 3: fakeTimers

sync のデバウンス・chunk 間隔のテストで時間を進める:

```ts
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("debounceMs 経過後に同期が発火する", () => {
  vi.setSystemTime(new Date("2024-01-01"));
  // ...
  vi.advanceTimersByTime(10_000);
});
```

## パターン 4: CMSError の検証

```ts
import { CMSError, isCMSError, matchCMSError } from "../errors";

await expect(cms.find(slug)).rejects.toSatisfy(
  (err: unknown) => isCMSError(err) && err.is("sync/notion_query_failed"),
);

// matchCMSError によるコードごとの分岐
try {
  await cms.posts.find("slug");
} catch (err) {
  matchCMSError(err, {
    "sync/notion_query_failed": (e) => console.error("取得失敗", e),
    "store/rest_request_failed": (e) => console.error("ストア I/O 失敗", e),
  });
}
```

## パターン 5: 環境変数のスタブ

```ts
vi.stubEnv("NOTION_TOKEN", "test-token");
// ...
vi.unstubAllEnvs(); // afterEach
```

## 避けるべき

- 実 Notion API の呼び出し（`NOTION_TOKEN` を使うテストは CI でスキップ）
- `console.log` 残し（Biome が警告）
- ファイル I/O（OS 非互換）。代わりに in-memory モックを使う
- `any` キャスト（`strict: true`）
