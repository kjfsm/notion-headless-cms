---
"@notion-headless-cms/node": patch
"@notion-headless-cms/cloudflare": patch
"@notion-headless-cms/next": patch
---

各ランタイムパッケージの `createCms` / `CreateCmsOptions` に `@deprecated` (v1.0.0 で削除予定) を付与し、`createClient + notionSource + ランタイム preset` を直接呼ぶ推奨例を JSDoc と `docs/ja/migration/createCms-to-createClient.md` に追加 (Issue #312 / M1)。内部実装は `createClient` の薄い shim のまま、挙動互換。
