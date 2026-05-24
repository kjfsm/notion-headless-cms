---
"@notion-headless-cms/core": minor
"@notion-headless-cms/cache": minor
"@notion-headless-cms/next": minor
---

`nodePreset` / `cloudflarePreset` / `nextPreset` のシグネチャを `{ cache, swr, ...(waitUntil) }` 共通契約に対称化 (Issue #313 / M2)。

- `cloudflarePreset` に `swr` を追加 (デフォルト ttlMs 5 分)、新 `opts.swr` で上書き可能
- `nextPreset` を新規実装 (`packages/next`、`{ cache: [memoryCache()], swr: { ttlMs: 5*60_000 } }`)
- `DEFAULT_RATE_LIMITER` 定数を core から export し、`RateLimiterConfig` のデフォルト値 (`maxConcurrent: 3`, `retryOn: [429, 502, 503]`, `maxRetries: 4`, `baseDelayMs: 1000`) を IDE 補完可能にした
