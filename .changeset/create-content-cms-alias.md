---
"@notion-headless-cms/cms": patch
---

`createCMS`（v3）の別名 `createContentCMS`（と型エイリアス `CreateContentCMSOptions`）を追加した。`@notion-headless-cms/client`（v2）にも引数・戻り値が別物の同名 `createCMS` が存在し import 元を取り違えやすい footgun だったため、明示的に区別したい利用者向けの選択肢を用意する。既定の `createCMS` は変更しない（非破壊的な追加のみ）。

あわせて README のクイックスタート（v2）と「完全マテリアライズド方式で動かす (v3)」節の双方に、`createCMS` が2パッケージに同名で存在し互換性が無い旨の注記を追加した。
