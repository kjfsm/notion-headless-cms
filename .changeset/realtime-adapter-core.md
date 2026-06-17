---
"@notion-headless-cms/core": patch
---

更新通知（push）用の `RealtimeAdapter` を追加。`createClient({ realtime })` を指定すると、SWR 差分検出（`find` / `list`）と webhook 再ウォーム（`warmByPageId`）でキャッシュ最新化した直後に `publish({ collection, slug?, version })` を発行し、接続中クライアントへ push できる。未指定なら従来どおり通知しない。`publish` は fail-soft（通知失敗が配信・キャッシュ更新を壊さない）。
