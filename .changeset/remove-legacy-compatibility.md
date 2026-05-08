---
"@notion-headless-cms/adapter-next": patch
"@notion-headless-cms/core": patch
"@notion-headless-cms/notion-embed": patch
"@notion-headless-cms/react-renderer": patch
---

後方互換性のために残されていたコードとコメントを削除

- adapter-next: `createImageRouteHandler` / `createCollectionRevalidateRouteHandler` / `createInvalidateAllRouteHandler` と `RevalidateHandlerOptions` 型を削除。`createNextHandler` を使用すること
- notion-embed: YouTube プロバイダの `ogp` オプションを `fetchData` に改名（旧名は廃止、内部実装は oEmbed のまま）
- notion-embed: `renderTranscription` ハンドラを削除し、`transcription` ブロックは `meeting_notes` と同じレンダリングに統一（`--legacy` 修飾子を削除）
- react-renderer: `ComponentOverrides.Transcription` スロットを削除。`transcription` ブロックは常に `Unsupported` にフォールバック
- core: `loadNotionBlocks` 追加以前のキャッシュエントリを再生成する lazy backfill ロジックを削除（古いキャッシュは `cms.invalidate()` で手動更新が必要）
- docs/migration/ 配下のマイグレーションガイドを一括削除
