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
