---
"@notion-headless-cms/node": major
"@notion-headless-cms/cloudflare": major
"@notion-headless-cms/next": major
---

**破壊的変更**: 廃止予定だった `createCms` / `CreateCmsOptions` をメタパッケージから削除した。`createClient` + preset を直接使うか、新しい単一エントリ `@notion-headless-cms/client` の `createCMS` を使う。
