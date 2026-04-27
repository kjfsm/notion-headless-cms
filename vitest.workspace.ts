import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
	"packages/core",
	"packages/renderer",
	"packages/cache",
	"packages/notion-orm",
	"packages/notion-embed",
	"packages/cli",
	"packages/adapter-next",
]);
