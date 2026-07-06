---
"@notion-headless-cms/cms": patch
"@notion-headless-cms/cli": patch
"@notion-headless-cms/react-renderer": patch
---

コード品質監査(#480)で検出した同期・整合性・型安全性まわりの問題をまとめて修正した。

**cms**

- `reconcile()` が `runChunk()` の再入防止ガードを経由せず、マニフェストの read-modify-write が並行実行時に競合し得た問題を修正（両者を同じキューで直列化）
- マルチソース cursor の `JSON.parse` が破損値で永久に失敗し続ける問題を修正（先頭から同期をやり直すフォールバックを追加）
- `SyncState.failures` が無限に増え続ける問題を修正（直近 N 件のリングバッファに変更）
- `coldStart` 経由の読者パス書き込みを構造化ログで可視化
- index/entry 不整合を検知したら警告ログを出すよう変更
- `DocStore`(KV) の整合性コメントを結果整合の実態に合わせて修正
- レートリミッタが実効「同時実行 1」になっていた問題を修正（発行間隔の計算とタスク実行を分離）
- 画像 fetch の失敗レスポンス(404/403 等)を保存前に `r.ok` でチェックするよう修正
- realtime publish の失敗が同期全体の失敗として扱われる問題を修正
- `durableObjectSyncDelegate` が DO の失敗ステータスを検査せず握りつぶす問題を修正
- `buildPageIndex` が entry 同期ごとに全マニフェストを再読込する問題を修正（書き込みがあった時だけ無効化するキャッシュを追加）
- `memoryBlobStore` が内部の `Uint8Array` 参照を共有していた問題を修正
- `cache` 未指定時に `versionedCache` を結線しないよう変更（読者パスの無駄なコストを削減）
- `list()` の実行時パラメータに最低限の形状検証を追加

**cli**

- エラーハンドラの `process.exit(1)` によるパイプ出力の切り捨てを修正(`process.exitCode` に統一)
- `nhc doctor` の binding 検出がコメントアウトされた宣言を誤検出する問題を修正

**react-renderer**

- Notion 公式型に無い拡張フィールド(`__cachedHtml`/`_dimensions`/`ogp`)の型定義を1箇所に集約
- `<ol>` の list-style ローテーションが toggle/callout 等の非リストコンテナ経由のネストでも進んでしまう問題を修正
