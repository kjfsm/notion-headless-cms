---
"@notion-headless-cms/core": patch
"@notion-headless-cms/source-notion": patch
"@notion-headless-cms/renderer": patch
"@notion-headless-cms/cache-r2": patch
"@notion-headless-cms/cache-next": patch
"@notion-headless-cms/adapter-cloudflare": patch
"@notion-headless-cms/adapter-node": patch
"@notion-headless-cms/adapter-next": patch
"@notion-headless-cms/cli": patch
---

`package.json` の `exports` で `types` を先頭に移動して TypeScript の型解決を確実にする。

publint が `types should be the first in the object as conditions are order-sensitive` を報告していたため、全公開パッケージで `exports[*]` のキー順を `types` → `import` に修正した。動作は同じだが TypeScript の resolution で型ファイルが確実に先に解決される。
