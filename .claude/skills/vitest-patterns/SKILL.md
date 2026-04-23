---
name: vitest-patterns
description: このリポジトリで使われている vitest のテストパターン集。DataSource モック、renderer モック、R2 fake bucket、fakeTimers、fetch モック。__tests__/ を触る時に自動で呼ばれる
---

# vitest-patterns — テスト執筆パターン

## ファイル配置

- 各パッケージの `src/__tests__/*.test.ts`
- `vitest.workspace.ts` に登録済みのパッケージのみワークスペースで実行される

## 実行

```bash
pnpm test                              # ワークスペース全体
pnpm --filter @notion-headless-cms/core test   # 個別
pnpm exec vitest --watch               # watch
```

## パターン 1: DataSource モック

```ts
import { vi } from "vitest";
import type { DataSourceAdapter, BaseContentItem } from "../types/index";

const makeMockSource = (items: BaseContentItem[] = []): DataSourceAdapter => ({
	name: "mock",
	list: vi.fn().mockImplementation(async (opts) => {
		if (opts?.publishedStatuses?.length) {
			return items.filter((i) =>
				i.status && (opts.publishedStatuses as string[]).includes(i.status),
			);
		}
		return items;
	}),
	findBySlug: vi.fn().mockImplementation(async (slug) => {
		return items.find((i) => i.slug === slug) ?? null;
	}),
	loadMarkdown: vi.fn().mockResolvedValue("# Hello"),
});
```

## パターン 2: renderer モック

core のテストでは renderer を必ずモック（`core` はゼロ依存なので import はダミー）:

```ts
vi.mock("@notion-headless-cms/renderer", () => ({
	renderMarkdown: vi.fn().mockResolvedValue("<p>rendered</p>"),
}));
```

## パターン 3: R2 fake bucket

`packages/cache-r2/src/__tests__/r2-cache.test.ts` を参考。`Map` ベースの fake:

```ts
const makeFakeBucket = () => {
	const store = new Map<string, { value: ArrayBuffer; meta?: Record<string, string> }>();
	return {
		async get(key: string) {
			const entry = store.get(key);
			if (!entry) return null;
			return {
				arrayBuffer: async () => entry.value,
				customMetadata: entry.meta,
			};
		},
		async put(key: string, value: ArrayBuffer, opts?: { customMetadata?: Record<string, string> }) {
			store.set(key, { value, meta: opts?.customMetadata });
		},
		async delete(key: string) {
			store.delete(key);
		},
		async list() {
			return { objects: [...store.keys()].map((key) => ({ key })), truncated: false };
		},
	};
};
```

## パターン 4: fetch モック

画像フェッチのテストでは `global.fetch` を置換:

```ts
const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
	new Response(new ArrayBuffer(8), { headers: { "content-type": "image/png" } }),
);
```

## パターン 5: fakeTimers

TTL / SWR のテストで時間を進める:

```ts
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("TTL 切れでキャッシュを更新する", () => {
	vi.setSystemTime(new Date("2024-01-01"));
	// ...
	vi.advanceTimersByTime(60_000);
});
```

## パターン 6: CMSError の検証

```ts
import { CMSError, isCMSError } from "../errors";

await expect(cms.list()).rejects.toSatisfy((err: unknown) =>
	isCMSError(err) && err.code === "source/fetch_items_failed"
);
```

## 避けるべき

- 実 Notion API の呼び出し（`NOTION_TOKEN` を使うテストは CI でスキップ）
- `console.log` 残し（Biome が警告）
- ファイル I/O（OS 非互換）。代わりに in-memory モックを使う
- `any` キャスト（`strict: true`）
