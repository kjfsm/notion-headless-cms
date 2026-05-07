import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/core",
  "packages/renderer",
  "packages/cache",
  "packages/notion-orm",
  "packages/notion-source",
  "packages/notion-embed",
  "packages/notion-katex",
  "packages/cli",
  "packages/adapter-next",
]);
