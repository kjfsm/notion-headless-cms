---
"@notion-headless-cms/core": patch
---

更新・更新検知ライフサイクルのログを整備した。

- webhook 受信で page 更新を検知した時点を `info`（`webhook: Notion 更新を検知`）で記録
- SWR 裏チェックで Notion と突合した「確認」を `debug`（`swr: ミラーを確認 (find/list)`）で記録
- SWR 差分検出によるミラー更新を `debug`→`info` に昇格（`swr: ミラーを更新 (find/list)`）
- realtime publish 成功を `debug`（`realtime: 更新を通知`）で記録

これにより `logLevel: "info"` で「更新を検知/ミラーを更新」の節目だけ、`"debug"` で
突合・通知の詳細まで追えるようになる。
