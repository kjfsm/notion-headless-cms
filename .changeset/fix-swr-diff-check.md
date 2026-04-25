---
"@notion-headless-cms/core": patch
---

SWR の挙動を刷新: TTL 切れはブロッキングフェッチ、TTL 未設定/期限内は毎回バックグラウンド差分チェック。`getLastModified`/`getListVersion` で変更がない場合は再レンダリングをスキップし、TTL ありなら `cachedAt` をリセットして期限切れを先送りする。
