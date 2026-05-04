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
    },
    "packages/react-renderer": {
      // package.json の exports サブパス (./, ./server)
      entry: ["src/index.ts", "src/server.ts"],
      project: ["src/**/*.{ts,tsx}"],
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
    "packages/core": {
      entry: ["src/index.ts"],
      project: ["src/**/*.ts"],
      // renderer は rendering.ts で動的 import するオプショナル peerDep
      ignoreDependencies: ["@notion-headless-cms/renderer"],
    },
    "packages/*": {
      entry: ["src/index.ts"],
      project: ["src/**/*.ts"],
    },
  },
  ignore: ["**/examples/**"],
  // 未使用 exports / types は内部 API や公開 API の複雑な判定が必要なため
  // 未使用ファイルと依存チェックのみ有効化する
  exclude: ["exports", "types"],
} satisfies KnipConfig;
