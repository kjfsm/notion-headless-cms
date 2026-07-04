---
"@notion-headless-cms/react-renderer": patch
---

`PageLinkMap`・`ResolvedPageLink` 型を公開 API として export した。

- 両型は元々 `types.ts` で `export interface`/`export type` 済みだったが、トップレベルの
  export リストに含まれていなかった
- `toPageLinkMap()`（`react-renderer/v3`）の戻り値型が `PageLinkMap` のため、この値を
  自前のローダー関数の戻り値として扱うと、未 export のせいで `tsc -b`（`composite: true`）
  の宣言ファイル出力で「名前を付けられない型」エラーになっていた
