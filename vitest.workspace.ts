import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/core",
  "packages/markdown-html",
  "packages/cache",
  "packages/notion-orm",
  "packages/notion-source",
  "packages/block-html",
  "packages/notion-katex",
  "packages/notion-shiki",
  "packages/cli",
  "packages/react-renderer",
  "packages/testing",
  "packages/validate",
  "packages/client",
  "packages/v3",
]);
