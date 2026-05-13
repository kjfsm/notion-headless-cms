---
"@notion-headless-cms/core": patch
"@notion-headless-cms/react-renderer": patch
---

KV ポーリングによる SWR バックグラウンド更新完了後の自動再描画を追加

- `CollectionClient.peekVersion(slug)` を追加: KV のみを読んで `{ notionUpdatedAt, cachedAt }` を返す。Notion API を叩かないため安価なポーリングエンドポイントとして使える
- `checkAndUpdateItemBg` で差分なし時も常に `cachedAt` を更新するよう変更: ポーリング側が「バックグラウンド確認完了」を `cachedAt` の変化で検出できるようにする
- `NotionRevalidator` / `useNotionRevalidate` に `poll` オプションを追加: `notionUpdatedAt` 変化で revalidate、`cachedAt` 変化（更新なし）で停止、タイムアウト 30 秒
