---
"@notion-headless-cms/cli": patch
---

`@notion-headless-cms/core` を `dependencies` から `peerDependencies`（`^0.3.0`）に移動した。生成スキーマファイルが core を import するためユーザーは core を必ずインストールする必要があり、CLI がバンドルを二重に抱えないようにするための変更。
