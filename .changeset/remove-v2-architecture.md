---
"@notion-headless-cms/cms": major
"@notion-headless-cms/react-renderer": major
"@notion-headless-cms/cli": major
---

v2 アーキテクチャ（`@notion-headless-cms/client`・`core`・`cache`・`notion-source`・`notion-orm`・`fetch-blocks`・`fetch-markdown`・`markdown-html`・`block-html`・`notion-katex`・`notion-shiki`・`testing`・`validate` の13パッケージ）を削除し、`@notion-headless-cms/cms` に一本化した。v2/v3 の2アーキテクチャ並存が最大の固定費になっていたための決断（詳細: `docs/_internal/dev-improvements-proposal.md` の L1）。移行ガイドは `docs/ja/migration/v2-removal.md` を参照。

破壊的変更:

- **`@notion-headless-cms/react-renderer`**: `./v3` サブパスを `./cms` に改名した（`denormalizeBlocks`/`toPageLinkMap` の import 元を `@notion-headless-cms/react-renderer/v3` から `@notion-headless-cms/react-renderer/cms` に変更する必要がある）。
- **`@notion-headless-cms/cli`**: `nhc generate` コマンドと `nhc init --template` フラグを削除した（`nhc init` は常に `@notion-headless-cms/cms` 向けの雛形一式を生成する）。`nhc.config.ts` の型 `CMSConfig` から `output`/`v3` ラッパーキーを廃止し、`scaffoldDir`/`schemaModule`/`collections` をトップレベルのフィールドにフラット化した。既存の `nhc.config.ts` は `v3: { schemaModule, collections }` の中身をトップレベルへ展開する必要がある。
- **`@notion-headless-cms/cms`**: 未リリースの `createContentCMS`（`createCMS` の別名）を削除した。`@notion-headless-cms/client` との命名衝突を避けるためだけに用意していたが、v2 削除により衝突の可能性が無くなったため撤回する。既定の `createCMS` に変更は無い。
