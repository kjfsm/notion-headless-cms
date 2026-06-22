---
"@notion-headless-cms/core": patch
"@notion-headless-cms/cache": patch
---

画像キャッシュキーと realtime 通知を改善する。

- 画像キャッシュキーを Notion 署名ホスト（`prod-files-secure.*.amazonaws.com` / `*.notion.so` / `*.notionusercontent.com`）に限り署名クエリを除いた `origin + pathname` で算出するようにし、再署名のたびに同一画像が別ハッシュで再保存され孤児化する問題を解消（外部画像はクエリを保持。fetch は従来どおりフル URL）。
- `ImageCacheOps` に任意メソッド `has?(hash)` を追加し、`fetchAndCacheImage` の存在確認を本体 DL を伴う `get` から `has`（R2 は `R2BucketLike.head` 経由）へ切り替えて無駄 I/O を削減。未実装アダプタは `get` にフォールバック（後方互換）。
- `RealtimeHubDO.webSocketClose` が予約コード（1005/1006/1015）や範囲外コードで `RangeError` を投げないようガードを追加。
- webhook 由来の `warmByPageId` / `revalidateList`（`refreshList`）が list チャンネル（slug なし）へも publish するようにし、一覧購読クライアントへ新規公開・並び順変化を push できるようにした。

公開 API シグネチャの破壊的変更はなし（`has` / `head` は任意追加）。
