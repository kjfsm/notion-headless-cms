import { createCMS, nodePreset } from "@notion-headless-cms/core";
import { cmsDataSources } from "../generated/nhc-schema.js";

/**
 * Node.js 向け CMS クライアント。
 * `nhc generate` で生成した `cmsDataSources` を渡すだけ。
 * 内部で notion-orm の createNotionCollection() が呼ばれているが、
 * ユーザーコードは一切 import していない。
 */
export const cms = createCMS({
	...nodePreset({ ttlMs: 5 * 60_000 }),
	dataSources: cmsDataSources,
});
