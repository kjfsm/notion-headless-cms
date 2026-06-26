---
"@notion-headless-cms/core": patch
---

ログメッセージに collection と slug を含め判別しやすくする

Cloudflare Workers のログ一覧で Message 列だけ見てもどのコレクション・スラッグの
処理かわからなかった問題を修正する。「リストキャッシュヒット」→「リストキャッシュヒット [posts]」
のように、メッセージ文字列に [collection] および slug を埋め込む。
