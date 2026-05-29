---
description: 依存方向・core ゼロ依存・internal の扱い
paths:
  - "packages/**"
---

# パッケージ境界

## 依存方向（下が上を使う）

```
Notion DB
  └─ @notion-headless-cms/notion-orm（API 取得 + Notion→Markdown + fetchBlockTree、ユーザーは直接 import しない）
       ├─ @notion-headless-cms/fetch-blocks（BlockObjectResponse ツリー取得 + React Renderer）
       ├─ @notion-headless-cms/fetch-markdown（Notion Markdown API で本文取得）
       ├─ @notion-headless-cms/markdown-html（Markdown→HTML）
       ├─ @notion-headless-cms/react-renderer（BlockObjectResponse→React、shadcn/ui + Tailwind v4）
       ├─ @notion-headless-cms/notion-source（CMSAdapter 実装）
       └─ @notion-headless-cms/core（CMS 統合・キャッシュ・クエリ・フック・nodePreset）
            └─ @notion-headless-cms/cache（memory + サブパス /cloudflare（r2Cache/kvCache/cloudflarePreset）/next）

メタパッケージ: @notion-headless-cms/{node,cloudflare,next}
```

## 重要なルール

- **`core` は外部ランタイム依存ゼロ**。`@notionhq/client` / `unified` / `zod` / `@notion-headless-cms/markdown-html` のいずれにも直接 `import` で依存しない
  - renderer は `CreateClientOptions.renderer`（`RendererFn`）として注入する
  - フォールバックが必要な場合のみ動的 `import("@notion-headless-cms/markdown-html")` を使う
- **`internal/` は非公開**。`packages/*/src/internal/**` を他パッケージから参照してはならない
  - 現状 `notion-orm` の `internal/fetcher/` と `internal/transformer/` が該当
- **`notion-orm` は npm に公開するがユーザーは直接 import しない**。CLI 生成物 (`nhc-schema.ts`) が唯一の消費者。利用側は `pnpm add` で依存に入れるだけでよい（生成物が解決時に必要になる）
- **`peerDependencies`** は利用側でインストールしてもらう。パッケージ間依存は `workspace:*`
- **公開パッケージ**（npm 公開されるもの）は `exports` サブパスを明示し、`dist/` 以外を公開しない（`files: ["dist"]`）
- **パッケージ名の namespace**: すべて `@notion-headless-cms/` スコープ

## ランタイム preset の配置

- **Node.js**: `nodePreset` は `core` に相乗り。`memoryDocumentCache` + `memoryImageCache` を既定で有効化
- **Cloudflare Workers**: `cloudflarePreset` は `@notion-headless-cms/cache`（`/cloudflare` サブパス）に相乗り。env binding (`DOC_CACHE` / `IMG_BUCKET`) を解決

## 廃止されたパッケージ (v0.3.0)

- `@notion-headless-cms/adapter-node` → `nodePreset()` (core)
- `@notion-headless-cms/adapter-cloudflare` → `cloudflarePreset({ env })`（cache の /cloudflare サブパス）

## フレームワークグルーの定義

フレームワーク固有のグルー（route handler / integration プラグイン）は各メタパッケージに同梱する。現行は `@notion-headless-cms/next`（`createNextHandler` / `createNextWebhookHandler`）。

## 違反パターンと修正例

### 1. core から `@notion-headless-cms/markdown-html` を import してしまった

違反:
```ts
// packages/core/src/cms.ts
import { renderMarkdown } from "@notion-headless-cms/markdown-html";
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
		const mod = await import("@notion-headless-cms/markdown-html");
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

### 4. 他パッケージの `internal/` を import

違反: `internal/` は公開されていない API

修正: 公開 API を `src/index.ts` で re-export する。どうしても必要な型は core に移動する。

### 5. cache や next から上位パッケージの型を import

違反: 依存方向の逆転

```ts
import type { NextEnv } from "@notion-headless-cms/next";
```

修正: 型を core 側に置くか、各パッケージで独自定義する。

## 検出コマンド

```bash
# core に禁止 import が混入していないか
grep -rE 'from ["'"'"'](@notionhq/client|unified|remark-|rehype-|zod|@notion-headless-cms/markdown-html)["'"'"']' packages/core/src/

# 期待: hit なし（動的 import は grep に掛からない）
```

PreToolUse hook (`.claude/hooks/block-core-forbidden-imports.sh`) が同じ検出を行うため、通常はコミット前に弾かれる。
