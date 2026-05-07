---
"@notion-headless-cms/core": patch
"@notion-headless-cms/notion-source": patch
"@notion-headless-cms/cli": patch
---

`cms.<collection>.list()` の戻り値型を CLI 生成の `XxxItem` interface と互換にする。

- `PropertyDef` に optional な `options?: readonly string[]` を追加。型レベルで literal union を導出するためのメタ情報で、runtime では参照しない。
- `notion-source` の型導出を `TSTypeForPropDef<P>` に変更し、`P["options"]` が存在する status カラムを literal union に narrow する。
- CLI が status カラムの選択肢を `options: ["..."] as const` として `*Properties` に出力するよう変更。

利用側は `nhc generate` を再実行すること。再生成後は CLI が出力する `XxxItem` interface（例: `FixedPage`）をそのまま `cms.fixedPages.list()` の戻り値型として使えるようになる。
