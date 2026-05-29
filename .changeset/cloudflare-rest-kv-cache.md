---
"@notion-headless-cms/cloudflare": patch
---

KV プリウォーム用の公式ヘルパー `restKvCache()` と `readRestKvEnv()` を追加。`createClient({ cache: [restKvCache(readRestKvEnv())] })` のように使い、Node スクリプトから `cms.<collection>.cache.warm()` で Cloudflare KV を事前充填できる。`restKvCache` は既存の `restKvNamespace` と `kvCache` を合成したショートカット。`readRestKvEnv` は `CLOUDFLARE_ACCOUNT_ID` / `KV_NAMESPACE_ID` / `CLOUDFLARE_API_TOKEN` を検証し、不足時は `cloudflare/warm_env_missing` を投げる。
