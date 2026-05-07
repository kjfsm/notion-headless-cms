---
"@notion-headless-cms/react-renderer": minor
"@notion-headless-cms/core": minor
---

Notion 更新の表示反映を 1 行で書ける再検証ヘルパを追加。

- `@notion-headless-cms/react-renderer/router`: React Router 用の `useNotionRevalidate()` フックと `<NotionRevalidator />` コンポーネント。内部で `useRevalidator` を呼び、loader を再走させる。
- `@notion-headless-cms/react-renderer/next`: Next.js App Router 用の同 API。内部で `useRouter().refresh()` を呼び、Server Component を再評価させる。
- `@notion-headless-cms/core/html`: React 非依存の `notionRevalidatorScript()`。Astro / Hono / Express など素の HTML を返すフレームワーク向けに、タブ可視化で `location.reload()` する `<script>` 文字列を返す。

いずれもクエリパラメータも別 API への fetch も発生せず、フレームワーク本来の再評価機構だけを使う。サーバ側の `cloudflarePreset({ env, ctx })` 等で `waitUntil` を渡しておけば、SWR の bg 更新で KV キャッシュが最新化された次のリクエストで画面が静かに切り替わる。
