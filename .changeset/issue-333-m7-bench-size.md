---
"@notion-headless-cms/core": patch
---

M7: ベンチマークと bundle size 計測の土台を整備 (Issue #333)

- `.size-limit.json` を現行パッケージ構成 (core / markdown-html / cache / cache-cloudflare / validate) に合わせて更新。廃止された `renderer` / `adapter-next` / `notion-embed` エントリを削除
- `pnpm size` が正常終了する状態に (next の `@opentelemetry/api` 解決問題を避けるため、`next` 経由のエントリは現状除外)
- `@notion-headless-cms/core` に `bench` スクリプト (`vitest bench --run`) を追加
- `packages/core/src/__tests__/cache.bench.ts` を新規追加。最低限の SWR list/find と `stats()` 集計の回帰検知をカバー
- 上記により `pnpm size` / `pnpm --filter @notion-headless-cms/core bench` を CI から呼び出せるようになった
