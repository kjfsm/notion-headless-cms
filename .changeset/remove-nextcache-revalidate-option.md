---
"@notion-headless-cms/cache": patch
---

`NextCacheOptions` から未実装の `revalidate` フィールドを削除。

このオプションは定義されていたが `nextCache()` の実装で一度も参照されておらず、
ページレベルの `export const revalidate` と混同しやすかった。
