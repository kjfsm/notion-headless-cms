---
name: package-boundaries
description: core ゼロ依存ルールを侵す実装の検出と修正例。packages/core を触る時に自動で呼ばれる
---

# package-boundaries — 依存境界と修正例

## ルール

詳細は `.claude/rules/package-boundaries.md` と `.claude/rules/core.md` を参照。

ここでは**違反検出時の修正パターン**のみをまとめる。

## 違反パターンと修正例

### 1. core から `@notion-headless-cms/renderer` を import してしまった

❌ 違反:
```ts
// packages/core/src/cms.ts
import { renderMarkdown } from "@notion-headless-cms/renderer";
```

✅ 修正: `RendererFn` として注入

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

❌ 違反:
```ts
import { z } from "zod";
```

✅ 修正: バリデーションは `source-notion` 側（zod が peerDep）に置く。core は型のみ扱う

### 3. core から `@notionhq/client` を使いたい

❌ 違反:
```ts
import { Client } from "@notionhq/client";
```

✅ 修正: `DataSourceAdapter` インターフェースを core が定義し、実装は `source-notion` に置く

### 4. adapter-* から core の `internal/` を import

❌ 違反: そもそも core に `internal/` は公開されていないが、もし将来 `packages/core/src/internal/` を作った場合

✅ 修正: 公開 API を `src/index.ts` で export する

### 5. source-notion から adapter-* の型を import

❌ 違反: 依存方向逆転
```ts
// packages/source-notion/src/...
import type { CloudflareCMSEnv } from "@notion-headless-cms/adapter-cloudflare";
```

✅ 修正: 型を core 側に置くか、source-notion 側で独自定義する

## 検出コマンド

```bash
# core に禁止 import が混入していないか
grep -rE 'from ["'"'"'](@notionhq/client|unified|remark-|rehype-|zod|@notion-headless-cms/renderer)["'"'"']' packages/core/src/

# 期待: hit なし（動的 import は grep に掛からない）
```

Pre-commit hook (`.claude/hooks/block-core-forbidden-imports.sh`) が同じ検出を行うため、通常はコミット前に弾かれる。
