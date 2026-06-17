---
"@notion-headless-cms/cache": patch
"@notion-headless-cms/client": patch
---

更新通知（push）の Cloudflare トランスポートを追加。`@notion-headless-cms/cache/realtime` に Durable Object(WebSocket Hibernation) ハブ `RealtimeHubDO` と `durableObjectRealtime({ namespace })`（`RealtimeAdapter` 実装）を追加し、`@notion-headless-cms/client/cloudflare` から re-export。`createCMS({ realtime })` で受け取り `createClient` へ流す。クライアントは `?collection=&slug=` 付きで WS 購読し、`publish` が該当 channel tag へ broadcast する。構造型で受けるため `@cloudflare/workers-types` への実依存は持たない。
