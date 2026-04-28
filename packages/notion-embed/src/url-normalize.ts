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

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;

  const md = trimmed.match(MARKDOWN_LINK);
  if (md?.[1]) return md[1];

  if (trimmed.startsWith("//")) return `https:${trimmed}`;

  return trimmed;
}

/**
 * 抽出された URL が http(s) かを軽く判定。
 * provider の match 関数で URL の妥当性を切る前段に使う。
 */
export function isHttpUrl(input: string): boolean {
  return /^https?:\/\//.test(input);
}
