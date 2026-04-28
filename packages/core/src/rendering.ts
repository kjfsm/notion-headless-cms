import type { ContentBlock } from "./content/blocks";
import { CMSError, isCMSError } from "./errors";
import { buildCacheImageFn } from "./image";
import type {
  BaseContentItem,
  CachedItemContent,
  CachedItemMeta,
  CMSHooks,
  ContentConfig,
  DataSource,
  ImageCacheOps,
  Logger,
  RendererFn,
} from "./types/index";

/** 本文レンダリングに必要な依存を束ねたコンテキスト。 */
export interface RenderContext<T extends BaseContentItem> {
  source: DataSource<T>;
  rendererFn: RendererFn;
  imgCache: ImageCacheOps;
  imgCacheName: string;
  hasImageCache: boolean;
  imageProxyBase: string;
  contentConfig: ContentConfig | undefined;
  hooks: CMSHooks<T>;
  logger: Logger | undefined;
}

/**
 * メタデータキャッシュエントリを生成する。Notion API も renderer も呼ばない軽量関数。
 */
export function buildCachedItemMeta<T extends BaseContentItem>(
  item: T,
  source: DataSource<T>,
): CachedItemMeta<T> {
  return {
    item,
    notionUpdatedAt: source.getLastModified(item),
    cachedAt: Date.now(),
  };
}

/**
 * アイテム本文を Markdown ロード → blocks 生成 → HTML レンダリング → フック適用まで
 * 実行し、本文キャッシュ用の `CachedItemContent` を返す。
 */
export async function buildCachedItemContent<T extends BaseContentItem>(
  item: T,
  ctx: RenderContext<T>,
): Promise<CachedItemContent> {
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
        operation: "buildCachedItemContent:loadMarkdown",
        pageId: item.id,
        slug: item.slug,
      },
    });
  }

  let blocks: ContentBlock[];
  try {
    blocks = await ctx.source.loadBlocks(item);
  } catch (err) {
    if (isCMSError(err)) throw err;
    throw new CMSError({
      code: "source/load_blocks_failed",
      message: "Failed to load blocks from source.",
      cause: err,
      context: {
        operation: "buildCachedItemContent:loadBlocks",
        pageId: item.id,
        slug: item.slug,
      },
    });
  }

  const cacheImage = ctx.hasImageCache
    ? buildCacheImageFn(
        ctx.imgCache,
        ctx.imgCacheName,
        ctx.imageProxyBase,
        ctx.logger,
      )
    : undefined;

  let html: string;
  try {
    html = await ctx.rendererFn(markdown, {
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
        operation: "buildCachedItemContent:renderMarkdown",
        pageId: item.id,
        slug: item.slug,
      },
    });
  }

  if (ctx.hooks.afterRender) {
    html = await ctx.hooks.afterRender(html, item);
  }

  let result: CachedItemContent = {
    html,
    blocks,
    markdown,
    notionUpdatedAt: ctx.source.getLastModified(item),
    cachedAt: Date.now(),
  };

  if (ctx.hooks.beforeCacheContent) {
    result = await ctx.hooks.beforeCacheContent(result, item);
  }

  const durationMs = Date.now() - start;
  ctx.logger?.info?.("コンテンツのレンダリング完了", {
    slug: item.slug,
    durationMs,
  });
  ctx.hooks.onRenderEnd?.(item.slug, durationMs);

  return result;
}
