---
description: 依存方向・internal の扱い
paths:
  - "packages/**"
---

# パッケージ境界

## 依存方向（下が上を使う）

```
@notion-headless-cms/cms（Notion アクセス・同期・ストレージ・HTTP 配信を1パッケージに統合）
  ├─ @notion-headless-cms/react-renderer（BlockObjectResponse→React、shadcn/ui + Tailwind v4）
  └─ @notion-headless-cms/cli（nhc pull/check/doctor/sync/init）
```

- `packages/cms` は他の workspace パッケージに依存しない独立パッケージ（`dependencies` にワークスペース内パッケージを持たない。peerDependencies は `@notionhq/client` / `katex` / `shiki` / `vitest` のみ）。詳細: `.claude/rules/cms.md`
- `react-renderer` / `cli` はいずれも `@notion-headless-cms/cms`（`workspace:*`）にのみ依存する

## 重要なルール

- **`internal/` は非公開**。`packages/*/src/internal/**` を他パッケージから参照してはならない
  - 現状 `react-renderer` の `src/internal/` が該当
- **`peerDependencies`** は利用側でインストールしてもらう。パッケージ間依存は `workspace:*`
- **公開パッケージ**（npm 公開されるもの）は `exports` サブパスを明示し、`dist/` 以外を公開しない（`files: ["dist"]`）
- **パッケージ名の namespace**: すべて `@notion-headless-cms/` スコープ

## 違反パターンと修正例

### 他パッケージの `internal/` を import

違反: `internal/` は公開されていない API

修正: 公開 API を `src/index.ts` で re-export する。

### 依存方向の逆転（`cms` が上位パッケージの型を import する）

違反:
```ts
import type { SomeType } from "@notion-headless-cms/react-renderer";
```

修正: 型を `cms` 側に置くか、各パッケージで独自定義する。
