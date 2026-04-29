---
"@notion-headless-cms/cli": patch
---

`createCMS` の JSDoc @example に必須フィールド `renderer` / `blocks` を追記。

`NhcConfig.renderer` は必須フィールドだが例示コードから抜けており、
そのまま貼り付けると型エラーになっていた。
