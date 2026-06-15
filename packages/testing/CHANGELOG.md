# @notion-headless-cms/testing

## 0.3.4

### Patch Changes

- Updated dependencies [919ec7c]
  - @notion-headless-cms/core@0.5.4

## 0.3.3

### Patch Changes

- Updated dependencies [85a7cb6]
  - @notion-headless-cms/core@0.5.3

## 0.3.2

### Patch Changes

- Updated dependencies [a2016b5]
  - @notion-headless-cms/core@0.5.2

## 0.3.1

### Patch Changes

- Updated dependencies [86585a7]
  - @notion-headless-cms/core@0.5.1

## 0.3.0

### Minor Changes

- 8005ace: `@notion-headless-cms/testing/contract` サブパスを新設し、`runCacheAdapterContract` / `runDataSourceContract` を export (Issue #317 / M6)。サードパーティ実装の品質保証パスとして利用できる。`vitest` は optional peerDependency として宣言。

  加えて root `pnpm e2e:matrix` script と `.github/workflows/e2e-nightly.yml` (examples + apps/docs を target にした nightly matrix Playwright e2e) を追加、README に nightly バッジを掲載。

### Patch Changes

- Updated dependencies [6478628]
- Updated dependencies [e9698a3]
- Updated dependencies [054e3d6]
- Updated dependencies [12ddf52]
- Updated dependencies [f7f0493]
- Updated dependencies [4183d36]
- Updated dependencies [3f8bd02]
- Updated dependencies [355f3e1]
- Updated dependencies [6e1cec6]
  - @notion-headless-cms/core@0.5.0

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
