import { createBlockHandlers } from "./handlers/index";
import { embedRehypePlugins } from "./rehype/rehype-sanitize-embeds";
import type {
  NotionEmbedOptions,
  NotionEmbedResult,
  RendererFn,
} from "./types";

export { createOgpFetcher, fetchOgp } from "./ogp";
export { genericIframeProvider } from "./providers/generic-iframe";
export { defineEmbedProvider, matchProvider } from "./providers/index";
export { twitterProvider } from "./providers/twitter";
export { youtubeProvider } from "./providers/youtube";
export { embedRehypePlugins } from "./rehype/rehype-sanitize-embeds";
export { renderRichText } from "./render-rich-text";
export type {
  EmbedOutput,
  EmbedProvider,
  EmbedRenderContext,
  NotionEmbedOptions,
  NotionEmbedResult,
  OgpData,
  OgpFetchOptions,
} from "./types";
export {
  addHttpsToProtocolRelative,
  extractUrlFromMarkdownLink,
  isHttpUrl,
  normalizeUrl,
} from "./url-normalize";

/**
 * createClient の引数に差し込んで Notion ブロックを Notion 風 HTML にレンダリングする。
 *
 * @example
 * ```ts
 * const embed = notionEmbed({ providers: [youtubeProvider()] });
 *
 * export const cms = createClient({
 *   ...nodePreset({ renderer: embed.renderer }),
 *   dataSources: {
 *     posts: postsCollection({ blocks: embed.blocks }),
 *   },
 * });
 * ```
 */
export function notionEmbed(opts?: NotionEmbedOptions): NotionEmbedResult {
  const blocks = createBlockHandlers(opts ?? {});

  const renderer: RendererFn = async (markdown, rendererOpts) => {
    const { renderMarkdown } = await import("@notion-headless-cms/renderer");

    const rehypePlugins = await embedRehypePlugins({
      providers: opts?.providers ?? [],
      extendSchema: undefined,
    });

    type PluggableList = import("unified").PluggableList;
    return renderMarkdown(markdown, {
      imageProxyBase: rendererOpts?.imageProxyBase,
      cacheImage: rendererOpts?.cacheImage,
      allowDangerousHtml: true,
      remarkPlugins: (rendererOpts?.remarkPlugins ?? []) as PluggableList,
      rehypePlugins: [
        ...(rendererOpts?.rehypePlugins ?? []),
        ...rehypePlugins,
      ] as PluggableList,
    });
  };

  return { renderer, blocks };
}
