import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  "packages/cli",
  "packages/react-renderer",
  "packages/cms",
  "packages/sql",
]);
