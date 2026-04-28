import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import type { PluggableList, Processor } from "unified";
import { unified } from "unified";
import { rehypeImageCache } from "./rehype-image-cache";
import type { RendererOptions } from "./types";

/**
 * オプションに応じた unified processor をメモ化する。
 *
 * 1 回のリクエスト中に同じ rehype/remark プラグイン構成で複数アイテムをレンダリングするケース
 * (warm / list view) では、processor 構築コストが支配的になるため freeze 済みのプロセッサを再利用する。
 *
 * key は (allowDangerousHtml, remark length, rehype length, plugin object identity) の合成。
 * プラグインの参照同一性 (===) で判定するため、毎回新しい配列を渡すと再構築になる。
 */
interface ProcessorMeta {
	remarkLen: number;
	rehypeLen: number;
	dangerous: boolean;
}

const PROCESSOR_CACHE = new WeakMap<object, Processor>();
const PROCESSOR_META = new WeakMap<object, ProcessorMeta>();
const STATIC_PROCESSORS: Record<string, Processor> = Object.create(null);

interface CacheImageContext {
	imageProxyBase: string;
	cacheImage?: (url: string) => Promise<string>;
}

function buildProcessor(
	imgCtx: CacheImageContext,
	allowDangerousHtml: boolean,
	remarkPlugins: PluggableList,
	rehypePlugins: PluggableList,
): Processor {
	const p = unified()
		.use(remarkParse)
		.use(remarkGfm)
		.use(remarkPlugins)
		.use(
			remarkRehype,
			allowDangerousHtml ? { allowDangerousHtml: true } : undefined,
		)
		.use(rehypeImageCache, imgCtx)
		.use(rehypePlugins)
		.use(rehypeStringify);
	return p.freeze() as unknown as Processor;
}

/**
 * processor キャッシュキーを引き当てる。
 * `imgCtx` を WeakMap キーにすると、同一 cacheImage 関数 (createCMS 内で 1 回生成) なら
 * processor をプロセス全体で 1 つ使い回せる。
 */
function getProcessor(
	imgCtx: CacheImageContext,
	allowDangerousHtml: boolean,
	remarkPlugins: PluggableList,
	rehypePlugins: PluggableList,
): Processor {
	// プラグイン無し + cacheImage 無しは静的にキャッシュ (テスト/単純ケース)
	if (
		!imgCtx.cacheImage &&
		remarkPlugins.length === 0 &&
		rehypePlugins.length === 0
	) {
		const key = `${allowDangerousHtml ? 1 : 0}:${imgCtx.imageProxyBase}`;
		const existing = STATIC_PROCESSORS[key];
		if (existing) return existing;
		const proc = buildProcessor(imgCtx, allowDangerousHtml, [], []);
		STATIC_PROCESSORS[key] = proc;
		return proc;
	}

	// それ以外は cacheImage 関数を WeakMap キーにする (createCMS のライフサイクルに同期)
	const key = imgCtx.cacheImage ?? imgCtx;
	const keyObj = key as object;
	const cached = PROCESSOR_CACHE.get(keyObj);
	const meta = cached ? PROCESSOR_META.get(keyObj) : undefined;
	if (
		cached &&
		meta &&
		meta.remarkLen === remarkPlugins.length &&
		meta.rehypeLen === rehypePlugins.length &&
		meta.dangerous === allowDangerousHtml
	) {
		return cached;
	}
	const proc = buildProcessor(
		imgCtx,
		allowDangerousHtml,
		remarkPlugins,
		rehypePlugins,
	);
	PROCESSOR_CACHE.set(keyObj, proc);
	PROCESSOR_META.set(keyObj, {
		remarkLen: remarkPlugins.length,
		rehypeLen: rehypePlugins.length,
		dangerous: allowDangerousHtml,
	});
	return proc;
}

/**
 * Markdown を HTML に変換する。unified/remark/rehype パイプラインを使用。
 *
 * - cacheImage が指定された場合は Notion 画像 URL をプロキシ経由に変換する。
 * - render が指定された場合はデフォルトのパイプラインを置き換える。
 * - 同一の cacheImage 関数 + プラグイン構成では processor を再利用する (パフォーマンス最適化)。
 */
export async function renderMarkdown(
	markdown: string,
	options: RendererOptions = {},
): Promise<string> {
	const {
		imageProxyBase = "/api/images",
		cacheImage,
		remarkPlugins = [],
		rehypePlugins = [],
		render,
		allowDangerousHtml = false,
	} = options;

	if (render) {
		return render(markdown, {
			imageProxyBase,
			cacheImage: cacheImage ?? ((url) => Promise.resolve(url)),
		});
	}

	const processor = getProcessor(
		{ imageProxyBase, cacheImage },
		allowDangerousHtml,
		remarkPlugins as PluggableList,
		rehypePlugins as PluggableList,
	);
	const result = await processor.process(markdown);
	return String(result);
}
