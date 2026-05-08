import type {
  MeetingNotesBlockObjectResponse,
  SyncedBlockBlockObjectResponse,
  TemplateBlockObjectResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type { RichTextRenderOptions } from "../render-rich-text";
import { renderRichText } from "../render-rich-text";

/**
 * synced_block ブロックを HTML に変換する。
 * 子ブロックは notion-to-md / 親パイプラインがそのまま展開するため、
 * ここでは透過的なラッパー要素のみ出力する。
 * synced_from が null なら「オリジナル」、それ以外なら「同期元」。
 */
export function renderSyncedBlock(
  block: SyncedBlockBlockObjectResponse,
): string {
  const isOriginal = block.synced_block.synced_from === null;
  const cls = `nhc-synced-block${isOriginal ? " nhc-synced-block--original" : ""}`;
  return `<div class="${cls}"></div>`;
}

/**
 * template ブロックを HTML に変換する。
 * Notion の閲覧者には通常表示されないが、API では返るためハンドラを置く。
 */
export async function renderTemplate(
  block: TemplateBlockObjectResponse,
  opts?: RichTextRenderOptions,
): Promise<string> {
  const html = await renderRichText(block.template.rich_text, opts);
  return `<div class="nhc-template">${html}</div>`;
}

/**
 * meeting_notes ブロックを HTML に変換する。
 * 内部構造 (title / status / 子ブロック ID 群) は利用側で展開する想定で、
 * ここではマーカー要素のみ出力する。
 */
export function renderMeetingNotes(
  _block: MeetingNotesBlockObjectResponse,
): string {
  return `<div class="nhc-meeting-notes"></div>`;
}
