import type { ContentBlock } from "./content/blocks";
import { CMSError, isCMSError } from "./errors";
import { buildCacheImageFn } from "./image";
import type {
	BaseContentItem,
	CachedItem,
	CMSHooks,
	ContentConfig,
	DataSource,
	ImageCacheAdapter,
	Logger,
	RendererFn,
} from "./types/index";

/** `buildCachedItem` に必要な CMS の依存を束ねたコンテキスト。 */
export interface RenderContext<T extends BaseContentItem> {
	source: DataSource<T>;
	rendererFn: RendererFn | undefined;
	imgCache: ImageCacheAdapter;
	hasImageCache: boolean;
	imageProxyBase: string;
	contentConfig: ContentConfig | undefined;
	hooks: CMSHooks<T>;
	logger: Logger | undefined;
}

/**
 * コンテンツアイテムをソースから Markdown ロード → blocks 生成 → HTML レンダリング
 * → フック適用まで実行し、キャッシュ保存用の `CachedItem` を返す。
 */
export async function buildCachedItem<T extends BaseContentItem>(
	item: T,
	ctx: RenderContext<T>,
): Promise<CachedItem<T>> {
	const start = Date.now();
	ctx.logger?.info?.("コンテンツのレンダリング開始", {
		slug: item.slug,
		pageId: item.id,
	});
	ctx.hooks.onRenderStart?.(item.slug);

	let markdown: string;
	try {
		markdown = await ctx.source.loadMarkdown(item);
	} catch (err) {
		if (isCMSError(err)) throw err;
		throw new CMSError({
			code: "source/load_markdown_failed",
			message: "Failed to load markdown from source.",
			cause: err,
			context: {
				operation: "buildCachedItem:loadMarkdown",
				pageId: item.id,
				slug: item.slug,
			},
		});
	}

	let blocks: ContentBlock[] = [];
	try {
		blocks = await ctx.source.loadBlocks(item);
	} catch (err) {
		ctx.logger?.warn?.("loadBlocks に失敗したため raw フォールバック", {
			slug: item.slug,
			error: err instanceof Error ? err.message : String(err),
		});
		blocks = [];
	}

	const cacheImage = ctx.hasImageCache
		? buildCacheImageFn(ctx.imgCache, ctx.imageProxyBase, ctx.logger)
		: undefined;

	let html: string;
	const rendererFn = ctx.rendererFn ?? (await loadDefaultRenderer());
	try {
		html = await rendererFn(markdown, {
			imageProxyBase: ctx.imageProxyBase,
			cacheImage,
			remarkPlugins: ctx.contentConfig?.remarkPlugins,
			rehypePlugins: ctx.contentConfig?.rehypePlugins,
		});
	} catch (err) {
		if (isCMSError(err)) throw err;
		throw new CMSError({
			code: "renderer/failed",
			message: "Failed to render markdown.",
			cause: err,
			context: {
				operation: "buildCachedItem:renderMarkdown",
				pageId: item.id,
				slug: item.slug,
			},
		});
	}

	if (ctx.hooks.afterRender) {
		html = await ctx.hooks.afterRender(html, item);
	}

	let result: CachedItem<T> = {
		html,
		blocks,
		markdown,
		item,
		notionUpdatedAt: ctx.source.getLastModified(item),
		cachedAt: Date.now(),
	};

	if (ctx.hooks.beforeCache) {
		result = (await ctx.hooks.beforeCache(result)) as CachedItem<T>;
	}

	const durationMs = Date.now() - start;
	ctx.logger?.info?.("コンテンツのレンダリング完了", {
		slug: item.slug,
		durationMs,
	});
	ctx.hooks.onRenderEnd?.(item.slug, durationMs);

	return result;
}

/**
 * renderer オプション未指定時のフォールバック。
 * @notion-headless-cms/renderer を動的 import する。
 * createCMS({ renderer }) で明示注入された場合はこのパスを通らない。
 */
async function loadDefaultRenderer(): Promise<RendererFn> {
	try {
		const mod = await import("@notion-headless-cms/renderer");
		return mod.renderMarkdown as RendererFn;
	} catch (err) {
		throw new CMSError({
			code: "renderer/failed",
			message:
				"renderer オプションが未指定で @notion-headless-cms/renderer が見つかりません。" +
				" createCMS({ renderer }) でレンダラーを注入するか、@notion-headless-cms/renderer をインストールしてください。",
			cause: err,
			context: { operation: "loadDefaultRenderer" },
		});
	}
}
