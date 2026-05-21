---
"@notion-headless-cms/core": patch
---

M2: 可観測性の最小セットを追加 (Issue #333)

- `LogContext` に `traceId` / `backoffMs` を追加
- `createClient` がクライアント単位の `traceId` を発行し、`withTraceId` で全ログコンテキストに自動付与する (ネスト操作・SWR・retry 経由でも同じ ID が流れる)
- `cms.traceId` を `CMSGlobalOps` に公開
- `mergeLoggers` の plugin / direct logger 合成を明文化 (`cms.ts` 内で `withTraceId` を後段に挟む構成へ更新)
- `RetryConfig.onRetry` のシグネチャに `delayMs` を追加し、ジッター反映後の実際の待機時間を `LogContext.backoffMs` として出せる
- `CacheAdapter.stats?(): Promise<CacheAdapterStats>` を optional として追加
- `cms.stats(): Promise<CMSStats>` を新設。doc/img それぞれヒット率・エントリ数・(画像のみ) 合計バイトを返す
- `memoryCache()` が hit/miss/entries/sizeBytes を集計するように
- `LogContext` / `CacheAdapterStats` / `CacheAreaStats` を index から re-export
