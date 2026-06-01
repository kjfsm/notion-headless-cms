---
"@notion-headless-cms/client": minor
---

新パッケージ `@notion-headless-cms/client` を追加。v2 使い勝手再設計（RFC: `docs/ja/rfc/v2-usability-redesign.md`）の最初の実装で、`createClient` + `notionSource` + preset の合成を単一エントリ `createCMS` に集約する。

- **責務分割**: DB 構造は `schema`（生成物）、token / content / 公開ポリシー / ランタイムは `createCMS` の引数に集約（二重定義の解消）
- **content モード**: `"html"` / `"react"` の単一決定で取得戦略（markdownFetcher / blocksFetcher）と renderer を内部結線し、戦略と renderer の不整合フットガンを排除
- **型分岐**: content モードに応じてアイテム本文アクセサを切り替え（`"html"` は `html()`/`markdown()`、`"react"` は `notionBlocks()`）。`notionBlocks()` の `undefined` フットガンを型で排除
- **runtime フィールド**: `nodePreset()` / `cloudflarePreset({ env, ctx })` / `nextPreset()` の戻り値をそのまま渡せる。省略時は node 既定
