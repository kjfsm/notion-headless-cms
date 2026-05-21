# @notion-headless-cms/testing

## 0.2.0

### Minor Changes

- c55a06a: DX とドキュメント差分の解消 (Issue #332)

  - **core**: 組み込みエラーコード 27 種類すべてに `docsUrl` (docs/ja/errors/index.md へのアンカー) と `nextSteps` の既定値を `CMSError` コンストラクタで自動補完するように。呼び出し側で明示指定した値は引き続き優先される
  - **cli**: `nhc generate` / `nhc init` に `--verbose` / `--debug` フラグを追加。verbose 時は CMSError の `nextSteps` / `docsUrl` を、debug 時はスタックトレースと cause を出力。help に「よくある詰まり所」セクションを追加し、進捗表示も拡充
  - **testing**: 新規パッケージ `@notion-headless-cms/testing` を公開。`createFakeNotionSource({ items })` / `createFakeCache()` / `createFixtureClient(opts)` / `fakeRenderer` を提供。`@notion-headless-cms/core` 以外への依存ゼロ

### Patch Changes

- Updated dependencies [c55a06a]
- Updated dependencies [8e73f8e]
- Updated dependencies [64b7d32]
- Updated dependencies [ac2c402]
  - @notion-headless-cms/core@0.4.0
