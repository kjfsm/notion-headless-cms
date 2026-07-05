---
"@notion-headless-cms/cms": patch
---

Cloudflare 向けの明示的・DI 可能な合成プリミティブを追加した。env を覗いて自動検出せず、実依存を引数で受けることで consumer の定型配線を薄くする。

- `durableObjectSyncDelegate` が `{ namespace, name? }` も受け付け、内部で `idFromName` から stub を解決する（既存の `{ stub }` 形も維持）
- `forwardRealtimeUpgrade({ namespace, request, name? })`: `/api/cms/realtime` の WebSocket 購読リクエストを `RealtimeHubDO` へ転送する定型ヘルパー
- `edgeVersionedCache(cache)`: `createVersionedCacheLayer({ cache })` の糖衣。`cache` は明示注入
- `readerReadOnly()`: 同期しない読み取り専用の `CMSSyncDelegate`（プレビュー/読者専用構成向け）
