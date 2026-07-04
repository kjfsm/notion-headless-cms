---
"@notion-headless-cms/cms": patch
---

`find()`/`list()` が読者リクエストのたびに KV の `list()`(プレフィックススキャン)を発行していたのを廃止した。KV の `list()` は無料枠 1,000 回/日という別枠クォータを持ち、読者トラフィックがそのまま枯渇に直結していた(実際に本番サイトで発生した障害の原因)。

`IndexStore` の内部実装を、点読みキー(`entry-index:{collection}:{slug}`、`find()` 用)と一覧マニフェストキー(`list-index:{collection}`、`list()` 用)の 2 種類の KV キーに分離し、`DocStore` から `list()` メソッド自体を削除した。点読みキーは version が変わるたび(内容編集を含む)に更新し、マニフェストキーは `meta`/`listed` が実際に変わった時だけ更新することで、頻繁な内容編集がある場合でも KV の書き込みクォータ(1,000 回/日)に収まる設計にした。

`createCMS()` の公開オプション(`stores`/`schema` 等)に変更は無い。

**移行に関する注意**: KV のキー形式が変わる(`index:{collection}:{page}` → `entry-index:{collection}:{slug}` + `list-index:{collection}`)ため、旧形式のデータしか無い環境にこのバージョンをデプロイした直後は index が空になる。`sync.reconcile()` は削除検知のみを行い新規・更新分を取り込まないため、デプロイ後は `sync.kick()`(または Notion webhook の着火)を明示的に実行して新形式へ再構築すること。
