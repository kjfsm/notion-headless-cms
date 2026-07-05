---
"@notion-headless-cms/cms": patch
---

同期時の KV write を日次で計測し、無料枠（1日1000 write）のソフト上限接近を警告できるようにした。

- `IndexStore.upsertEntry`/`removeEntry` が発行した KV write 操作数（`writes`: 0/1/2）を返すようになった（`wrote` は互換のため併存）。
- `SyncCoordinatorCore` が当日ぶんの KV write を集計して `SyncState.writeBudget`（DO storage 保存、KV は消費しない）に記録し、UTC 日付で 0 リセットする。
- `createCMS({ sync: { dailyWriteBudget, writeBudgetWarnRatio } })`（既定 1000 / 0.8）でソフト上限を設定でき、超過を跨いだ時に `logger.warn` を一度だけ出す。
- `stats()`（`GET /stats`）の戻り値に `writeBudget` を追加し、当日 write 数を観測可能にした。
