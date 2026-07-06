import { index, layout, prefix, type RouteConfig, route } from "@react-router/dev/routes";

// ルート方針:
// - /              Notion 固定ページ DB の "home" を表示（ランディング）
// - /:slug         Notion 固定ページ DB の任意ページ（about / privacy 等）
// - /docs          md ドキュメントの一覧
// - /docs/*        md ドキュメント（splat で /docs/ja/recipes/foo 等の階層に対応）
// - /api/cms/*     cms.fetch() が画像プロキシ・OGP・Webhook (POST /api/cms/webhook) を mount する
export default [
  route("/", "routes/index.tsx"),
  ...prefix("/docs", [
    layout("routes/docs/_layout.tsx", [
      index("routes/docs/index.tsx"),
      route("*", "routes/docs/$.tsx"),
    ]),
  ]),
  route("/api/cms/*", "routes/api/cms/$.ts"),
  route("/:slug", "routes/$slug.tsx"),
] satisfies RouteConfig;
