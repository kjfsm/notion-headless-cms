---
"@notion-headless-cms/cli": patch
"@notion-headless-cms/notion-orm": patch
---

OGP 設定の追加と KV / R2 キャッシュファクトリを追加

- `nhc generate` 生成コードの `NhcConfig` に `ogp?: FetchBlockTreeOgpOptions` を追加。省略時は `{ enabled: true }` でデフォルト有効
- `notion-orm` に `createKvOgpCache(kv)` を追加 — Cloudflare KV で OGP メタデータ (JSON) を永続化
- `notion-orm` に `createR2OgpImageCache(bucket, imageProxyBase)` を追加 — Cloudflare R2 で OG 画像を永続化
- `KvOgpStore` / `R2OgpBucket` インターフェースを公開（Cloudflare Workers 型と構造互換）
