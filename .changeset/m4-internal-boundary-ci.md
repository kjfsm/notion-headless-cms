---
"@notion-headless-cms/core": patch
---

`scripts/check-internal-boundary.mjs` を追加し、`packages/*/src/internal/**` への外部 import を CI で禁止 (Issue #315 / M4)。`pnpm lint:boundary` として実行可能、`ci.yml` の lint job に組み込み済み。
