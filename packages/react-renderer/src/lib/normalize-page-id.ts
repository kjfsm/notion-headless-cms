/**
 * Notion ページ ID を `pageLinks` の参照キーに正規化する。
 * core の `normalizePageId` と同一実装（ダッシュ除去 + 小文字化）。
 * `buildPageLinkMap` がこの形式でキーを作るため、変更時は両方を揃えること。
 */
export function normalizePageId(id: string): string {
  return id.replace(/-/g, "").toLowerCase();
}
