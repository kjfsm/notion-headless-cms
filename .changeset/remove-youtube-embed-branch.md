---
"@notion-headless-cms/react-renderer": patch
---

embed/video ブロックの URL 判定を廃止

- `Embed` コンポーネントの YouTube 専用分岐を削除。すべての embed URL を `OgCard` で統一描画
- `Video` コンポーネントの YouTube 専用分岐を削除。`block.video.type` で `"file"` は `<video>` タグ、`"external"` は `<iframe>` を使用
- 公開 API `Embeds.YouTubeEmbed` を削除
- 内部ユーティリティ `isYouTubeUrl` / `extractYouTubeId` を削除
