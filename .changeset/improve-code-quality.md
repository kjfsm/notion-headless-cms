---
"@notion-headless-cms/core": patch
"@notion-headless-cms/cache-r2": patch
"@notion-headless-cms/cache-kv": patch
---

コード品質改善（正式リリース前）

- `BuiltInCMSErrorCode` を公開型として export し、IDE hover で各エラーコードの説明を参照できるようにした
- `withRetry()` の jitter=true コードパスのテストを追加
- `getItem()` 並行呼び出し時の一貫性テストを追加
- handler の PUT/DELETE/POST など未対応 HTTP メソッドへの応答テストを追加
- vitest coverage 閾値（lines/functions/branches: 80/80/70%）を設定
- `withRetry()`、`buildCacheImageFn()` に JSDoc を追加
- `loadDefaultRenderer` から不要な `export` を削除
- `cache-r2/r2-cache.ts` の冗長な `R2BucketLike` 再エクスポートを削除
- `@cloudflare/workers-types` の未使用 devDependency を削除
- 不要ファイル（`cache-r2/src/r2.ts`、`renderer/src/transformer/index.ts`）を削除
- vitest.workspace.ts から削除済みパッケージ（adapter-cloudflare、adapter-node）の参照を削除
- Knip を CI（lint ジョブ）に組み込み、未使用コード・依存を自動検出
- CONTRIBUTING.md を新規作成
