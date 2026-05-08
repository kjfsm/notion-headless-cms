import type { BlockObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type {
  BlockHandler,
  EmbedProvider,
  NotionEmbedOptions,
  OgpFetchOptions,
} from "../types";
import { renderBookmark } from "./bookmark";
import { renderCallout } from "./callout";
import { renderChildDatabase, renderChildPage } from "./child";
import { renderCode, renderEquation } from "./code";
import { renderColumn, renderColumnList } from "./column";
import {
  renderAudio,
  renderEmbed,
  renderFile,
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
  renderHeading4,
  renderNumberedListItem,
  renderParagraph,
  renderQuote,
  renderToDo,
} from "./paragraph";
import {
  renderBreadcrumb,
  renderDivider,
  renderTab,
  renderTableOfContents,
  renderUnsupported,
} from "./structural";
import {
  renderMeetingNotes,
  renderSyncedBlock,
  renderTemplate,
} from "./synced";
import { renderTable, renderTableRow } from "./table";
import { renderToggle } from "./toggle";

/**
 * createBlockHandlers が返す BlockHandler マップ。
 *
 * 戻り値型は `Record<BlockObjectResponse["type"], BlockHandler>` に固定しており、
 * `@notionhq/client` 側の `BlockObjectResponse` union に新しいブロック type が
 * 追加された場合は型エラーになる (= ライブラリ更新検知)。
 * Phase 3 の exhaustiveness チェックを兼ねる。
 */
export function createBlockHandlers(
  opts: NotionEmbedOptions,
): Record<BlockObjectResponse["type"], BlockHandler> {
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
      return renderParagraph(block as never, rtOpts);
    },
    heading_1: async (block) => {
      return renderHeading1(block as never, rtOpts);
    },
    heading_2: async (block) => {
      return renderHeading2(block as never, rtOpts);
    },
    heading_3: async (block) => {
      return renderHeading3(block as never, rtOpts);
    },
    heading_4: async (block) => {
      return renderHeading4(block as never, rtOpts);
    },
    bulleted_list_item: async (block) => {
      return renderBulletedListItem(block as never, rtOpts);
    },
    numbered_list_item: async (block) => {
      return renderNumberedListItem(block as never, rtOpts);
    },
    quote: async (block) => {
      return renderQuote(block as never, rtOpts);
    },
    to_do: async (block) => {
      return renderToDo(block as never, rtOpts);
    },
    callout: async (block) => {
      return renderCallout(block as never, rtOpts);
    },
    toggle: async (block) => {
      return renderToggle(block as never, rtOpts);
    },
    bookmark: async (block) => {
      return renderBookmark(block as never, ogpOpts);
    },
    link_preview: async (block) => {
      return renderLinkPreview(block as never, ogpOpts);
    },
    link_to_page: async (block) => {
      return renderLinkToPage(block as never, rtOpts);
    },
    embed: async (block) => {
      return renderEmbed(block as never, providers);
    },
    video: async (block) => {
      return renderVideo(block as never, providers);
    },
    audio: async (block) => {
      return renderAudio(block as never);
    },
    pdf: async (block) => {
      return renderPdf(block as never);
    },
    image: async (block) => {
      return renderImage(block as never);
    },
    file: async (block) => {
      return renderFile(block as never);
    },
    code: async (block) => {
      return renderCode(block as never);
    },
    equation: (block) => {
      return renderEquation(block as never);
    },
    divider: (block) => {
      return renderDivider(block as never);
    },
    breadcrumb: (block) => {
      return renderBreadcrumb(block as never);
    },
    table: (block) => {
      return renderTable(block as never);
    },
    table_row: async (block) => {
      return renderTableRow(block as never, rtOpts);
    },
    table_of_contents: (block) => {
      return renderTableOfContents(block as never);
    },
    tab: (block) => {
      return renderTab(block as never);
    },
    column_list: (block) => {
      return renderColumnList(block as never);
    },
    column: (block) => {
      return renderColumn(block as never);
    },
    synced_block: (block) => {
      return renderSyncedBlock(block as never);
    },
    template: async (block) => {
      return renderTemplate(block as never, rtOpts);
    },
    child_page: (block) => {
      return renderChildPage(block as never);
    },
    child_database: (block) => {
      return renderChildDatabase(block as never);
    },
    meeting_notes: (block) => {
      return renderMeetingNotes(block as never);
    },
    transcription: (block) => {
      return renderMeetingNotes(block as never);
    },
    unsupported: (block) => {
      return renderUnsupported(block as never);
    },
  };
}
