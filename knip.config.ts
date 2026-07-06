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
      // e2e-nightly.yml が playwright を CI 内で `pnpm exec playwright install` する。
      // playwright 本体は examples / apps/docs の devDependencies 経由で解決される。
      ignoreBinaries: ["playwright"],
    },
    "packages/react-renderer": {
      // package.json の exports サブパス (./, ./server, ./router, ./next, ./mermaid, ./cms)
      entry: [
        "src/index.ts",
        "src/server.ts",
        "src/router.tsx",
        "src/next.tsx",
        "src/mermaid.tsx",
        "src/cms.ts",
      ],
      project: ["src/**/*.{ts,tsx}"],
      // mermaid は ./mermaid サブパスから動的 import される optional peer。
      // tailwindcss は ./theme.css の @source/@theme ディレクティブ経由で参照される optional peer。
      // knip の "Referenced optional peerDependencies" 通知を抑止する。
      ignoreDependencies: ["mermaid", "tailwindcss"],
    },
    "packages/cli": {
      entry: ["src/index.ts", "src/cli.ts"],
      project: ["src/**/*.ts"],
    },
    "packages/cms": {
      // package.json の exports サブパス (./, ./html, ./cloudflare, ./node, ./testing)
      entry: [
        "src/index.ts",
        "src/html.ts",
        "src/cloudflare.ts",
        "src/node.ts",
        "src/testing.ts",
      ],
      project: ["src/**/*.ts"],
      // vitest は ./testing サブパスから使う optional peerDep
      ignoreDependencies: ["vitest"],
    },
    "packages/*": {
      entry: ["src/index.ts"],
      project: ["src/**/*.ts"],
    },
    "apps/docs": {
      // workers/app.ts / app/root.tsx / app/routes.ts / app/routes/** /
      // vite.config.ts / playwright.config.ts は React Router / Vite / Playwright プラグインで
      // 自動検出される。それ以外で knip が拾えないエントリだけ明示する。
      entry: ["app/__tests__/**/*.{ts,tsx}"],
      project: ["app/**/*.{ts,tsx}", "workers/**/*.{ts,tsx}"],
      // ./+types/* は `react-router typegen` が生成するルート型ファイル。
      // ビルド前の静的解析では存在しないため未解決になるが、実害はない。
      ignoreUnresolved: ["./\\+types/.*"],
      ignoreDependencies: [
        // @shikijs/rehype の peerDep。直接 import はない
        "shiki",
        // app.css の @import "katex/dist/katex.min.css" 経由でロードされる。knip は CSS を解析しない
        "katex",
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
