/**
 * HTML 文字列を生成する変換器のエントリ(React を使わない利用者向け)。
 * 汎用の `.` エントリからは分離する — React で描画する利用者には不要な公開面のため。
 */
export { renderEmbedIframe, renderOgpShell } from "./render/embeds.js";
export type { RenderHtmlOptions } from "./render/html.js";
export { renderBlocksToHtml, renderBlockToHtml, renderRichText } from "./render/html.js";
