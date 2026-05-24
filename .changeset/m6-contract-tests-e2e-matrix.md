---
"@notion-headless-cms/testing": minor
---

`@notion-headless-cms/testing/contract` サブパスを新設し、`runCacheAdapterContract` / `runDataSourceContract` を export (Issue #317 / M6)。サードパーティ実装の品質保証パスとして利用できる。`vitest` は optional peerDependency として宣言。

加えて root `pnpm e2e:matrix` script と `.github/workflows/e2e-nightly.yml` (examples + apps/docs を target にした nightly matrix Playwright e2e) を追加、README に nightly バッジを掲載。
