import {
  index,
  layout,
  prefix,
  type RouteConfig,
  route,
} from "@react-router/dev/routes";

// ルート方針:
// - /                       Notion 固定ページ DB の "home" を表示（ランディング）
// - /:slug                  Notion 固定ページ DB の任意ページ（about / privacy 等）
// - /docs                   md ドキュメントの一覧
// - /docs/*                 md ドキュメント（splat で /docs/ja/recipes/foo 等の階層に対応）
// - /api/cms/images/:hash   Notion 画像プロキシ（createCMS の固定 imageProxyBase /api/cms/images に一致）
// - /api/warm               キャッシュ warm-up
// - /api/pages/:slug/check  Notion ページの更新検知（クライアント側 POST check 用）
// - /api/revalidate         Notion Webhook 受け口
export default [
  route("/", "routes/index.tsx"),
  ...prefix("/docs", [
    layout("routes/docs/_layout.tsx", [
      index("routes/docs/index.tsx"),
      route("*", "routes/docs/$.tsx"),
    ]),
  ]),
  route("/api/cms/images/:hash", "routes/api/images/$hash.ts"),
  route("/api/warm", "routes/api/warm.ts"),
  route("/api/pages/:slug/check", "routes/api/pages/$slug/check.ts"),
  route("/api/revalidate", "routes/api/revalidate.ts"),
  route("/:slug", "routes/$slug.tsx"),
] satisfies RouteConfig;
