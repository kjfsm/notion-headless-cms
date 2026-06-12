---
"@notion-headless-cms/client": minor
---

`createCMS` の `imageProxyBase` オプションを廃止し、`/api/cms/images` に固定する。`cms.handler()` の既定ルート（`{basePath}/images` = `/api/cms/images`）と常に一致するため、`api.cms.$.ts` に `cms.handler()` を 1 枚マウントすれば画像配信もまとめて賄える（cacheImage の書き込み先と handler の配信先がズレる設定ミスを排除）。

破壊的変更: これまで `createCMS({ imageProxyBase })` を指定していた場合は型エラーになる。低レベルに調整したい場合は `createClient({ imageProxyBase })`（既定 `/api/images`）を使う。既定値も `/api/images` → `/api/cms/images` に変わるため、画像配信ルートは `/api/cms` 配下（`cms.handler()`）へ寄せること。
