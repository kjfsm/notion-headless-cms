---
"@notion-headless-cms/react-renderer": patch
---

`NotionRevalidator` / `useNotionRevalidate` のクライアント更新検知を vercel/swr ベースに刷新。`realtime`（push 主経路）を追加し `useSWRSubscription` で WebSocket を購読、メッセージ受信で即 revalidate する。poll（フォールバック）は `useSWR` の `refreshInterval` + focus/reconnect 再検証に置き換え、`notionUpdatedAt` の比較のみで判定する（従来の `cachedAt` baseline 検出を撤去し、レース・初回サンプルの無駄・`cachedAt` の意味の上書きを解消）。`swr` を依存に追加。
