---
"@notion-headless-cms/core": patch
---

CI verify gate に `pnpm size` (size-limit) を追加し、`publish-dry-run-nightly.yml` で `publint` / `attw` / `size` / `pnpm publish --dry-run` を main の任意時点で毎日検証する (Issue #318 / M7)。`docs/ja/release/meta-package-bump.md` を新設し、changesets の連鎖 bump とレビュー観点を明文化。
