/**
 * Notion からコピペされた URL に紛れ込みやすい歪みを補正する。
 *
 * 観測された壊れ方:
 * - `[//host/path](https://host/path)` のように Markdown のリンク記法が
 *   src 属性などに混入する (Notion で HTML を貼ってから編集した場合に発生)
 * - プロトコル相対 `//host/path` がそのまま残る
 *
 * いずれも純粋な文字列操作で復元できるので、provider 側でも
 * rehype プラグイン側でも共通に使えるようにここに集約する。
 */

const MARKDOWN_LINK = /^\[[^\]]*\]\((https?:\/\/[^\s)]+)\)$/;

/**
 * Markdown リンク記法 `[text](url)` から URL を取り出す。
 * Markdown 形式でない場合は null を返す。
 */
export function extractUrlFromMarkdownLink(input: string): string | null {
  const m = input.match(MARKDOWN_LINK);
  return m?.[1] ?? null;
}

/**
 * プロトコル相対 URL (`//host/path`) に `https:` を付与する。
 * 既に http(s) スキームがある場合はそのまま返す。
 */
export function addHttpsToProtocolRelative(input: string): string {
  return input.startsWith("//") ? `https:${input}` : input;
}

/**
 * Notion URL に入り込みやすい歪みを補正する便利関数。
 * `extractUrlFromMarkdownLink` → `addHttpsToProtocolRelative` の順に適用する。
 */
export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  const fromMd = extractUrlFromMarkdownLink(trimmed);
  return addHttpsToProtocolRelative(fromMd ?? trimmed);
}

/**
 * 抽出された URL が http(s) かを軽く判定。
 * provider の match 関数で URL の妥当性を切る前段に使う。
 */
export function isHttpUrl(input: string): boolean {
  return /^https?:\/\//.test(input);
}
