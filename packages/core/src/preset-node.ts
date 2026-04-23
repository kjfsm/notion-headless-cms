import { memoryDocumentCache, memoryImageCache } from "./cache/memory";
import type { CacheConfig, CreateCMSOptions, RendererFn } from "./types/index";

/** `nodePreset()` のオプション。 */
export interface NodePresetOptions {
	/**
	 * キャッシュ設定。
	 * - 省略時: memoryDocumentCache + memoryImageCache をデフォルト有効化
	 * - `"disabled"`: キャッシュを完全無効化
	 * - オブジェクト: 任意の cache adapter を差し込む
	 */
	cache?: CacheConfig | "disabled";
	/** SWR の TTL (ミリ秒)。`cache` をオブジェクトで渡した場合はそちらが優先される。 */
	ttlMs?: number;
	/** カスタムレンダラー。未指定時は core が @notion-headless-cms/renderer を動的ロード。 */
	renderer?: RendererFn;
}

/**
 * Node.js ランタイム向けの `createCMS` オプションプリセット。
 * メモリキャッシュをデフォルト有効にした `{ cache, renderer }` を返す。
 *
 * @example
 * import { createCMS, nodePreset } from "@notion-headless-cms/core";
 * import { cmsDataSources } from "./generated/cms-schema";
 *
 * const cms = createCMS({
 *   ...nodePreset({ ttlMs: 5 * 60_000 }),
 *   dataSources: cmsDataSources,
 * });
 */
export function nodePreset(
	opts: NodePresetOptions = {},
): Pick<CreateCMSOptions, "cache" | "renderer"> {
	if (opts.cache === "disabled") {
		return { cache: undefined, renderer: opts.renderer };
	}
	return {
		cache: opts.cache ?? {
			document: memoryDocumentCache(),
			image: memoryImageCache(),
			ttlMs: opts.ttlMs,
		},
		renderer: opts.renderer,
	};
}
