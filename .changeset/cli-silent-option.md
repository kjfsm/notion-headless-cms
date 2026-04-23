---
"@notion-headless-cms/cli": patch
---

`nhc init` / `nhc generate` に `-s, --silent` オプションを追加。CI やスクリプトから呼び出す際に stdout ログを抑制できる。エラーは `--silent` でも stderr に出力される。
