---
"@notion-headless-cms/cms": patch
---

`prop.*()` ビルダーの戻り値型（`TitlePropDef`・`RichTextPropDef`・`StatusPropDef` 等、全 16 種）を
公開 API として export した。

- 各型は元々 `types/property.ts` で `export interface` 済みだったが、トップレベルの
  export リストには汎用の `PropDef`/`PropertyMap` のみが含まれ、個別の型が漏れていた
- 未 export のため、`prop.title()` 等の呼び出しをそのまま `properties` に使うと、
  `tsc -b`（`composite: true`）の宣言ファイル出力で「名前を付けられない型」エラーになっていた
