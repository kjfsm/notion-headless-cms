import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
	"packages/core",
	"packages/renderer",
	"packages/source-notion",
	"packages/cache-next",
	"packages/adapter-next",
]);
