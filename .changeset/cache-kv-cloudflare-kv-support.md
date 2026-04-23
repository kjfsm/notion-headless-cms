---
"@notion-headless-cms/cache-kv": patch
"@notion-headless-cms/adapter-cloudflare": patch
---

Cloudflare KV を使うドキュメントキャッシュ（`@notion-headless-cms/cache-kv`）を新規追加。
`adapter-cloudflare` は `CACHE_KV` バインディングでテキスト（JSON）を KV に、`CACHE_BUCKET` バインディングで画像を R2 にキャッシュするように変更。
