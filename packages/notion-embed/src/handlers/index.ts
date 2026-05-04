import type {
  AudioBlockObjectResponse,
  BookmarkBlockObjectResponse,
  BulletedListItemBlockObjectResponse,
  CalloutBlockObjectResponse,
  EmbedBlockObjectResponse,
  Heading1BlockObjectResponse,
  Heading2BlockObjectResponse,
  Heading3BlockObjectResponse,
  ImageBlockObjectResponse,
  LinkPreviewBlockObjectResponse,
  LinkToPageBlockObjectResponse,
  NumberedListItemBlockObjectResponse,
  ParagraphBlockObjectResponse,
  PdfBlockObjectResponse,
  QuoteBlockObjectResponse,
  ToDoBlockObjectResponse,
  ToggleBlockObjectResponse,
  VideoBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type {
  BlockHandler,
  EmbedProvider,
  NotionEmbedOptions,
  OgpFetchOptions,
} from "../types";
import { renderBookmark } from "./bookmark";
import { renderCallout } from "./callout";
import {
  renderAudio,
  renderEmbed,
  renderImage,
  renderPdf,
  renderVideo,
} from "./embed";
import { renderLinkPreview } from "./link-preview";
import { renderLinkToPage } from "./link-to-page";
import {
  renderBulletedListItem,
  renderHeading1,
  renderHeading2,
  renderHeading3,
  renderNumberedListItem,
  renderParagraph,
  renderQuote,
  renderToDo,
} from "./paragraph";
import { renderToggle } from "./toggle";

/** createEmbedHandlers が返す BlockHandler マップ。 */
export function createBlockHandlers(
  opts: NotionEmbedOptions,
): Record<string, BlockHandler> {
  const providers: readonly EmbedProvider[] = opts.providers ?? [];
  const ogpOpts: false | OgpFetchOptions | undefined =
    opts.ogp === false
      ? false
      : opts.ogp === true || opts.ogp == null
        ? undefined
        : opts.ogp;
  const rtOpts = { resolvePageTitle: opts.resolvePageTitle };

  return {
    paragraph: async (block) => {
      return renderParagraph(block as ParagraphBlockObjectResponse, rtOpts);
    },
    heading_1: async (block) => {
      return renderHeading1(block as Heading1BlockObjectResponse, rtOpts);
    },
    heading_2: async (block) => {
      return renderHeading2(block as Heading2BlockObjectResponse, rtOpts);
    },
    heading_3: async (block) => {
      return renderHeading3(block as Heading3BlockObjectResponse, rtOpts);
    },
    bulleted_list_item: async (block) => {
      return renderBulletedListItem(
        block as BulletedListItemBlockObjectResponse,
        rtOpts,
      );
    },
    numbered_list_item: async (block) => {
      return renderNumberedListItem(
        block as NumberedListItemBlockObjectResponse,
        rtOpts,
      );
    },
    quote: async (block) => {
      return renderQuote(block as QuoteBlockObjectResponse, rtOpts);
    },
    to_do: async (block) => {
      return renderToDo(block as ToDoBlockObjectResponse, rtOpts);
    },
    callout: async (block) => {
      return renderCallout(block as CalloutBlockObjectResponse, rtOpts);
    },
    toggle: async (block) => {
      return renderToggle(block as ToggleBlockObjectResponse, rtOpts);
    },
    bookmark: async (block) => {
      return renderBookmark(block as BookmarkBlockObjectResponse, ogpOpts);
    },
    link_preview: async (block) => {
      return renderLinkPreview(block as LinkPreviewBlockObjectResponse);
    },
    link_to_page: async (block) => {
      return renderLinkToPage(block as LinkToPageBlockObjectResponse, rtOpts);
    },
    embed: async (block) => {
      return renderEmbed(block as EmbedBlockObjectResponse, providers);
    },
    video: async (block) => {
      return renderVideo(block as VideoBlockObjectResponse, providers);
    },
    audio: async (block) => {
      return renderAudio(block as AudioBlockObjectResponse);
    },
    pdf: async (block) => {
      return renderPdf(block as PdfBlockObjectResponse);
    },
    image: async (block) => {
      return renderImage(block as ImageBlockObjectResponse);
    },
  };
}
