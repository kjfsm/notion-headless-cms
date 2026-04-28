---
"@notion-headless-cms/core": minor
---

サイレントフォールバック撤廃・`onSwrError` hook 追加・`renderer` 必須化

- `renderer` オプションが必須になりました（`RendererFn` 型、省略不可）。動的 import フォールバックは削除されました。`@notion-headless-cms/renderer` の `renderMarkdown` を明示的に渡してください
- `loadBlocks` 失敗時に空配列を返すフォールバックを削除。`source/load_blocks_failed` CMSError をスローするようになりました
- `CMSHooks` に `onSwrError(error, ctx)` hook を追加。SWR バックグラウンド処理（メタ更新・コンテンツ再構築・リスト更新）で失敗した場合に呼ばれます
- 画像フェッチ時に Content-Type ヘッダがない、または `image/*` でない場合は `cache/image_invalid_content_type` CMSError をスローするようになりました（URL 拡張子推測・`image/jpeg` デフォルトフォールバックを廃止）
- 新エラーコード追加: `source/load_blocks_failed`, `cache/image_invalid_content_type`, `swr/item_check_failed`, `swr/list_check_failed`, `swr/content_rebuild_failed`
