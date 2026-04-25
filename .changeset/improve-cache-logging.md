---
"@notion-headless-cms/core": patch
---

キャッシュ関連のログと新フックを追加

- `LogContext` に `collection` と `cacheAdapter` フィールドを追加し、どのコレクション・バックエンドのイベントか識別可能にした
- `CMSHooks` に `onCacheUpdate` / `onListCacheUpdate` フックを追加。SWR バックグラウンド差分チェックで更新を検出しキャッシュを差し替えたときに発火する
- `getItem` / `getList` でキャッシュヒット・ミス・TTL 期限切れを `debug` ログとして出力するようにした
- SWR バックグラウンド更新で差分検出・差し替え / 差分なし・TTL リセットを `debug` ログとして出力するようにした
- `buildCacheImageFn` にオプショナルな `logger` 引数を追加し、画像キャッシュのヒット・ミス・保存を `debug` ログとして出力できるようにした
