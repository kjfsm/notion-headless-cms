import { CMSError, isCMSError } from "./errors";
import { buildCacheImageFn } from "./image";
import type {
	BaseContentItem,
	CachedItem,
	CMSHooks,
	ContentConfig,
	DataSourceAdapter,
	ImageCacheAdapter,
	Logger,
	RendererFn,
} from "./types/index";

/** `buildCachedItem` に必要な CMS の依存を束ねたコンテキスト。 */
export interface RenderContext<T extends BaseContentItem> {
	source: DataSourceAdapter<T>;
	rendererFn: RendererFn | undefined;
	imgCache: ImageCacheAdapter;
	hasImageCache: boolean;
	imageProxyBase: string;
	contentConfig: ContentConfig | undefined;
	hooks: CMSHooks<T>;
	logger: Logger | undefined;
}

/**
 * コンテンツアイテムをソースから Markdown ロード → HTML レンダリング → フック適用
 * までを実行し、キャッシュ保存用の `CachedItem` を返す。副作用はロガー呼び出しのみ。
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

	const cacheImage = ctx.hasImageCache
		? buildCacheImageFn(ctx.imgCache, ctx.imageProxyBase)
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
		item,
		notionUpdatedAt: item.updatedAt,
		cachedAt: Date.now(),
	};

	if (ctx.hooks.beforeCache) {
		result = await ctx.hooks.beforeCache(result);
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
 * adapter-cloudflare / adapter-node は renderer を明示注入するためこのパスは通らない。
 */
export async function loadDefaultRenderer(): Promise<RendererFn> {
	try {
		const mod = await import("@notion-headless-cms/renderer");
		return mod.renderMarkdown;
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
