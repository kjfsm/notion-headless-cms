---
description: Biome と ES Modules を中心としたプロジェクト共通のコードスタイル
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.js"
  - "**/*.mjs"
  - "**/*.cjs"
---

# コードスタイル

Biome の設定（`biome.json`）に従う。

- **インデント**: スペース 2 幅
- **クォート**: ダブルクォート（`""`）
- **インポート**: Biome の `organizeImports` で自動整理（手動並び替え不要）
- **モジュール**: ES Modules（`import` / `export`）のみ。CommonJS (`require`) は使わない
- **型インポート**: `import type { ... }` を使い、`verbatimModuleSyntax: true` に揃える（`tsconfig.json`）
- **エラー処理**: `try { ... } catch (error) { ... }` の `error` は `unknown`（`useUnknownInCatchVariables: true`）
- **副作用**: 公開パッケージは `sideEffects: false`
- **コメント**: 日本語。コードで自明なことは書かない。WHY を書く
- **ファイル末尾**: 改行あり（Biome デフォルト）

`pnpm format` で書式を自動修正、`pnpm lint` で CI 相当の検証。
