---
"@notion-headless-cms/cache": patch
---

`@notion-headless-cms/cache/cloudflare` から `cloudflarePreset({ env, ctx })` を追加。`createClient` に展開するだけで KV/R2 キャッシュと `waitUntil` を一括で注入できる。`ctx.waitUntil` を渡すことで SWR のバックグラウンド更新が Cloudflare Workers のレスポンス送信後も完走し、Notion 側の更新が KV キャッシュに確実に反映されるようになる。
