---
"@notion-headless-cms/core": patch
---

`list()` に `force` オプションを追加した。

`find(slug, { force })` にはキャッシュを無視して Notion を即座に実照会する手段があったが、`list()` には対応するオプションが無く、明示リロード（F5）時でも SWR キャッシュがヒットしていればその場では最新化できなかった（バックグラウンドの差分チェックは次回以降のリクエストにしか反映されない）。

`list({ force: true })` でキャッシュを読まずブロッキングで Notion から一覧を再取得し、結果でキャッシュを上書きするようにした。`isReloadRequest(request)` と組み合わせて `cms.posts.list({ force: isReloadRequest(request) })` のように使う。
