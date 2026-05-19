import type { KnipConfig } from "knip";

export default {
  workspaces: {
    ".": {
      entry: [],
      project: [],
      // vitest.workspace.ts は knip では解析できないため除外
      vitest: {
        config: [],
      },
      // shadcn は MCP サーバー経由で CLI として使用するため knip では検出できない
      ignoreDependencies: ["shadcn"],
    },
    "packages/react-renderer": {
      // package.json の exports サブパス (./, ./server, ./router, ./next, ./mermaid)
      entry: [
        "src/index.ts",
        "src/server.ts",
        "src/router.tsx",
        "src/next.tsx",
        "src/mermaid.tsx",
      ],
      project: ["src/**/*.{ts,tsx}"],
      // mermaid は ./mermaid サブパスから動的 import される optional peer。
      // knip の "Referenced optional peerDependencies" 通知を抑止する。
      ignoreDependencies: ["mermaid"],
    },
    "packages/cli": {
      entry: ["src/index.ts", "src/cli.ts"],
      project: ["src/**/*.ts"],
    },
    "packages/notion-embed": {
      // package.json の exports サブパスに対応する 3 エントリーポイント
      entry: ["src/index.ts", "src/providers/index.ts", "src/rehype/index.ts"],
      project: ["src/**/*.ts"],
    },
    "packages/cache": {
      // package.json の exports サブパス (./, ./cloudflare, ./next)
      entry: ["src/index.ts", "src/cloudflare.ts", "src/next.ts"],
      project: ["src/**/*.ts"],
      // next は ./next エントリで動的 import するためのオプショナル peerDep
      ignoreDependencies: ["next"],
    },
    "packages/block-html": {
      entry: ["src/index.ts", "src/rehype/index.ts"],
      project: ["src/**/*.ts"],
    },
    "packages/fetch-blocks": {
      // package.json の exports サブパス (./, ./react)
      entry: ["src/index.ts", "src/react.ts"],
      project: ["src/**/*.{ts,tsx}"],
    },
    "packages/fetch-markdown": {
      // package.json の exports サブパス (./, ./react)
      entry: ["src/index.ts", "src/react.tsx"],
      project: ["src/**/*.{ts,tsx}"],
    },
    "packages/notion-katex": {
      entry: ["src/index.ts"],
      project: ["src/**/*.ts"],
      // katex は peerDependency。rehype-katex 経由で間接消費するため直接 import はない
      ignoreDependencies: ["katex"],
    },
    "packages/notion-shiki": {
      entry: ["src/index.ts"],
      project: ["src/**/*.ts"],
      // shiki は peerDependency。@shikijs/rehype 経由で間接消費するため直接 import はない
      ignoreDependencies: ["shiki"],
    },
    "packages/core": {
      entry: ["src/index.ts", "src/source-author.ts"],
      project: ["src/**/*.ts"],
      // markdown-html は rendering.ts で動的 import するオプショナル peerDep
      ignoreDependencies: ["@notion-headless-cms/markdown-html"],
    },
    "packages/*": {
      entry: ["src/index.ts"],
      project: ["src/**/*.ts"],
    },
    "apps/docs": {
      // workers/app.ts / app/root.tsx / app/routes.ts / app/routes/** /
      // vite.config.ts / playwright.config.ts は React Router / Vite / Playwright プラグインで
      // 自動検出される。それ以外で knip が拾えないエントリだけ明示する。
      entry: ["nhc.config.ts", "app/__tests__/**/*.{ts,tsx}"],
      project: ["app/**/*.{ts,tsx}", "workers/**/*.{ts,tsx}"],
      ignoreDependencies: [
        // 生成物 (app/generated/nhc.ts) が要求する間接依存（ユーザーは pnpm add するだけ）
        "@notion-headless-cms/notion-orm",
        // @shikijs/rehype の peerDep。直接 import はない
        "shiki",
        // @tailwindcss/vite プラグイン経由で間接消費される（CSS 側で @tailwindcss/postcss 風に解決）
        "tailwindcss",
        // app.css の @plugin ディレクティブ経由でロードされる。knip は CSS を解析しない
        "@tailwindcss/typography",
      ],
    },
  },
  ignore: ["**/examples/**"],
  // 未使用 exports / types は内部 API や公開 API の複雑な判定が必要なため
  // 未使用ファイルと依存チェックのみ有効化する
  exclude: ["exports", "types"],
} satisfies KnipConfig;
