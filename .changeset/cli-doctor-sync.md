---
"@notion-headless-cms/cli": patch
---

`nhc doctor`（binding 宣言・webhook secret・token 有効性・同期状態・slug 重複の診断）と `nhc sync`（`v3.schemaModule` の全コレクションをローカルファイルストアへ同期する手動 kick）を CLI コマンドとして配線した。`v3/doctor.ts` の `runDoctorChecks` と `v3/sync-command.ts` の `runSyncCommand` は実装・テストが揃っていたが `nhc` から呼び出せない状態だった。

あわせて `runSyncCommand` の第一引数の型を `SyncCoordinatorCore`（具象クラス）から構造型 `SyncCommandCoordinator`（`kick`/`getState` のみ）に緩和し、`createCMS()` が返す `sync` オブジェクトをそのまま渡せるようにした。`resolveDataSourceId` は `check.ts`/`pull.ts`/`doctor.ts` の3箇所に重複していたため `commands/shared.ts` に集約した。
