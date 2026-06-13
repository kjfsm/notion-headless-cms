---
"@notion-headless-cms/core": patch
"@notion-headless-cms/notion-orm": patch
"@notion-headless-cms/client": patch
---

Notion 公式 webhook（integration の Webhooks）受信によるキャッシュの自動ウォームを追加。`createCMS({ notion: { webhookSecret } })`（= `CreateClientOptions.notionWebhookSecret`）を設定すると、`cms.handler()` が `POST {basePath}/notion-webhook` を自動マウントし、`verification_token` 応答・`X-Notion-Signature` の HMAC-SHA256 署名検証・`entity.id`（page）→ slug 逆引きを行って、更新されたページだけをミラー再生成する。初回アクセスのコールドスタート遅延を「ページ更新時」に解消できる。

あわせて公開 API を追加:

- `cms.warmByPageId(pageId)` — Notion ページ ID を全コレクション横断で解決し単件ウォームする
- `cms.<collection>.cache.prime(slug)` — 既存 `warm()` の単件版（1 件だけ取得して meta/content を作り直す）
- `DataSource.findById?(pageId)` — notion-orm が `pages.retrieve` + parent data source 一致チェックで実装（他 DB のページ混入を防ぐ）

`core` のゼロ依存は維持（HMAC はグローバル `crypto.subtle` を使用し import しない）。webhook の応答送信後もウォームを完走させるため、設定済みの `waitUntil` をバックグラウンド実行に利用する。
