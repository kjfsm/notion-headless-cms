---
description: 依存方向・core ゼロ依存・internal の扱い
paths:
  - "packages/**"
---

# パッケージ境界

## 依存方向（下が上を使う）

```
Notion DB
  └─ @notion-headless-cms/notion-orm（API 取得 + Notion→Markdown、private: true）
       ├─ @notion-headless-cms/renderer（Markdown→HTML）
       └─ @notion-headless-cms/core（CMS 統合・キャッシュ・クエリ・フック・nodePreset）
            ├─ @notion-headless-cms/cache-r2（r2Cache + cloudflarePreset）
            ├─ @notion-headless-cms/cache-kv
            ├─ @notion-headless-cms/cache-next
            └─ @notion-headless-cms/adapter-next（Next.js フロント連携）
```

## 重要なルール

- **`core` は外部ランタイム依存ゼロ**。`@notionhq/client` / `unified` / `zod` / `@notion-headless-cms/renderer` のいずれにも直接 `import` で依存しない
  - renderer は `CreateCMSOptions.renderer`（`RendererFn`）として注入する
  - フォールバックが必要な場合のみ動的 `import("@notion-headless-cms/renderer")` を使う
- **`internal/` は非公開**。`packages/*/src/internal/**` を他パッケージから参照してはならない
  - 現状 `notion-orm` の `internal/fetcher/` と `internal/transformer/` が該当
- **`notion-orm` は `private: true`**。user は直接 import しない。CLI 生成物 (`nhc-schema.ts`) が唯一の消費者
- **`peerDependencies`** は利用側でインストールしてもらう。パッケージ間依存は `workspace:*`
- **公開パッケージ**（npm 公開されるもの）は `exports` サブパスを明示し、`dist/` 以外を公開しない（`files: ["dist"]`）
- **パッケージ名の namespace**: すべて `@notion-headless-cms/` スコープ

## ランタイム preset の配置

- **Node.js**: `nodePreset` は `core` に相乗り。`memoryDocumentCache` + `memoryImageCache` を既定で有効化
- **Cloudflare Workers**: `cloudflarePreset` は `cache-r2` に相乗り (`cache-kv` を `dependencies` として同梱)。env binding (`DOC_CACHE` / `IMG_BUCKET`) を解決

## 廃止されたパッケージ (v0.3.0)

- `@notion-headless-cms/adapter-node` → `nodePreset()` (core)
- `@notion-headless-cms/adapter-cloudflare` → `cloudflarePreset({ env })` (cache-r2)

## `adapter-*` の定義

v0.3.0 以降、`adapter-*` は**フレームワーク固有のグルー**（route handler / integration プラグイン）を意味する。ランタイム抽象には使わない。現行は `adapter-next` のみ。

## 違反パターンと修正例

### 1. core から `@notion-headless-cms/renderer` を import してしまった

違反:
```ts
// packages/core/src/cms.ts
import { renderMarkdown } from "@notion-headless-cms/renderer";
```

修正: `RendererFn` として注入

```ts
// packages/core/src/types/config.ts
export type RendererFn = (md: string, options?: RenderOptions) => Promise<string>;

// packages/core/src/cms.ts
export class CMS {
	constructor(private readonly options: CreateCMSOptions) {}
	async render(item: BaseContentItem) {
		const renderer = this.options.renderer ?? (await this.defaultRenderer());
		return renderer(markdown);
	}
	private async defaultRenderer(): Promise<RendererFn> {
		// 動的 import ならゼロ依存ルールを守れる
		const mod = await import("@notion-headless-cms/renderer");
		return mod.renderMarkdown;
	}
}
```

### 2. core から zod を使いたい

違反:
```ts
import { z } from "zod";
```

修正: バリデーションは `notion-orm` 側（zod が peerDep）に置く。core は型のみ扱う。

### 3. core から `@notionhq/client` を使いたい

違反:
```ts
import { Client } from "@notionhq/client";
```

修正: `DataSourceAdapter` インターフェースを core が定義し、実装は `notion-orm` に置く。

### 4. adapter-* や cache-* から他パッケージの `internal/` を import

違反: `internal/` は公開されていない API

修正: 公開 API を `src/index.ts` で re-export する。どうしても必要な型は core に移動する。

### 5. cache-* から adapter-* の型を import

違反: 依存方向の逆転

```ts
import type { AdapterNextEnv } from "@notion-headless-cms/adapter-next";
```

修正: 型を core 側に置くか、cache-* 側で独自定義する。

## 検出コマンド

```bash
# core に禁止 import が混入していないか
grep -rE 'from ["'"'"'](@notionhq/client|unified|remark-|rehype-|zod|@notion-headless-cms/renderer)["'"'"']' packages/core/src/

# 期待: hit なし（動的 import は grep に掛からない）
```

PreToolUse hook (`.claude/hooks/block-core-forbidden-imports.sh`) が同じ検出を行うため、通常はコミット前に弾かれる。
