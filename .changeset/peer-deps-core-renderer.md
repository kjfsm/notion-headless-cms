---
"@notion-headless-cms/adapter-next": patch
"@notion-headless-cms/cache": patch
"@notion-headless-cms/notion-orm": patch
---

`@notion-headless-cms/core`（および `notion-orm` では `@notion-headless-cms/renderer`）を `dependencies` から `peerDependencies` に移動した。利用側は必ずこれらをインストールするため、ライブラリ側で二重バンドルしないようにするための変更。
