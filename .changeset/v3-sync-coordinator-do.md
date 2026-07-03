---
"@notion-headless-cms/cms": patch
---

Cloudflare Durable Object として実際に `wrangler.toml` から binding できる
`SyncCoordinatorDO`/`RealtimeHubDO` を追加した（S6/#443 で未実装だった「DO クラスを
export する規約」の実施）。

- `RealtimeHubDO`（`@notion-headless-cms/cms/cloudflare`）: v2 の `RealtimeHubDO` を移植。
  WebSocket Hibernation で購読を受理し、`durableObjectRealtime()` からの broadcast を
  channel tag 別に配信する
- `createSyncCoordinatorDO()`: 利用者提供の `createCMS(state, env)` ファクトリから DO クラスを
  生成する。`alarm()` 発火ごとに CMS を再構築して `kick()` を呼ぶ（DO インスタンスの
  エビクトに対応）。`/kick` `/webhook` `/reconcile` `/state` `/stats` の内部エンドポイントを持つ
- `durableObjectSyncDelegate(stub)`: 読者用の stateless Worker から DO へ sync 制御を
  転送するクライアント側ヘルパー
- `createCMS()` に `realtime`（同期完了時に version 同梱で WebSocket push、#437 ADR-5。
  これまで `publishVersionUpdate` は実装済みだったがどこからも呼ばれていなかった）と
  `syncDelegate`（sync 制御を DO 等の外部に委譲する差し替え口。指定時は `notion`/`scheduler`
  が不要になる）を追加した
