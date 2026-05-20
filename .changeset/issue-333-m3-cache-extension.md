---
"@notion-headless-cms/core": patch
---

M3: キャッシュ層拡張ポイントの整理 (Issue #333)

- `CacheAdapter` / `DocumentCacheOps` / `ImageCacheOps` の JSDoc を強化
  - `handles` 判定の先勝ちルールを明文化
  - `cms.cacheImage` (= `RenderContext.cacheImage`) と `ImageCacheOps` の責務境界を明示 (adapter から `cacheImage` を呼ばないこと)
  - エラー処理・並列書き込み・fail-soft のガイドラインを追加
- `docs/ja/recipes/custom-cache.md` に `createFakeCache()` を使ったユニットテストの章を追加し、`handles` 判定と画像プロキシ責務境界の節を追記
