import { createNodeCMS } from "@notion-headless-cms/adapter-node";
import { nhcDataSources } from "../generated/nhc-schema.js";

/**
 * Node.js 向け CMS クライアント。
 * `nhc generate` で生成した `nhcDataSources` を渡すだけ。
 * 内部で notion-orm の createNotionCollection() が呼ばれているが、
 * ユーザーコードは一切 import していない。
 */
export const cms = createNodeCMS({
	dataSources: nhcDataSources,
	cache: {
		document: "memory",
		image: "memory",
		ttlMs: 5 * 60_000,
	},
});
