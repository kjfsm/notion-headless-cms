---
"@notion-headless-cms/cli": patch
---

生成コードの NhcConfig.renderer を必須フィールドに修正（`renderer?: RendererFn` → `renderer: RendererFn`）。`_createCMS` が renderer を必須で要求するため、省略可能のままだと型エラーが発生していた。
