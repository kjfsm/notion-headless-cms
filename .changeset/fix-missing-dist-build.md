---
"@notion-headless-cms/fetcher": patch
"@notion-headless-cms/renderer": patch
"@notion-headless-cms/transformer": patch
---

dist/ なしで publish されていた問題を修正。prepublishOnly スクリプトを追加し、常にビルド後に publish されるよう保証する。
