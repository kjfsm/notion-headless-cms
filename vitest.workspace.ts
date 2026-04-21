import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
	"packages/core",
	"packages/renderer",
	"packages/source-notion",
	"packages/cache-next",
	"packages/cache-r2",
	"packages/adapter-next",
	"packages/adapter-cloudflare",
	"packages/adapter-node",
]);
