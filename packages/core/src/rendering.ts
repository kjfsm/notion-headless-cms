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

/**
 * `@notion-headless-cms/markdown-html` を動的 import してデフォルトレンダラーを返す。
 * core のゼロ依存ルールを守るため静的 import は禁止。
 */
async function loadDefaultRenderer(): Promise<RendererFn> {
  try {
    const mod = await import("@notion-headless-cms/markdown-html");
    return (mod as { renderMarkdown: RendererFn }).renderMarkdown;
  } catch {
    throw new CMSError({
      code: "core/config_invalid",
      message:
        "renderer が未指定で、@notion-headless-cms/markdown-html のロードにも失敗しました。" +
        " createClient の renderer オプションを指定するか、@notion-headless-cms/markdown-html をインストールしてください。",
      context: { operation: "loadDefaultRenderer" },
    });
  }
}

export interface RenderContext<T extends BaseContentItem> {
  source: DataSource<T>;
  rendererFn: RendererFn | undefined;
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
  // 内部 identity（ページは slug、要素は id）。ログ・フックの識別子に使う。
  const slug = item.slug ?? item.id;
  ctx.logger?.info?.("コンテンツのレンダリング開始", {
    slug,
    pageId: item.id,
  });
  ctx.hooks.onRenderStart?.(slug);

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
        slug,
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
        slug,
      },
    });
  }

  // react-renderer など Notion 形式を直接消費する利用側のため、
  // DataSource が対応していれば BlockObjectResponse ツリーも取得・キャッシュする。
  // markdown 戦略のように loadNotionBlocks 未対応の場合は `source/blocks_unsupported`
  // を吸収して undefined にする (ページ描画は markdown 経路で代替する想定)。
  let notionBlocks: unknown[] | undefined;
  if (ctx.source.loadNotionBlocks) {
    try {
      notionBlocks = await ctx.source.loadNotionBlocks(item);
    } catch (err) {
      if (isCMSError(err) && err.is("source/blocks_unsupported")) {
        notionBlocks = undefined;
      } else if (isCMSError(err)) {
        throw err;
      } else {
        throw new CMSError({
          code: "source/load_blocks_failed",
          message: "Failed to load Notion blocks from source.",
          cause: err,
          context: {
            operation: "buildCachedItemContent:loadNotionBlocks",
            pageId: item.id,
            slug,
          },
        });
      }
    }
  }

  const cacheImage = ctx.hasImageCache
    ? buildCacheImageFn(
        ctx.imgCache,
        ctx.imgCacheName,
        ctx.imageProxyBase,
        ctx.logger,
      )
    : undefined;

  const rendererFn = ctx.rendererFn ?? (await loadDefaultRenderer());

  let html: string;
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
        operation: "buildCachedItemContent:renderMarkdown",
        pageId: item.id,
        slug,
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
    notionBlocks,
    notionUpdatedAt: ctx.source.getLastModified(item),
    cachedAt: Date.now(),
  };

  if (ctx.hooks.beforeCacheContent) {
    result = await ctx.hooks.beforeCacheContent(result, item);
  }

  const durationMs = Date.now() - start;
  ctx.logger?.info?.("コンテンツのレンダリング完了", {
    slug,
    durationMs,
  });
  ctx.hooks.onRenderEnd?.(slug, durationMs);

  return result;
}
