---
"@notion-headless-cms/cms": patch
---

Cloudflare 無料枠の KV/R2 予算を守るため、同期・配信経路のストア操作を削減する

- 同期時に listChanged が読んだ index 点キーを `upsertEntry` に引き回し、同一キーの KV 二重読みを解消（`IndexStore.upsertEntry` に省略可能な `knownExisting` 引数を追加）
- 画像 put 時に寸法を R2 customMetadata へ保存し、既存画像の同期では本体ダウンロード（R2 Class B + 帯域）を省略（保存前の既存画像は従来どおり本体から再計算）
- 画像 fetch に Notion API と同じ指数バックオフを適用し、一過性の 429/5xx をリトライ。上限まで失敗した場合は `CMSError("sync/image_fetch_failed")` を投げて fail-soft に委ねる
- 画像配信を `BlobStore.getWithMetadata`（新設・省略可能）による 1 回の読み取りに変更し、R2 の get+head 2 オペレーションを 1 回に削減（未実装ストアは従来どおり get+head にフォールバック）
