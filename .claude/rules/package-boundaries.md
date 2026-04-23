---
description: 依存方向・core ゼロ依存・internal の扱い
paths:
  - "packages/**"
---

# パッケージ境界

## 依存方向（下が上を使う）

```
Notion DB
  └─ @notion-headless-cms/source-notion（API 取得 + Notion→Markdown）
       ├─ @notion-headless-cms/renderer（Markdown→HTML）
       └─ @notion-headless-cms/core（CMS 統合・キャッシュ・クエリ・フック）
            ├─ @notion-headless-cms/cache-r2
            ├─ @notion-headless-cms/cache-next
            ├─ @notion-headless-cms/adapter-cloudflare
            ├─ @notion-headless-cms/adapter-node
            └─ @notion-headless-cms/adapter-next
```

## 重要なルール

- **`core` は外部ランタイム依存ゼロ**。`@notionhq/client` / `unified` / `zod` / `@notion-headless-cms/renderer` のいずれにも直接 `import` で依存しない
  - renderer は `CreateCMSOptions.renderer`（`RendererFn`）として注入する
  - フォールバックが必要な場合のみ動的 `import("@notion-headless-cms/renderer")` を使う
- **`internal/` は非公開**。`packages/*/src/internal/**` を他パッケージから参照してはならない
  - 現状 `source-notion` の `internal/fetcher/` と `internal/transformer/` が該当
- **`peerDependencies`** は利用側でインストールしてもらう。パッケージ間依存は `workspace:*`
- **公開パッケージ**（npm 公開されるもの）は `exports` サブパスを明示し、`dist/` 以外を公開しない（`files: ["dist"]`）
- **パッケージ名の namespace**: すべて `@notion-headless-cms/` スコープ
