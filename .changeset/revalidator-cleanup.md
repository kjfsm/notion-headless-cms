---
"@notion-headless-cms/react-renderer": patch
"@notion-headless-cms/core": patch
---

レビューに伴う細部改善とドキュメント更新。

- `react-renderer/router` と `react-renderer/next` で重複していた `NotionRevalidateTrigger` / `UseNotionRevalidateOptions` / トリガー処理を `internal/revalidate.ts` に集約し、`useCallback` で revalidate を安定化。
- `core/html` の `notionRevalidatorScript({ nonce })` で nonce を base64 / base64url 文字（`A-Za-z0-9+/=_-`）に厳格化。属性値ブレイクアウトを未然に防ぐため不正な値は throw する。
- `docs/recipes/cloudflare-workers.md` を `cloudflarePreset` ベースに全面書き換え、`swr.ttlMs` 推奨を撤廃して「永続キャッシュ + lastEditedTime 検知」方針に揃える。
- `docs/recipes/nextjs-app-router.md` に `<NotionRevalidator />` セクションを追加。
- `docs/recipes/useswr-integration.md` に「単純な再検証なら `react-renderer/router` / `react-renderer/next` の方が短い」という導入を追加。
- `packages/cache/README.md` / `packages/core/README.md` / `packages/react-renderer/README.md` を現状の API と推奨パターンに揃える。
