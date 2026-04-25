---
"@notion-headless-cms/core": patch
---

キャッシュ関連のログ強化・スコープ分離バグ修正

- `LogContext` に `cachedAt`・`cacheAdapter`・`imageHash` フィールドを追加し、キャッシュの鮮度や画像ハッシュキーをログで確認できるようにした
- `CMSHooks` に `onCacheUpdate` / `onListCacheUpdate` フックを追加。SWR バックグラウンド差分チェックで更新を検出しキャッシュを差し替えたときに発火する
- `getItem` / `getList` でキャッシュヒット（`cachedAt` 付き）・ミス・TTL 期限切れ・アイテム未発見を `debug` ログとして出力するようにした
- `revalidate()` / `$revalidate()` 呼び出し時にキャッシュ無効化ログを追加した
- SWR バックグラウンド更新で差分検出（変更前 `notionUpdatedAt` 付き）・差し替え / 差分なし・TTL リセットを `debug` ログとして出力するようにした
- 画像キャッシュのヒット・ミス・保存に `imageHash` をログコンテキストへ追加した
- 複数コレクションが同一 `DocumentCacheAdapter` を共有するとき、リストキャッシュがコレクション間で上書きされるバグを修正した（`scopeDocumentCache` 内でコレクション別クロージャ変数に分離）
- `$revalidate()` が `scopeDocumentCache` の `listSlot` をクリアせずキャッシュが残るバグを修正した
